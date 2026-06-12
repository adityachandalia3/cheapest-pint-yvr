#!/usr/bin/env python3
"""
Scrapes bar websites and uses Claude to extract World Cup 2026 screening
profile info, saving results to the wc_profile JSONB column in Supabase.

Targets all screening_confirmed bars that don't have a wc_profile yet,
so it's safe to re-run — already-scraped bars are automatically skipped.

Usage:
    python scripts/wc_profile_scraper.py           # dry-run (no DB writes)
    python scripts/wc_profile_scraper.py --save    # write results to Supabase
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

# ── dependency check ────────────────────────────────────────────────────────
missing = []
try:
    import requests
except ImportError:
    missing.append("requests")
try:
    from bs4 import BeautifulSoup
except ImportError:
    missing.append("beautifulsoup4")
try:
    import anthropic
except ImportError:
    missing.append("anthropic")
try:
    from supabase import create_client
except ImportError:
    missing.append("supabase-py")

if missing:
    print(f"ERROR: missing dependencies: {', '.join(missing)}")
    print(f"Install with: pip install {' '.join(missing)}")
    sys.exit(1)

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

EXTRA_PATHS = ["/events", "/specials", "/world-cup"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

SYSTEM_PROMPT = """\
You are extracting World Cup 2026 screening information from a Vancouver bar's website text.
Return ONLY a valid JSON object with exactly these fields.
Use null for anything not explicitly stated — do not infer or assume.
Do not include any text outside the JSON object.

{
  "screen_type": "description of screens e.g. theatre screen / projector / multiple big screen TVs / null",
  "booking_required": true or false or null,
  "booking_notes": "any booking/reservation details or null",
  "atmosphere": "rowdy / lively / chill / mixed / null — only if explicitly described",
  "opens_early": true or false or null,
  "opens_early_notes": "any early opening details for morning matches or null",
  "capacity_notes": "any info about venue size or filling up or null",
  "special_features": "any standout features e.g. rooftop patio, outdoor screen, pool tables or null",
  "match_day_deals": "any drink specials or deals mentioned for World Cup or null",
  "source_url": "the URL that was scraped",
  "scraped_at": "ISO timestamp",
  "confidence": "high / medium / low — based on how much WC-specific content was found"
}\
"""

RAW_LOG = os.path.join(os.path.dirname(__file__), "wc_profile_raw.log")


# ── scraping helpers ─────────────────────────────────────────────────────────

def fetch_text(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return " ".join(soup.get_text(separator=" ").split())
    except Exception:
        return None


def scrape_bar(website: str) -> tuple[str, str]:
    """Return (combined_text, primary_url). combined_text may be empty."""
    chunks: list[str] = []
    used_url = website

    base = fetch_text(website)
    if base:
        chunks.append(base)

    origin = f"{urlparse(website).scheme}://{urlparse(website).netloc}"
    for path in EXTRA_PATHS:
        extra = fetch_text(urljoin(origin, path))
        if extra:
            chunks.append(extra)

    combined = " ".join(chunks)[:3000]
    return combined, used_url


# ── AI extraction ─────────────────────────────────────────────────────────────

def extract_profile(text: str, bar_name: str, source_url: str) -> tuple[dict, int, int]:
    """Return (profile_dict, input_tokens, output_tokens)."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    user_msg = (
        f"Bar name: {bar_name}\n"
        f"Website URL: {source_url}\n\n"
        f"Website text:\n{text if text else '(no text could be scraped)'}"
    )
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    raw = response.content[0].text.strip()
    # strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    in_tok  = response.usage.input_tokens
    out_tok = response.usage.output_tokens

    try:
        profile = json.loads(raw)
    except json.JSONDecodeError:
        with open(RAW_LOG, "a") as f:
            f.write(f"\n--- {bar_name} {datetime.now(timezone.utc).isoformat()} ---\n")
            f.write(raw + "\n")
        print(f"   ⚠️  Invalid JSON from API — raw text saved to {RAW_LOG}")
        profile = {"_raw": raw, "confidence": "low"}

    profile["source_url"]  = source_url
    profile["scraped_at"]  = datetime.now(timezone.utc).isoformat()
    return profile, in_tok, out_tok


# ── main ──────────────────────────────────────────────────────────────────────

def main(save: bool) -> None:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all confirmed screening bars without a wc_profile yet
    res = (
        sb.from_("bars")
        .select("id, name, website")
        .eq("screening_confirmed", True)
        .is_("wc_profile", "null")
        .execute()
    )
    bars = res.data or []

    print(f"Found {len(bars)} bars without wc_profile. Starting scrape...")

    if not bars:
        print("Nothing to do.")
        return

    total_in = total_out = 0
    results: list[dict] = []

    for i, bar in enumerate(bars):
        bar_id  = bar["id"]
        name    = bar["name"]
        website = bar.get("website")

        print(f"\n🔍 {name}")
        if not website:
            print("   ⚠️  No website URL found — skipping")
            continue

        print(f"   Scraping {website} …")
        text, source_url = scrape_bar(website)
        print(f"   {len(text)} chars scraped")

        profile, in_tok, out_tok = extract_profile(text, name, source_url)
        total_in  += in_tok
        total_out += out_tok

        results.append({"id": bar_id, "name": name, "profile": profile})

        def val(k: str) -> str:
            v = profile.get(k)
            return str(v) if v is not None else "—"

        print(f"   ✅ {name}")
        print(f"      screen_type:       {val('screen_type')}")
        print(f"      booking_required:  {val('booking_required')}")
        print(f"      atmosphere:        {val('atmosphere')}")
        print(f"      match_day_deals:   {val('match_day_deals')}")
        print(f"      confidence:        {val('confidence')}")
        print(f"      source:            {val('source_url')}")
        print(f"      tokens:            {in_tok} in / {out_tok} out")

        if i < len(bars) - 1:
            time.sleep(2)

    # Cost estimate
    cost = total_in * 0.000003 + total_out * 0.000015
    print(f"\n💰 Estimated API cost: ${cost:.4f}  ({total_in} input / {total_out} output tokens)")

    if save:
        print("\n💾 Saving to Supabase …")
        for r in results:
            sb.from_("bars").update({"wc_profile": r["profile"]}).eq("id", r["id"]).execute()
            print(f"   ✅ Saved {r['name']}")
        print("Done.")
    else:
        print("\nReview the above results. Run with --save flag to commit to Supabase.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", action="store_true", help="Write results to Supabase")
    args = parser.parse_args()
    main(save=args.save)
