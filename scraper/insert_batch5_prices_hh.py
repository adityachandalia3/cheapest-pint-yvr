"""Insert prices, HH prices, and HH windows for batch 5 bars (5 bars with confirmed price data)."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# ── Price rows ────────────────────────────────────────────────────────────────

prices = [
    # The Galley Patio & Grill (4df1173c)
    {"bar_id": "4df1173c-645a-4db1-9e33-ae6e43d6d13e", "category": "cheapest_beer",  "beer_name": "Phillips Tilt Lager",    "price_cad": 8.75, "pour_size_oz": 16, "verified": True},
    {"bar_id": "4df1173c-645a-4db1-9e33-ae6e43d6d13e", "category": "cheapest_lager", "beer_name": "Phillips Tilt Lager",    "price_cad": 8.75, "pour_size_oz": 16, "verified": True},
    {"bar_id": "4df1173c-645a-4db1-9e33-ae6e43d6d13e", "category": "cheapest_ipa",   "beer_name": "Phillips Reverb IPA",    "price_cad": 8.75, "pour_size_oz": 16, "verified": True},

    # Guilt & Co (e6a9ba3c) — no HH
    {"bar_id": "e6a9ba3c-65ae-4668-a51c-47e34032f356", "category": "cheapest_beer",  "beer_name": "Tilt Lager",             "price_cad": 8.00, "pour_size_oz": 16, "verified": True},
    {"bar_id": "e6a9ba3c-65ae-4668-a51c-47e34032f356", "category": "cheapest_ipa",   "beer_name": "Fluffy Cloud Hazy IPA",  "price_cad": 10.00, "pour_size_oz": 16, "verified": True},

    # The Morrissey (537afcb3) — HH from open to 6pm daily
    {"bar_id": "537afcb3-cea9-4268-8137-9143cc53f0f1", "category": "cheapest_beer",  "beer_name": "Morrissey Lager by Stanley Park", "price_cad": 7.25, "happy_hour_price_cad": 5.50, "pour_size_oz": 14, "verified": True},
    {"bar_id": "537afcb3-cea9-4268-8137-9143cc53f0f1", "category": "cheapest_lager", "beer_name": "Morrissey Lager by Stanley Park", "price_cad": 7.25, "happy_hour_price_cad": 5.50, "pour_size_oz": 14, "verified": True},
    {"bar_id": "537afcb3-cea9-4268-8137-9143cc53f0f1", "category": "cheapest_ipa",   "beer_name": "Stanley Park Parklandia Hazy IPA", "price_cad": 7.75, "pour_size_oz": 14, "verified": True},

    # Lions Pub (04372a79) — HH applies to different beers (Driftwood/Phillips/Parkside), skipped here
    {"bar_id": "04372a79-4bfe-419a-90df-ff1a992e57cd", "category": "cheapest_beer",  "beer_name": "Miller Lite",            "price_cad": 9.50, "pour_size_oz": 20, "verified": True},
    {"bar_id": "04372a79-4bfe-419a-90df-ff1a992e57cd", "category": "cheapest_lager", "beer_name": "Miller Lite",            "price_cad": 9.50, "pour_size_oz": 20, "verified": True},
    {"bar_id": "04372a79-4bfe-419a-90df-ff1a992e57cd", "category": "cheapest_ipa",   "beer_name": "33 Acres Fluffy Cloud IPA", "price_cad": 9.50, "pour_size_oz": 20, "verified": True},

    # The Ballyhoo Public House (67ec9978) — HH Mon-Fri 3-6pm + Sun-Thu 9pm-midnight
    {"bar_id": "67ec9978-8595-4c52-a920-46308149c61f", "category": "cheapest_beer",  "beer_name": "Asahi Super Dry", "price_cad": 9.75, "happy_hour_price_cad": 5.00, "pour_size_oz": 15, "verified": True},
    {"bar_id": "67ec9978-8595-4c52-a920-46308149c61f", "category": "cheapest_lager", "beer_name": "Asahi Super Dry", "price_cad": 9.75, "happy_hour_price_cad": 5.00, "pour_size_oz": 15, "verified": True},
]

print("── Inserting price rows ──")
for p in prices:
    r = sb.table("pint_prices").insert(p).execute()
    print(f"  ✓ {p['category']:16s} {p['beer_name']:45s} ${p['price_cad']:.2f}  →  {r.data[0]['id']}")

# ── HH windows ───────────────────────────────────────────────────────────────

windows = [
    # Morrissey: opens 4pm Mon–Sat → HH 16:00–18:00
    {"bar_id": "537afcb3-cea9-4268-8137-9143cc53f0f1", "days": ["mon","tue","wed","thu","fri","sat"], "start_time": "16:00:00", "end_time": "18:00:00", "notes": "From open to 6pm"},
    # Morrissey: opens 5pm Sun → HH 17:00–18:00
    {"bar_id": "537afcb3-cea9-4268-8137-9143cc53f0f1", "days": ["sun"], "start_time": "17:00:00", "end_time": "18:00:00", "notes": "From open to 6pm (Sunday)"},

    # Ballyhoo: Mon–Fri 3–6pm
    {"bar_id": "67ec9978-8595-4c52-a920-46308149c61f", "days": ["mon","tue","wed","thu","fri"], "start_time": "15:00:00", "end_time": "18:00:00", "notes": "$5 beer"},
    # Ballyhoo: Sun–Thu 9pm–midnight
    {"bar_id": "67ec9978-8595-4c52-a920-46308149c61f", "days": ["sun","mon","tue","wed","thu"], "start_time": "21:00:00", "end_time": "23:59:59", "notes": "$5 beer late night"},
]

print("\n── Inserting HH windows ──")
for w in windows:
    r = sb.table("happy_hour_windows").insert(w).execute()
    print(f"  ✓ {w['bar_id'][:8]}… {w['days']}  {w['start_time']}–{w['end_time']}")
