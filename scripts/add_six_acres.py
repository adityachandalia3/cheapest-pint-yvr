#!/usr/bin/env python3
"""Insert Six Acres bar with prices and happy hour windows. Run with --dry-run first."""

import os
import sys
from supabase import create_client

DRY_RUN = "--dry-run" in sys.argv

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

client = create_client(SUPABASE_URL, SUPABASE_KEY)

BAR = {
    "name": "Six Acres",
    "address": "203 Carrall St, Vancouver, BC V6A 2J2",
    "latitude": 49.28338,
    "longitude": -123.10562,
    "neighbourhood": "Gastown & Chinatown",
    "website": "https://www.sixacres.ca/",
    "phone": "604-488-0110",
    "is_permanently_closed": False,
}

# Draught pints from https://www.sixacres.ca/drinks
# Happy hour price from https://www.sixacres.ca/happy-hour (Mon–Sat 3–6pm: $7/16oz)
PRICES = [
    {"category": "cheapest_beer",  "beer_name": "6A Lager",              "price_cad": 9.00, "pour_size_oz": 16.0, "happy_hour_price_cad": 7.00, "source_url": "https://www.sixacres.ca/drinks"},
    {"category": "cheapest_lager", "beer_name": "6A Lager",              "price_cad": 9.00, "pour_size_oz": 16.0, "happy_hour_price_cad": 7.00, "source_url": "https://www.sixacres.ca/drinks"},
    {"category": "cheapest_ipa",   "beer_name": "Rotating Craft Beer",   "price_cad": 9.50, "pour_size_oz": 16.0, "happy_hour_price_cad": None,  "source_url": "https://www.sixacres.ca/drinks"},
]

HH_WINDOW = {
    "days": ["mon", "tue", "wed", "thu", "fri", "sat"],
    "start_time": "15:00:00",
    "end_time": "18:00:00",
    "notes": "$7 pints (16oz), $7 house wine, $7 highballs, $12 cocktails",
}

# ---------------------------------------------------------------------------
# Check if already exists
# ---------------------------------------------------------------------------
existing = client.table("bars").select("id, name").ilike("name", "Six Acres").execute()
if existing.data:
    print(f"Bar already exists: {existing.data}")
    sys.exit(0)

print("=== Six Acres — dry run ===" if DRY_RUN else "=== Six Acres — INSERTING ===")
print()
print("BAR:")
for k, v in BAR.items():
    print(f"  {k}: {v}")
print()
print("PRICES:")
for p in PRICES:
    print(f"  [{p['category']}] {p['beer_name']} ${p['price_cad']} / {p['pour_size_oz']}oz  (HH: ${p['happy_hour_price_cad']})")
print()
print("HAPPY HOUR WINDOW:")
print(f"  days: {', '.join(HH_WINDOW['days'])}")
print(f"  time: {HH_WINDOW['start_time']} – {HH_WINDOW['end_time']}")
print(f"  notes: {HH_WINDOW['notes']}")
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
# Insert happy hour window
# ---------------------------------------------------------------------------
client.table("happy_hour_windows").insert({
    "bar_id": bar_id,
    "days": HH_WINDOW["days"],
    "start_time": HH_WINDOW["start_time"],
    "end_time": HH_WINDOW["end_time"],
    "notes": HH_WINDOW["notes"],
}).execute()
print("Inserted HH window")

print()
print(f"Done. Bar ID: {bar_id}")
print(f"Next: run vibe profiler — cd scraper && python vibe_profiler.py --bar-id {bar_id}")
