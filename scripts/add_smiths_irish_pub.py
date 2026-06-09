#!/usr/bin/env python3
"""Insert Smith's Irish Pub with prices and happy hour windows. Run with --dry-run first."""

import os
import sys
from supabase import create_client

DRY_RUN = "--dry-run" in sys.argv

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

client = create_client(SUPABASE_URL, SUPABASE_KEY)

BAR = {
    "name": "Smith's Irish Pub",
    "address": "208 Carrall St, Vancouver, BC V6B 2J1",
    "latitude": 49.2827,
    "longitude": -123.1043,
    "neighbourhood": "Gastown & Chinatown",
    "website": "https://www.smithsofgastown.ca/",
    "phone": "236-521-8381",
    "is_permanently_closed": False,
    "google_place_id": "manual_smiths_irish_pub_gastown",
}

# Regular pint: Smith's Lager 20oz $8.99
# Happy hour pint (16oz): $5.40 — price per oz scales, but we store the actual poured price
PRICES = [
    {
        "category": "cheapest_beer",
        "beer_name": "Smith's Lager",
        "price_cad": 8.99,
        "pour_size_oz": 20.0,
        "happy_hour_price_cad": None,
        "source_url": "https://www.smithsofgastown.ca/",
    },
    {
        "category": "cheapest_lager",
        "beer_name": "Smith's Lager",
        "price_cad": 8.99,
        "pour_size_oz": 20.0,
        "happy_hour_price_cad": None,
        "source_url": "https://www.smithsofgastown.ca/",
    },
]

# Mon–Fri 3–6pm standard HH; Wed also runs 12pm–11pm (stored as two windows)
HH_WINDOWS = [
    {
        "days": ["mon", "tue", "wed", "thu", "fri"],
        "start_time": "15:00:00",
        "end_time": "18:00:00",
        "notes": "$5.40 pints (16oz), $6.75 highballs, $6.04 house wine",
    },
    {
        "days": ["wed"],
        "start_time": "12:00:00",
        "end_time": "23:00:00",
        "notes": "Wednesday all-day: $5.40 pints, $6.75 highballs, $6.04 house wine",
    },
]

# ---------------------------------------------------------------------------
# Check if already exists
# ---------------------------------------------------------------------------
existing = client.table("bars").select("id, name").ilike("name", "%Smith%Irish%").execute()
if existing.data:
    print(f"Bar already exists: {existing.data}")
    sys.exit(0)

print("=== Smith's Irish Pub — dry run ===" if DRY_RUN else "=== Smith's Irish Pub — INSERTING ===")
print()
print("BAR:")
for k, v in BAR.items():
    print(f"  {k}: {v}")
print()
print("PRICES:")
for p in PRICES:
    print(f"  [{p['category']}] {p['beer_name']} ${p['price_cad']} / {p['pour_size_oz']}oz  (HH: ${p['happy_hour_price_cad']})")
print()
print("HAPPY HOUR WINDOWS:")
for w in HH_WINDOWS:
    print(f"  days: {', '.join(w['days'])}")
    print(f"  time: {w['start_time']} – {w['end_time']}")
    print(f"  notes: {w['notes']}")
    print()

if DRY_RUN:
    print("Dry run complete — pass no flag to execute.")
    sys.exit(0)

# ---------------------------------------------------------------------------
# Insert bar
# ---------------------------------------------------------------------------
result = client.table("bars").insert(BAR).execute()
bar_id = result.data[0]["id"]
print(f"Inserted bar: {bar_id}")

# ---------------------------------------------------------------------------
# Insert prices
# ---------------------------------------------------------------------------
price_rows = [
    {
        "bar_id": bar_id,
        "category": p["category"],
        "beer_name": p["beer_name"],
        "price_cad": p["price_cad"],
        "pour_size_oz": p["pour_size_oz"],
        "happy_hour_price_cad": p["happy_hour_price_cad"],
        "source_url": p["source_url"],
        "verified": True,
    }
    for p in PRICES
]
client.table("pint_prices").insert(price_rows).execute()
print(f"Inserted {len(price_rows)} price rows")

# ---------------------------------------------------------------------------
# Insert happy hour windows
# ---------------------------------------------------------------------------
for w in HH_WINDOWS:
    client.table("happy_hour_windows").insert({
        "bar_id": bar_id,
        "days": w["days"],
        "start_time": w["start_time"],
        "end_time": w["end_time"],
        "notes": w["notes"],
    }).execute()
print(f"Inserted {len(HH_WINDOWS)} HH windows")

print()
print(f"Done. Bar ID: {bar_id}")
print(f"Next: run vibe profiler — cd scraper && python vibe_profiler.py --bar-id {bar_id}")
