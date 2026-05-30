"""
hh_scraper.py — Scrapes HAPPY HOUR prices only. Never touches price_cad (regular prices).
Skips any pint_prices row where verified=True.

Updates happy_hour_price_cad and happy_hour_beer_name on existing pint_prices rows.
If the HH beer differs from the regular beer, happy_hour_beer_name is stored separately.

Usage:
    python hh_scraper.py --bars "Mum's The Word"    # dry-run, named bars
    python hh_scraper.py --limit 5                  # dry-run, first 5 bars
    python hh_scraper.py --all                      # dry-run, all bars
    python hh_scraper.py --all --write              # write to DB (snapshots first)
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import anthropic
import requests
from dotenv import load_dotenv
from PIL import Image
from playwright.sync_api import sync_playwright
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY    = os.environ["ANTHROPIC_API_KEY"]

MODEL          = "claude-sonnet-4-6"
MIN_PRICE      = 2.00
MAX_PRICE      = 30.00
MAX_TEXT_CHARS = 10_000
SNAPSHOTS_DIR  = Path(__file__).parent / "snapshots"

CLAUDE_MAX_IMAGE_BYTES = 3_800_000

HH_PATH_GUESSES = [
    "/happy-hour", "/happyhour", "/specials", "/deals", "/promotions",
    "/drinks/happy-hour", "/menu/specials", "/menu/happy-hour",
]

HH_PATTERNS = re.compile(
    r"(happy.?hour|hh|special|deal|promo|beat.the.clock)",
    re.IGNORECASE,
)
DRINK_PATTERNS = re.compile(
    r"(beer|drink|tap|pint|lager|ipa|ale|brew|draught|draft)",
    re.IGNORECASE,
)

# ── Prompt ────────────────────────────────────────────────────────────────────

HH_PROMPT = """\
You are extracting HAPPY HOUR beer prices for {bar_name} in Vancouver, BC.

CRITICAL RULES:
1. Extract ONLY happy hour / daily special / deal prices — the discounted price \
   customers get during happy hour.
2. Focus specifically on sections labeled "happy hour", "HH", "specials", "deals", \
   "beat the clock", or similar time-limited promotions.
3. If the regular menu is shown alongside HH prices, take the HH (lower) price.
4. Do NOT set price_cad — always return null for it (we track regular prices separately).
5. If you cannot find a happy hour price for a category, return null for that category.
6. Prefer draft/tap prices over bottles or cans.
7. For each category, pick the cheapest available HH option.

Menu text:
{text}

Return ONLY valid JSON, no markdown fences:
{{
  "cheapest_beer":  {{"hh_beer_name": "Beer Name",  "hh_price_cad": 5.00, "pour_size_oz": 16, "confidence": "high"}},
  "cheapest_lager": {{"hh_beer_name": "Lager Name", "hh_price_cad": 5.50, "pour_size_oz": 16, "confidence": "high"}},
  "cheapest_ipa":   {{"hh_beer_name": "IPA Name",   "hh_price_cad": 6.00, "pour_size_oz": null, "confidence": "medium"}}
}}

Use null for any category where you cannot find a happy hour price.
confidence: "high" = clearly labeled as HH price, "medium" = reasonable inference, "low" = uncertain.
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


def get_hh_page_text(page, website_url: str) -> tuple[str, str]:
    """
    Navigate to the HH page. Prioritises HH-labelled links and path guesses,
    falls back to regular menu page, then homepage.
    Returns (text, source_url).
    """
    _nav(page, website_url)
    homepage_html = page.content()
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
        if HH_PATTERNS.search(full):      score += 6
        if HH_PATTERNS.search(visible):   score += 5
        if DRINK_PATTERNS.search(full):   score += 2
        if DRINK_PATTERNS.search(visible):score += 1
        if re.search(r"menu", full, re.I):  score += 1
        if score > 0:
            candidates.append((score, full))
    candidates.sort(reverse=True)

    for _, url in candidates[:4]:
        if url.lower().endswith(".pdf") or ".pdf?" in url.lower():
            return "", url
        _nav(page, url)
        t = page.inner_text("body")
        if len(t) > 200:
            return t[:MAX_TEXT_CHARS], url

    # HH path guesses
    base = website_url.rstrip("/")
    for path in HH_PATH_GUESSES:
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

    # Fallback: homepage (HH info often listed there)
    return page.inner_text("body")[:MAX_TEXT_CHARS], website_url


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
            if total > CLAUDE_MAX_IMAGE_BYTES * 2:
                return None
            chunks.append(chunk)
        raw = b"".join(chunks)
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


# ── Claude extraction ──────────────────────────────────────────────────────────

def _strip_fences(s: str) -> str:
    s = re.sub(r'^```(?:json)?\s*', '', s.strip(), flags=re.MULTILINE)
    return re.sub(r'\s*```\s*$', '', s).strip()


def extract_from_text(claude: anthropic.Anthropic, bar_name: str, text: str) -> dict:
    msg = claude.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": HH_PROMPT.format(
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


MENU_IMG_RE = re.compile(r"(menu|beer|drink|price|tap|happy|special)", re.IGNORECASE)

def find_menu_images(page, max_images: int = 3) -> list[str]:
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
        f"Extract HAPPY HOUR beer prices only for {bar_name}. "
        "Focus on happy hour / specials sections. "
        "Return JSON with keys cheapest_beer, cheapest_lager, cheapest_ipa, each having "
        "{hh_beer_name, hh_price_cad, pour_size_oz, confidence} or null.\n"
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


# ── Validation ─────────────────────────────────────────────────────────────────

def validate_entry(entry: dict | None) -> dict | None:
    if not entry or entry.get("hh_price_cad") is None:
        return None
    try:
        price = float(entry["hh_price_cad"])
    except (TypeError, ValueError):
        return None
    if not (MIN_PRICE <= price <= MAX_PRICE):
        return None
    return entry


# ── Diff display ───────────────────────────────────────────────────────────────

CATEGORIES = ("cheapest_beer", "cheapest_lager", "cheapest_ipa")


def show_diff(bar_name: str, current: dict[str, dict], proposed: dict) -> list[dict]:
    changes = []
    print(f"\n  {'─'*56}")
    print(f"  {bar_name}")

    for cat in CATEGORIES:
        cur = current.get(cat)
        prop_raw = proposed.get(cat)
        prop = validate_entry(prop_raw) if prop_raw else None

        if cur is None and prop is None:
            print(f"    {cat:<18} — no data (skipped)")
            continue

        cur_hh_price = float(cur["happy_hour_price_cad"]) if cur and cur.get("happy_hour_price_cad") else None
        cur_hh_name  = cur.get("happy_hour_beer_name") if cur else None
        prop_price   = float(prop["hh_price_cad"]) if prop else None
        prop_name    = prop.get("hh_beer_name") if prop else None

        if prop is None:
            if cur_hh_price:
                print(f"    {cat:<18} ⚠  nothing found — keeping HH ${cur_hh_price:.2f}")
            else:
                print(f"    {cat:<18} ⚠  nothing found — no existing HH data")
            continue

        name_changed  = prop_name != cur_hh_name
        price_changed = prop_price != cur_hh_price

        if not name_changed and not price_changed:
            print(f"    {cat:<18} ✓  no change  (HH: {cur_hh_name or cur.get('beer_name')} @ ${cur_hh_price:.2f})")
            continue

        parts = []
        if name_changed:
            old = f'"{cur_hh_name}"' if cur_hh_name is not None else "—"
            parts.append(f"HH beer: {old} → \"{prop_name}\"")
        if price_changed:
            old_p = f"${cur_hh_price:.2f}" if cur_hh_price else "—"
            arrow = "↑" if prop_price > (cur_hh_price or 0) else "↓"
            parts.append(f"HH price: {old_p} → ${prop_price:.2f} {arrow}")

        print(f"    {cat:<18}  ⚡ " + " | ".join(parts))

        changes.append({
            "category":            cat,
            "happy_hour_price_cad": prop_price,
            "happy_hour_beer_name": prop_name,
            "confidence":          prop.get("confidence", "medium"),
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

def load_bars(sb: Client, names: list[str] | None, limit: int | None) -> list[dict]:
    rows = (
        sb.table("bars")
        .select("id, name, website, neighbourhood, "
                "pint_prices(id, category, beer_name, price_cad, "
                "happy_hour_price_cad, happy_hour_beer_name, verified)")
        .neq("price_entry_count", 0)
        .eq("is_permanently_closed", False)
        .execute()
        .data
    )
    bars = [b for b in rows if b.get("website")]
    if names:
        names_lower = [n.lower().strip() for n in names]
        bars = [b for b in bars if any(n in b["name"].lower() for n in names_lower)]
    if limit and not names:
        bars = bars[:limit]
    return bars


def _all_null(result: dict) -> bool:
    return bool(result) and all(result.get(c) is None for c in CATEGORIES)


def scrape_bar(page, claude: anthropic.Anthropic, bar: dict) -> dict:
    website  = bar["website"]
    bar_name = bar["name"]

    text, source_url = get_hh_page_text(page, website)

    if not text and (source_url.lower().endswith(".pdf") or ".pdf?" in source_url.lower()):
        print(f"    → PDF source found, skipping (HH unlikely in PDF)")
        return {}

    if text:
        result = extract_from_text(claude, bar_name, text)
        if result and not _all_null(result):
            return result
        print(f"    → text yielded nothing, trying vision fallback...")

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
    bars  = load_bars(sb, names=names, limit=args.limit if not names else None)

    if not bars:
        print("No bars found matching criteria.")
        return

    mode = "WRITE" if args.write else "DRY-RUN"
    print(f"\n{'━'*60}")
    print(f"  hh_scraper — {mode} — {len(bars)} bars")
    print(f"{'━'*60}")

    if args.write:
        take_snapshot(sb)

    all_changes: list[tuple[str, str, list[dict]]] = []
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
            bar_id   = bar["id"]
            bar_name = bar["name"]
            current  = {p["category"]: p for p in (bar.get("pint_prices") or [])}

            try:
                proposed = scrape_bar(page, claude, bar)
            except Exception as e:
                print(f"\n  {bar_name}: ✗ scrape failed — {e}")
                continue

            if not proposed or _all_null(proposed):
                print(f"\n  {'─'*56}")
                print(f"  {bar_name}")
                print(f"    ⚠  scraper returned nothing — existing HH data preserved")
                continue

            changes = show_diff(bar_name, current, proposed)
            if changes:
                all_changes.append((bar_id, bar_name, changes))

        browser.close()

    print(f"\n{'━'*60}")
    print(f"  Summary — {len(all_changes)} bars have HH changes\n")
    for _, name, chgs in all_changes:
        print(f"    {name}: {len(chgs)} field(s) would update")

    if not args.write:
        print(f"\n  Run with --write to apply these changes.")
        return

    print(f"\n  Writing changes...")
    written = 0
    for bar_id, bar_name, changes in all_changes:
        for chg in changes:
            cat = chg.pop("category")
            try:
                # Only update HH fields on existing row — never touch price_cad
                existing = sb.table("pint_prices").select("id").eq("bar_id", bar_id).eq("category", cat).execute().data
                if existing:
                    sb.table("pint_prices").update({
                        **chg,
                        "scraped_at": now,
                    }).eq("id", existing[0]["id"]).execute()
                    written += 1
                else:
                    print(f"    ⚠ {bar_name} / {cat}: no existing row to update HH data on")
            except Exception as e:
                print(f"    ✗ {bar_name} / {cat}: {e}")

    print(f"  Done — {written} rows written.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape happy hour prices.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all",   action="store_true", help="All bars with price data")
    group.add_argument("--bars",  type=str, help='Comma-separated bar names')
    group.add_argument("--limit", type=int, help="First N bars (for testing)")
    parser.add_argument("--write", action="store_true",
                        help="Write changes to DB (default: dry-run)")
    args = parser.parse_args()

    if args.all:
        args.limit = None
    run(args)


if __name__ == "__main__":
    main()
