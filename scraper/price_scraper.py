"""
price_scraper.py — Scrapes REGULAR menu prices only. Never touches happy hour fields.
Skips any pint_prices row where verified=True.

Usage:
    python price_scraper.py --limit 5               # dry-run, first 5 bars
    python price_scraper.py --bars "Malone's,Red Card"  # dry-run, named bars
    python price_scraper.py --all                   # dry-run, all 44 bars
    python price_scraper.py --all --write           # write to DB (snapshots first)
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import signal
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import anthropic
import fitz
import requests
from dotenv import load_dotenv
from PIL import Image
from playwright.sync_api import sync_playwright
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GOOGLE_PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
SUPABASE_URL          = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY     = os.environ["ANTHROPIC_API_KEY"]

MODEL           = "claude-haiku-4-5-20251001"
MIN_PRICE       = 2.00
MAX_PRICE       = 30.00
MAX_TEXT_CHARS  = 10_000
MAX_IMAGE_BYTES = 4 * 1024 * 1024
SNAPSHOTS_DIR   = Path(__file__).parent / "snapshots"

MENU_PATH_GUESSES = [
    "/menu/beer-menu", "/menu/drink-menu", "/menu/drinks",
    "/menu", "/drinks", "/drink-menu", "/our-menu", "/menus", "/beer",
]

DRINK_PATTERNS = re.compile(
    r"(beer|drink|tap|pint|lager|ipa|ale|brew|draught|draft|cocktail|wine|spirit)",
    re.IGNORECASE,
)
FOOD_PATTERNS = re.compile(r"(food|pizza|burger|pasta|sandwich|breakfast)", re.IGNORECASE)

# ── Prompt ────────────────────────────────────────────────────────────────────

PRICE_PROMPT = """\
You are extracting REGULAR MENU beer prices for {bar_name} in Vancouver, BC.

CRITICAL RULES:
1. Extract ONLY regular prices — what a customer pays on a normal evening outside \
   of any deals or promotions.
2. IGNORE completely any section labeled "happy hour", "HH", "specials", "deals", \
   "promotions", "beat the clock", or similar. If you see a happy hour price next to \
   a regular price, use only the regular price.
3. Do NOT set happy_hour_price_cad — always return null for it.
4. For pour size: if multiple sizes exist, pick the standard pint size (16oz or \
   closest to it), NOT the cheapest small pour. A 10oz pour at $5 is probably \
   a happy hour size — prefer the 16oz at the higher price.
5. If you genuinely cannot find regular prices (only HH prices exist on this page), \
   return null for that category rather than guessing.
6. Prefer draft/tap prices over bottles or cans.

Menu text:
{text}

Return ONLY valid JSON, no markdown fences:
{{
  "cheapest_beer":  {{"name": "Beer Name",  "price_cad": 6.50, "pour_size_oz": 16, "confidence": "high"}},
  "cheapest_lager": {{"name": "Lager Name", "price_cad": 7.00, "pour_size_oz": 16, "confidence": "high"}},
  "cheapest_ipa":   {{"name": "IPA Name",   "price_cad": 7.50, "pour_size_oz": null, "confidence": "medium"}}
}}

Use null for any category where you cannot find a clear regular price.
confidence: "high" = price clearly on regular menu, "medium" = reasonable inference, \
"low" = uncertain.
"""

# ── Web fetching ───────────────────────────────────────────────────────────────

def _nav(page, url: str, timeout: int = 8000) -> None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    if len(page.inner_text("body")) < 300:
        try:
            page.wait_for_load_state("networkidle", timeout=4000)
        except Exception:
            pass


def get_main_menu_text(page, website_url: str) -> tuple[str, str]:
    """
    Navigate to the main menu page. Deliberately does NOT fetch HH pages.
    Returns (text, source_url).
    """
    _nav(page, website_url)
    homepage_html = page.content()

    # 1. Ranked drink/menu links from homepage
    base_domain = urlparse(website_url).netloc
    links = re.findall(
        r'<a[^>]+href=["\']([^"\'#][^"\']*)["\'][^>]*>(.*?)</a>',
        homepage_html, re.IGNORECASE | re.DOTALL,
    )
    candidates: list[tuple[int, str]] = []
    seen: set[str] = set()
    for href, text in links:
        full = urljoin(website_url, href)
        if urlparse(full).netloc != base_domain or full in seen:
            continue
        seen.add(full)
        visible = re.sub(r"<[^>]+>", "", text).strip().lower()
        score = 0
        if DRINK_PATTERNS.search(full):    score += 5
        if DRINK_PATTERNS.search(visible): score += 4
        if re.search(r"menu", full, re.I): score += 2
        if re.search(r"menu", visible, re.I): score += 1
        if FOOD_PATTERNS.search(full):     score -= 4
        if FOOD_PATTERNS.search(visible):  score -= 3
        if score > 0:
            candidates.append((score, full))
    candidates.sort(reverse=True)

    for _, url in candidates[:3]:
        if url.lower().endswith(".pdf") or ".pdf?" in url.lower():
            return "", url
        _nav(page, url)
        t = page.inner_text("body")
        if len(t) > 200:
            return t[:MAX_TEXT_CHARS], url

    # 2. Path guesses
    base = website_url.rstrip("/")
    for path in MENU_PATH_GUESSES:
        guess = base + path
        try:
            _nav(page, guess, timeout=5000)
            if page.url.rstrip("/") == website_url.rstrip("/"):
                continue
            t = page.inner_text("body")
            if len(t) > 300:
                return t[:MAX_TEXT_CHARS], page.url
        except Exception:
            continue

    # 3. Homepage fallback
    return page.inner_text("body")[:MAX_TEXT_CHARS], website_url


CLAUDE_MAX_IMAGE_BYTES = 3_800_000  # ~3.8 MB raw keeps base64 safely under 5 MB decoded

def fetch_image_b64(url: str) -> tuple[str, str] | None:
    try:
        resp = requests.get(url, timeout=15, stream=True,
                            headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        ct = resp.headers.get("Content-Type", "").split(";")[0].strip()
        if ct not in {"image/jpeg", "image/png", "image/webp"}:
            m = re.search(r"\.(jpe?g|png|webp)", url, re.I)
            if not m:
                return None
            ct = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                  "png": "image/png", "webp": "image/webp"}[m.group(1).lower()]
        chunks, total = [], 0
        for chunk in resp.iter_content(65536):
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                return None
            chunks.append(chunk)
        raw = b"".join(chunks)
        # Compress down if needed so base64 stays under Claude's 5 MB limit
        if len(raw) > CLAUDE_MAX_IMAGE_BYTES:
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            for quality in range(82, 20, -10):
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=quality)
                raw = buf.getvalue()
                if len(raw) <= CLAUDE_MAX_IMAGE_BYTES:
                    break
            ct = "image/jpeg"
        return base64.standard_b64encode(raw).decode(), ct
    except Exception:
        return None


def fetch_pdf_b64(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=30, stream=True,
                            headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        chunks, total = [], 0
        for chunk in resp.iter_content(65536):
            total += len(chunk)
            if total > 5 * 1024 * 1024:
                return None
            chunks.append(chunk)
        return base64.standard_b64encode(b"".join(chunks)).decode()
    except Exception:
        return None


# ── Claude extraction ──────────────────────────────────────────────────────────

def _strip_fences(s: str) -> str:
    s = re.sub(r'^```(?:json)?\s*', '', s.strip(), flags=re.MULTILINE)
    return re.sub(r'\s*```\s*$', '', s).strip()


def extract_from_text(claude: anthropic.Anthropic, bar_name: str, text: str) -> dict:
    msg = claude.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": PRICE_PROMPT.format(
            bar_name=bar_name, text=text
        )}],
    )
    raw = _strip_fences(msg.content[0].text)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


MENU_IMG_RE = re.compile(r"(menu|beer|drink|price|tap)", re.IGNORECASE)

def find_menu_images(page, max_images: int = 3) -> list[str]:
    """Return URLs of images on the current page that look like menu images."""
    try:
        imgs = page.evaluate("""() => Array.from(document.querySelectorAll('img[src]')).map(i => ({
            src: i.src, w: i.naturalWidth||i.width||0, h: i.naturalHeight||i.height||0, alt: i.alt||''
        }))""")
    except Exception:
        return []
    candidates: list[tuple[int, str]] = []
    seen: set[str] = set()
    for img in imgs:
        src = img.get("src", "")
        if not src or src.startswith("data:") or src in seen:
            continue
        if not re.search(r"\.(jpe?g|png|webp)(\?|$)", src, re.IGNORECASE):
            continue
        w, h = img.get("w", 0), img.get("h", 0)
        if w and h and (w < 100 or h < 100):
            continue
        score = 0
        if MENU_IMG_RE.search(src):               score += 5
        if MENU_IMG_RE.search(img.get("alt", "")): score += 3
        if w > 800 or h > 600:                    score += 2
        elif w > 400 or h > 300:                  score += 1
        if score > 0:
            candidates.append((score, src))
            seen.add(src)
    candidates.sort(reverse=True)
    return [u for _, u in candidates[:max_images]]


def extract_from_image(claude: anthropic.Anthropic, bar_name: str,
                       b64: str, media_type: str) -> dict:
    prompt = (
        f"Extract REGULAR beer prices only for {bar_name}. "
        "Ignore any happy hour sections. Return JSON with keys "
        "cheapest_beer, cheapest_lager, cheapest_ipa each having "
        "{name, price_cad, pour_size_oz, confidence} or null.\n"
        "No markdown fences."
    )
    msg = claude.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64",
             "media_type": media_type, "data": b64}},
            {"type": "text", "text": prompt},
        ]}],
    )
    raw = _strip_fences(msg.content[0].text)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def extract_from_pdf(claude: anthropic.Anthropic, bar_name: str, b64: str) -> dict:
    prompt = (
        f"Extract REGULAR beer prices only for {bar_name}. "
        "Ignore any happy hour sections. Return JSON with keys "
        "cheapest_beer, cheapest_lager, cheapest_ipa each having "
        "{name, price_cad, pour_size_oz, confidence} or null.\n"
        "No markdown fences."
    )
    msg = claude.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": [
            {"type": "document", "source": {"type": "base64",
             "media_type": "application/pdf", "data": b64}},
            {"type": "text", "text": prompt},
        ]}],
    )
    return json.loads(_strip_fences(msg.content[0].text))


# ── Validation ─────────────────────────────────────────────────────────────────

def validate_entry(entry: dict | None) -> dict | None:
    if not entry or entry.get("price_cad") is None:
        return None
    try:
        price = float(entry["price_cad"])
    except (TypeError, ValueError):
        return None
    if not (MIN_PRICE <= price <= MAX_PRICE):
        return None
    # Reject suspiciously small pours that scream "happy hour" (< 12oz at < $6)
    pour = entry.get("pour_size_oz")
    if pour and float(pour) < 12 and price < 6.00:
        return None
    return entry


# ── Diff display ───────────────────────────────────────────────────────────────

CATEGORIES = ("cheapest_beer", "cheapest_lager", "cheapest_ipa")

def show_diff(bar_name: str, current: dict[str, dict], proposed: dict) -> list[dict]:
    """
    Print a clear diff of current vs proposed values.
    Returns list of change records (empty if nothing to change).
    """
    changes = []
    print(f"\n  {'─'*56}")
    print(f"  {bar_name}")

    for cat in CATEGORIES:
        cur = current.get(cat)
        prop_raw = proposed.get(cat)
        prop = validate_entry(prop_raw) if prop_raw else None

        # Skip if row is verified
        if cur and cur.get("verified"):
            print(f"    {cat:<18} 🔒 VERIFIED — skipped")
            continue

        if cur is None and prop is None:
            print(f"    {cat:<18} — no data (skipped)")
            continue

        cur_name  = cur.get("beer_name") if cur else None
        cur_price = float(cur["price_cad"]) if cur else None
        prop_name  = prop.get("name") if prop else None
        prop_price = float(prop["price_cad"]) if prop else None

        if prop is None:
            print(f"    {cat:<18} ⚠  Claude returned nothing — keeping ${cur_price:.2f}")
            continue

        name_changed  = prop_name != cur_name
        price_changed = prop_price != cur_price

        if not name_changed and not price_changed:
            print(f"    {cat:<18} ✓  no change  ({cur_name} @ ${cur_price:.2f})")
            continue

        # Build diff line
        parts = []
        if name_changed:
            parts.append(f"name: \"{cur_name}\" → \"{prop_name}\"")
        if price_changed:
            old_p = f"${cur_price:.2f}" if cur_price is not None else "—"
            arrow = (" ↑" if prop_price > cur_price else " ↓") if cur_price is not None else ""
            parts.append(f"price: {old_p} → ${prop_price:.2f}{arrow}")

        flags = "  ⚡ " + " | ".join(parts)
        print(f"    {cat:<18}{flags}")

        changes.append({
            "category": cat,
            "beer_name": prop_name,
            "price_cad": prop_price,
            "pour_size_oz": prop.get("pour_size_oz"),
            "confidence": prop.get("confidence", "medium"),
            "source_section": "main_menu",
        })

    return changes


# ── Snapshot ───────────────────────────────────────────────────────────────────

def take_snapshot(sb: Client) -> Path:
    SNAPSHOTS_DIR.mkdir(exist_ok=True)
    rows = sb.table("pint_prices").select("*").execute().data
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    path = SNAPSHOTS_DIR / f"pint_prices_{ts}.json"
    path.write_text(json.dumps(rows, indent=2, default=str))
    print(f"\n  Snapshot saved → {path}")
    return path


# ── Main scrape loop ───────────────────────────────────────────────────────────

def load_bars(sb: Client, names: list[str] | None, ids: list[str] | None,
              limit: int | None) -> list[dict]:
    query = (
        sb.table("bars")
        .select("id, name, website, neighbourhood, "
                "pint_prices(id, category, beer_name, price_cad, verified)")
        .eq("is_permanently_closed", False)
    )
    # Only restrict to bars with existing price data when not targeting specific bars
    if not ids and not names:
        query = query.neq("price_entry_count", 0)
    rows = query.execute().data
    bars = [b for b in rows if b.get("website")]
    if ids:
        id_set = set(ids)
        bars = [b for b in bars if b["id"] in id_set]
    elif names:
        names_lower = [n.lower().strip() for n in names]
        bars = [b for b in bars if any(n in b["name"].lower() for n in names_lower)]
    if limit and not ids and not names:
        bars = bars[:limit]
    return bars


class _BarTimeout(Exception):
    pass

def _timeout_handler(signum, frame):
    raise _BarTimeout()


def _all_null(result: dict) -> bool:
    """True if Claude returned a result but every category is null."""
    return bool(result) and all(result.get(c) is None for c in
                                ("cheapest_beer", "cheapest_lager", "cheapest_ipa"))


def scrape_bar(page, claude: anthropic.Anthropic, bar: dict) -> dict:
    """
    Scrape a bar's menu. Attempts in order:
      1. Text extraction from main menu page
      2. PDF extraction if a PDF URL is detected
      3. Vision fallback — menu images on the current page
    """
    website  = bar["website"]
    bar_name = bar["name"]

    text, source_url = get_main_menu_text(page, website)

    # PDF path
    if not text and source_url.lower().endswith(".pdf"):
        b64 = fetch_pdf_b64(source_url)
        if b64:
            return extract_from_pdf(claude, bar_name, b64)
        return {}

    # Text extraction
    if text:
        result = extract_from_text(claude, bar_name, text)
        if result and not _all_null(result):
            return result
        print(f"    → text yielded nothing, trying vision fallback...")

    # Vision fallback — look for menu images on the current page
    image_urls = find_menu_images(page)
    for img_url in image_urls:
        img = fetch_image_b64(img_url)
        if not img:
            continue
        b64, media_type = img
        result = extract_from_image(claude, bar_name, b64, media_type)
        if result and not _all_null(result):
            print(f"    → vision succeeded ({img_url[:60]}...)")
            return result

    return {}


def run(args: argparse.Namespace) -> None:
    sb     = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    names = [n.strip() for n in args.bars.split(",")] if args.bars else None
    ids   = [i.strip() for i in args.ids.split(",")] if args.ids else None
    bars  = load_bars(sb, names=names, ids=ids,
                      limit=args.limit if not names and not ids else None)

    if not bars:
        print("No bars found matching criteria.")
        return

    mode = "WRITE" if args.write else "DRY-RUN"
    print(f"\n{'━'*60}")
    print(f"  price_scraper — {mode} — {len(bars)} bars")
    print(f"{'━'*60}")

    if args.write:
        take_snapshot(sb)

    all_changes: list[tuple[str, str, list[dict]]] = []  # (bar_id, bar_name, changes)
    now = datetime.now(timezone.utc).isoformat()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120 Safari/537.36"
        )
        page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})

        for bar in bars:
            bar_id = bar["id"]
            bar_name = bar["name"]
            current = {p["category"]: p for p in (bar.get("pint_prices") or [])}

            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(60)
            try:
                proposed = scrape_bar(page, claude, bar)
                signal.alarm(0)
            except _BarTimeout:
                signal.alarm(0)
                print(f"\n  {bar_name}: ⏱  timed out (>60s) — skipped")
                continue
            except Exception as e:
                signal.alarm(0)
                print(f"\n  {bar_name}: ✗ scrape failed — {e}")
                continue

            # If scraper returned nothing at all, never touch existing data
            if not proposed or _all_null(proposed):
                print(f"\n  {'─'*56}")
                print(f"  {bar_name}")
                print(f"    ⚠  scraper returned nothing — existing data preserved")
                continue

            changes = show_diff(bar_name, current, proposed)
            if changes:
                all_changes.append((bar_id, bar_name, changes))

        browser.close()

    # Summary table
    print(f"\n{'━'*60}")
    print(f"  Proposed changes — {sum(len(c) for _,_,c in all_changes)} fields across {len(all_changes)} bars\n")
    if all_changes:
        col_bar  = max(len(n) for _, n, _ in all_changes)
        col_bar  = max(col_bar, 4)
        header = f"  {'Bar':<{col_bar}}  {'Category':<18}  {'Old Beer':<28}  {'Old $':>6}  {'New Beer':<28}  {'New $':>6}"
        print(header)
        print("  " + "─" * (len(header) - 2))
        for bar_id, bar_name, changes in all_changes:
            cur_map = {p["category"]: p for p in next(
                (b["pint_prices"] for b in bars if b["id"] == bar_id), []
            ) or []}
            for chg in changes:
                cat  = chg["category"]
                cur  = cur_map.get(cat, {})
                old_beer  = (cur.get("beer_name") or "—")[:28]
                old_price = f"${float(cur['price_cad']):.2f}" if cur.get("price_cad") else "—"
                new_beer  = (chg.get("beer_name") or "—")[:28]
                new_price = f"${float(chg['price_cad']):.2f}" if chg.get("price_cad") else "—"
                print(f"  {bar_name:<{col_bar}}  {cat:<18}  {old_beer:<28}  {old_price:>6}  {new_beer:<28}  {new_price:>6}")

    if not args.write:
        print(f"\n  Dry-run complete. Run with --write to apply these changes.")
        return

    # Write
    print(f"\n  Writing changes...")
    written = 0
    for bar_id, bar_name, changes in all_changes:
        for chg in changes:
            try:
                sb.table("pint_prices").upsert(
                    {**chg, "bar_id": bar_id, "scraped_at": now},
                    on_conflict="bar_id,category",
                ).execute()
                written += 1
            except Exception as e:
                print(f"    ✗ {bar_name} / {chg['category']}: {e}")

    print(f"  Done — {written} rows written.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape regular menu prices.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all",   action="store_true", help="All bars with price data")
    group.add_argument("--bars",  type=str, help='Comma-separated bar names')
    group.add_argument("--ids",   type=str, help='Comma-separated bar UUIDs')
    group.add_argument("--limit", type=int, help="First N bars (for testing)")
    parser.add_argument("--write", action="store_true",
                        help="Write changes to DB (default: dry-run)")
    args = parser.parse_args()

    if args.all:
        args.limit = None
    if not hasattr(args, 'ids'):
        args.ids = None
    run(args)


if __name__ == "__main__":
    main()
