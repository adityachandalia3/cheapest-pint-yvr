"""
lookup_new_bars.py — Looks up the 12 shortlisted bars via Google Places API
and generates insert_bars_new_batch.py ready to run.

Usage:
    python lookup_new_bars.py           # look up + print results, generate insert script
    python lookup_new_bars.py --insert  # look up + generate + immediately insert into DB
"""

from __future__ import annotations

import argparse
import json
import os
import re
import textwrap
import time
from typing import Optional

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GOOGLE_PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
SUPABASE_URL          = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]

TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS_URL     = "https://maps.googleapis.com/maps/api/place/details/json"
DETAIL_FIELDS   = (
    "place_id,name,formatted_address,geometry,formatted_phone_number,"
    "website,opening_hours,price_level,business_status,rating,user_ratings_total,"
    "editorial_summary"
)

# ── Shortlist ────────────────────────────────────────────────────────────────
# (name, hint neighbourhood) — neighbourhood is our best guess, verified below
BARS = [
    ("Darby's Pub",                  "Kitsilano"),
    ("Browns Socialhouse Kitsilano", "Kitsilano"),
    ("Library Square Public House",  "Downtown"),
    ("Butcher & Bullock",            "Main Street"),
    ("The Shameful Tiki Room",       "Main Street"),
    ("The Diamond",                  "Gastown"),
    ("The Keefer Bar",               "Chinatown"),
    ("Back and Forth Bar",           "Strathcona"),
    ("The Watson",                   "Vancouver"),
    ("Chickadee Room",               "Vancouver"),
    ("Bar Corso",                    "Vancouver"),
    ("Odd Society Spirits",          "East Vancouver"),
]

# ── Neighbourhood inference ──────────────────────────────────────────────────
NEIGHBOURHOOD_HINTS: list[tuple[str, str]] = [
    ("kitsilano",          "Kitsilano"),
    ("w 4th",              "Kitsilano"),
    ("w broadway",         "Kitsilano"),
    ("arbutus",            "Kitsilano"),
    ("macdonald",          "Kitsilano"),
    ("cornwall",           "Kitsilano"),
    ("yaletown",           "Yaletown"),
    ("mainland",           "Yaletown"),
    ("homer",              "Yaletown"),
    ("gastown",            "Gastown"),
    ("water st",           "Gastown"),
    ("powell st",          "Gastown"),
    ("alexander",          "Gastown"),
    ("chinatown",          "Chinatown"),
    ("keefer",             "Chinatown"),
    ("pender",             "Chinatown"),
    ("strathcona",         "Strathcona"),
    ("union st",           "Strathcona"),
    ("e hastings",         "East Vancouver"),
    ("commercial",         "Commercial Drive"),
    ("mount pleasant",     "Mount Pleasant"),
    ("main st",            "Main Street"),
    ("e broadway",         "Mount Pleasant"),
    ("granville",          "Downtown"),
    ("robson",             "Downtown"),
    ("georgia",            "Downtown"),
    ("burrard",            "Downtown"),
    ("davie",              "West End"),
    ("denman",             "West End"),
    ("west end",           "West End"),
]

def infer_neighbourhood(address: str, hint: str) -> str:
    addr_lower = address.lower()
    for fragment, neighbourhood in NEIGHBOURHOOD_HINTS:
        if fragment in addr_lower:
            return neighbourhood
    return hint  # fall back to our manual hint


def price_tier(price_level: Optional[int]) -> int:
    if price_level is None:
        return 2
    if price_level <= 1:
        return 1
    if price_level == 2:
        return 2
    return 3


def search_place(name: str) -> Optional[str]:
    """Returns place_id for the best match in Vancouver."""
    resp = requests.get(
        TEXT_SEARCH_URL,
        params={
            "query": f"{name} Vancouver BC",
            "key": GOOGLE_PLACES_API_KEY,
        },
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        return None
    return results[0]["place_id"]


def fetch_details(place_id: str) -> dict:
    resp = requests.get(
        DETAILS_URL,
        params={
            "place_id": place_id,
            "fields": DETAIL_FIELDS,
            "key": GOOGLE_PLACES_API_KEY,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json().get("result", {})


def build_bar_dict(name: str, hint: str, detail: dict) -> dict:
    loc = detail.get("geometry", {}).get("location", {})
    hours_raw = detail.get("opening_hours", {}).get("weekday_text", [])
    summary = detail.get("editorial_summary", {}).get("overview")

    bar: dict = {
        "google_place_id":       detail["place_id"],
        "name":                  detail.get("name", name),
        "address":               detail.get("formatted_address"),
        "latitude":              loc.get("lat"),
        "longitude":             loc.get("lng"),
        "phone":                 detail.get("formatted_phone_number"),
        "website":               detail.get("website"),
        "opening_hours":         hours_raw or None,
        "average_rating":        detail.get("rating"),
        "review_count":          detail.get("user_ratings_total"),
        "neighbourhood":         infer_neighbourhood(
                                     detail.get("formatted_address", ""), hint
                                 ),
        "price_tier":            price_tier(detail.get("price_level")),
        "is_permanently_closed": detail.get("business_status") == "CLOSED_PERMANENTLY",
    }
    if summary:
        bar["google_summary"] = summary
    return bar


def generate_insert_script(bars: list[dict]) -> str:
    lines = [
        '"""Auto-generated by lookup_new_bars.py — inserts new bars into the bars table."""',
        "import os",
        "from dotenv import load_dotenv",
        "from supabase import create_client",
        "",
        'load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))',
        "sb = create_client(os.environ[\"SUPABASE_URL\"], os.environ[\"SUPABASE_SERVICE_KEY\"])",
        "",
        "bars = [",
    ]
    for bar in bars:
        lines.append("    {")
        for k, v in bar.items():
            lines.append(f"        {k!r}: {v!r},")
        lines.append("    },")
    lines += [
        "]",
        "",
        "for bar in bars:",
        '    existing = sb.table("bars").select("id").eq("google_place_id", bar["google_place_id"]).execute().data',
        "    if existing:",
        '        print(f"  already exists: {bar[\'name\']} ({existing[0][\'id\']})")',
        "        continue",
        '    result = sb.table("bars").insert(bar).execute()',
        '    print(f"  inserted: {bar[\'name\']} → {result.data[0][\'id\']}")',
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--insert", action="store_true", help="Insert into DB immediately after lookup")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if args.insert else None

    resolved: list[dict] = []

    for name, hint in BARS:
        print(f"\nLooking up: {name}...")
        try:
            place_id = search_place(name)
            if not place_id:
                print(f"  ✗ not found on Google Places")
                continue

            detail = fetch_details(place_id)
            bar = build_bar_dict(name, hint, detail)

            print(f"  ✓ {bar['name']}")
            print(f"    address      : {bar['address']}")
            print(f"    neighbourhood: {bar['neighbourhood']}")
            print(f"    rating       : {bar['average_rating']} ({bar['review_count']} reviews)")
            print(f"    price_tier   : {bar['price_tier']}")
            print(f"    place_id     : {bar['google_place_id']}")

            resolved.append(bar)

            if args.insert and sb:
                existing = sb.table("bars").select("id").eq("google_place_id", bar["google_place_id"]).execute().data
                if existing:
                    print(f"  — already in DB ({existing[0]['id']}), skipping insert")
                else:
                    result = sb.table("bars").insert(bar).execute()
                    print(f"  → inserted: {result.data[0]['id']}")

            time.sleep(0.2)  # stay well within Places API rate limits

        except Exception as e:
            print(f"  ✗ error: {e}")

    # Always write the generated insert script for review
    out_path = os.path.join(os.path.dirname(__file__), "insert_bars_new_batch.py")
    with open(out_path, "w") as f:
        f.write(generate_insert_script(resolved))

    print(f"\n{'─'*60}")
    print(f"Resolved {len(resolved)}/{len(BARS)} bars.")
    print(f"Insert script written to: {out_path}")
    if not args.insert:
        print("Review insert_bars_new_batch.py, then run it with: python insert_bars_new_batch.py")
        print("Or re-run this script with --insert to insert directly.")


if __name__ == "__main__":
    main()
