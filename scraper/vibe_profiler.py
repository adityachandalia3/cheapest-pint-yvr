"""
Generates a vibe profile and best_known_for description for each bar that has
price data. Pulls Google Places reviews (last 6 months) + all bar context, then
asks Claude to produce structured JSON.

Usage:
    python vibe_profiler.py --test        # first 3 bars only, prints results
    python vibe_profiler.py --all         # all bars with price data
    python vibe_profiler.py --bar-id <id> # single bar
"""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import anthropic
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GOOGLE_PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
SUPABASE_URL          = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY     = os.environ["ANTHROPIC_API_KEY"]

PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
SIX_MONTHS_SECS    = 180 * 24 * 3600

VIBE_PROMPT = """\
You are writing a genuinely useful vibe profile for a bar in Vancouver, BC \
that will power a recommendation engine. Your goal is to give someone enough \
specific, honest information to decide "yes, this is my bar for tonight" or \
"not for me" — not a generic description that could apply to any pub.

Use the review text and price data as primary evidence. If reviews mention \
something specific (a bartender, a patio, a dish, a night getting messy) — \
use it. If prices are notably cheap or expensive for the neighbourhood, say so \
explicitly. Be direct and specific. Avoid adjectives that apply to every bar \
("great atmosphere", "friendly staff", "good vibes").

━━━ BAR CONTEXT ━━━

Name: {name}
Address: {address}
Neighbourhood: {neighbourhood}
Price tier: {price_tier} (1=cheap, 2=mid, 3=pricey)
Average rating: {average_rating} ({review_count} reviews)
Google summary: {google_summary}

Pint prices:
{pint_prices}

Happy hour:
{happy_hour}

Recent Google reviews (last 6 months):
{reviews}

━━━ YOUR OUTPUT ━━━

Produce two things:

1. best_known_for — one punchy sentence that captures the bar's single most \
   distinctive quality. Not generic ("great local bar") — specific \
   ("The cheapest pint on Commercial Drive with a back patio that fills up \
   by 4pm on Fridays").

2. vibe_profile with exactly these keys:

   tags — array of 3–6 short labels for filtering. Choose only from:
     sports_bar, craft_beer, dive_bar, neighbourhood_local, happy_hour_gem,
     cheap_pints, patio, rooftop, late_night, first_date, date_night,
     group_friendly, solo_friendly, after_work, pre_drink, college_crowd,
     live_music, trivia_night, pool_table, dog_friendly, waterfront, cozy,
     lively, upscale, historic, brewery_attached

   crowd — who actually shows up and when. Be specific: day of week matters,
     and mix matters (e.g. "industry workers post-shift, neighbourhood \
     regulars mid-week; rowdier mixed crowd on weekends").

   energy — what it genuinely feels like inside. Reference noise level, \
     density, whether you can hold a conversation. Distinguish weekday vs \
     weekend if meaningfully different.

   price_value — contextualise the prices relative to the neighbourhood. \
     Don't just list the prices (we have those) — tell us if it's a deal, \
     average, or a splurge for where it sits. E.g. "At $6.50 a pint it's \
     one of the cheaper options in Gastown where most places charge $9+".

   insider_tip — one specific piece of knowledge a regular would tell a \
     friend. Could be a seating tip, a day/time to avoid, a menu item, a \
     bartender quirk, a hidden detail from the reviews. Must be concrete.

   avoid_if — honest counterpoint. What kind of person or night is this \
     bar wrong for? This builds trust and enables negative filtering.

   best_for — array of 2–4 specific occasions this bar genuinely suits. \
     Be concrete: not just "groups" but "groups of 6+ who want to watch \
     the game", not just "dates" but "low-key first dates where you want \
     to actually talk".

   night_arc — describe the realistic shape of a night here. When do you \
     arrive, what happens, when/why do you leave or stay. E.g. "Roll in at \
     5pm for HH, grab a table before it fills, stay through dinner — it \
     winds down by 10 so you either call it or move on".

━━━ OUTPUT FORMAT ━━━

Respond with ONLY valid JSON, no markdown fences, no commentary:
{{
  "best_known_for": "...",
  "vibe_profile": {{
    "tags": ["...", "..."],
    "crowd": "...",
    "energy": "...",
    "price_value": "...",
    "insider_tip": "...",
    "avoid_if": "...",
    "best_for": ["...", "..."],
    "night_arc": "..."
  }}
}}
"""


def fetch_places_reviews(place_id: str) -> tuple[list[str], Optional[str]]:
    """Returns (recent_review_snippets, editorial_summary)."""
    resp = requests.get(
        PLACES_DETAILS_URL,
        params={
            "place_id": place_id,
            "fields": "reviews,editorial_summary",
            "key": GOOGLE_PLACES_API_KEY,
        },
        timeout=10,
    )
    resp.raise_for_status()
    result = resp.json().get("result", {})

    cutoff = time.time() - SIX_MONTHS_SECS
    snippets = [
        r["text"]
        for r in result.get("reviews", [])
        if r.get("time", 0) >= cutoff and r.get("text", "").strip()
    ]

    summary = result.get("editorial_summary", {}).get("overview")
    return snippets, summary


def format_pint_prices(prices: list[dict]) -> str:
    if not prices:
        return "No price data."
    lines = []
    for p in prices:
        cat = p["category"].replace("_", " ")
        name = p.get("beer_name") or "Unknown"
        regular = f"${p['price_cad']:.2f}"
        hh = f" (HH: ${p['happy_hour_price_cad']:.2f})" if p.get("happy_hour_price_cad") else ""
        size = f" / {p['pour_size_oz']}oz" if p.get("pour_size_oz") else ""
        lines.append(f"  • {cat}: {name} — {regular}{hh}{size}")
    return "\n".join(lines)


def format_happy_hour(windows: list[dict]) -> str:
    if not windows:
        return "No happy hour data."
    lines = []
    for w in windows:
        days = ", ".join(w.get("days", []))
        start = w.get("start_time", "")[:5]
        end = w.get("end_time", "")[:5]
        notes = f" ({w['notes']})" if w.get("notes") else ""
        lines.append(f"  • {days}: {start}–{end}{notes}")
    return "\n".join(lines)


def generate_vibe(claude: anthropic.Anthropic, bar: dict, model: str) -> dict:
    snippets, editorial = fetch_places_reviews(bar["google_place_id"])

    google_summary = bar.get("google_summary") or editorial or "Not available."
    reviews_text = (
        "\n".join(f'  "{s}"' for s in snippets[:5])
        if snippets
        else "  No recent reviews available."
    )

    prompt = VIBE_PROMPT.format(
        name=bar["name"],
        address=bar.get("address") or "Unknown",
        neighbourhood=bar.get("neighbourhood") or "Unknown",
        price_tier=bar.get("price_tier") or "Unknown",
        average_rating=bar.get("average_rating") or "N/A",
        review_count=bar.get("review_count") or 0,
        google_summary=google_summary,
        pint_prices=format_pint_prices(bar.get("pint_prices", [])),
        happy_hour=format_happy_hour(bar.get("happy_hour_windows", [])),
        reviews=reviews_text,
    )

    msg = claude.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()

    # strip accidental code fences
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw), editorial


def process_bar(
    sb: Client,
    claude: anthropic.Anthropic,
    bar: dict,
    model: str,
    dry_run: bool = False,
) -> dict:
    print(f"\n{'─'*60}")
    print(f"  {bar['name']}  ({bar.get('neighbourhood') or 'unknown neighbourhood'})")

    result, editorial = generate_vibe(claude, bar, model)
    best_known_for = result["best_known_for"]
    vibe_profile   = result["vibe_profile"]

    print(f"  best_known_for : {best_known_for}")
    for k, v in vibe_profile.items():
        display = ", ".join(v) if isinstance(v, list) else v
        print(f"  {k:<16}: {display}")

    if not dry_run:
        update: dict = {
            "best_known_for": best_known_for,
            "vibe_profile": vibe_profile,
        }
        if editorial:
            update["google_summary"] = editorial
        sb.table("bars").update(update).eq("id", bar["id"]).execute()
        print("  ✓ saved to DB")

    return result


def load_bars(sb: Client, limit: Optional[int] = None, bar_id: Optional[str] = None) -> list[dict]:
    query = (
        sb.table("bars")
        .select(
            "id, name, google_place_id, address, neighbourhood, price_tier, "
            "average_rating, review_count, google_summary, "
            "pint_prices(category, beer_name, price_cad, happy_hour_price_cad, pour_size_oz), "
            "happy_hour_windows(days, start_time, end_time, notes)"
        )
        .eq("is_permanently_closed", False)
    )
    if bar_id:
        query = query.eq("id", bar_id)
    else:
        query = query.neq("price_entry_count", 0)
    if limit:
        query = query.limit(limit)
    return query.execute().data


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate vibe profiles for bars.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--test", action="store_true", help="Run on first 3 bars only (dry-run, prints results)")
    mode.add_argument("--all", action="store_true", help="Run on all bars with price data")
    mode.add_argument("--bar-id", type=str, help="Run on a single bar by UUID")
    parser.add_argument(
        "--model",
        default="claude-sonnet-4-6",
        help="Claude model to use (default: sonnet)",
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print results but do not save to DB")
    args = parser.parse_args()

    sb     = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    if args.test:
        bars = load_bars(sb, limit=3)
        print(f"TEST MODE — processing {len(bars)} bars (not saving to DB)\n")
        for bar in bars:
            process_bar(sb, claude, bar, model=args.model, dry_run=True)
        print("\n\nReview the profiles above. Run with --all to process all bars.")

    elif args.all:
        bars = load_bars(sb)
        print(f"Processing {len(bars)} bars...\n")
        ok = fail = 0
        for bar in bars:
            try:
                process_bar(sb, claude, bar, model=args.model, dry_run=False)
                ok += 1
            except Exception as e:
                print(f"  ✗ FAILED: {e}")
                fail += 1
        print(f"\n\nDone — {ok} succeeded, {fail} failed.")

    elif args.bar_id:
        bars = load_bars(sb, bar_id=args.bar_id)
        if not bars:
            print(f"No bar found with id {args.bar_id} (or no price data).")
            return
        process_bar(sb, claude, bars[0], model=args.model, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
