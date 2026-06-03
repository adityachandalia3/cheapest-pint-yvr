"""
HH windows + HH prices for the 11 new bars.
Windows for Back and Forth and Chickadee were discovered by the scraper.
All others need manual windows from user — placeholders marked TODO.
Run from scraper/ directory.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

BUTCHER_BULLOCK  = "7adb4b79-f811-4988-85eb-85c2065f1dee"
LIBRARY_SQUARE   = "9a39c6a6-9381-4ce8-9428-e7244a0cbdb8"
WATSON           = "a506c163-8cf1-48bb-8c8c-41fef36c4da7"
CHICKADEE        = "903646f3-28b6-41c3-8f5a-08486a8bea86"
BACK_FORTH       = "ef2abdd4-4136-4cf4-8acf-92306ac6aaa0"

ALL_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

# ── 1. HH Windows (scraped + known) ─────────────────────────────────────────
windows = [
    # Back and Forth — scraped: daily 5–6pm
    {"bar_id": BACK_FORTH, "days": ALL_DAYS, "start_time": "17:00", "end_time": "18:00", "notes": "$6 happy hour drinks"},
    # Chickadee Room — scraped: daily 4–6pm + late night 10pm–close
    {"bar_id": CHICKADEE, "days": ALL_DAYS, "start_time": "16:00", "end_time": "18:00", "notes": "Happy Hour 4–6pm, seven days a week"},
    {"bar_id": CHICKADEE, "days": ALL_DAYS, "start_time": "22:00", "end_time": "23:59", "notes": "Late Night Deals 10pm–close"},
]

print("── Inserting HH windows ──")
for w in windows:
    # Clear existing windows for this bar first to avoid duplicates
    sb.table("happy_hour_windows").delete().eq("bar_id", w["bar_id"]).eq("start_time", w["start_time"]).execute()
    result = sb.table("happy_hour_windows").insert(w).execute()
    r = result.data[0]
    print(f"  ✓ {w['bar_id'][:8]}… | {','.join(r['days'])} | {r['start_time']}–{r['end_time']} | {r.get('notes','')}")

# ── 2. Update Library Square regular prices ──────────────────────────────────
# User confirmed: Library Lager $7.50 16oz is the regular beer/lager
print("\n── Updating Library Square regular prices ──")
for cat in ("cheapest_beer", "cheapest_lager"):
    sb.table("pint_prices").update({
        "beer_name": "Library Lager",
        "price_cad": 7.50,
        "pour_size_oz": 16.0,
    }).eq("bar_id", LIBRARY_SQUARE).eq("category", cat).execute()
    print(f"  ✓ Library Square [{cat}] Library Lager — $7.50 / 16oz")

# ── 3. HH price updates ──────────────────────────────────────────────────────
hh_updates = [
    # Butcher & Bullock — $5 craft lager HH
    (BUTCHER_BULLOCK, "cheapest_beer",  5.00, "Craft Lager"),
    (BUTCHER_BULLOCK, "cheapest_lager", 5.00, "Craft Lager"),
    # Library Square — Fuggle pints $6 HH
    (LIBRARY_SQUARE,  "cheapest_beer",  6.00, "Fuggle"),
    (LIBRARY_SQUARE,  "cheapest_lager", 6.00, "Fuggle"),
    # The Watson — draught beer $6.75 HH
    (WATSON,          "cheapest_beer",  6.75, "Draught Beer"),
    (WATSON,          "cheapest_lager", 6.75, "Draught Beer"),
    # Chickadee Room — Twin Sails Lager $7.50 HH
    (CHICKADEE,       "cheapest_lager", 7.50, "Twin Sails Lager"),
]

NAMES = {
    BUTCHER_BULLOCK: "Butcher & Bullock",
    LIBRARY_SQUARE:  "Library Square",
    WATSON:          "The Watson",
    CHICKADEE:       "The Chickadee Room",
}

print("\n── Updating HH prices ──")
for bar_id, cat, hh_price, hh_beer in hh_updates:
    sb.table("pint_prices").update({
        "happy_hour_price_cad": hh_price,
        "happy_hour_beer_name": hh_beer,
    }).eq("bar_id", bar_id).eq("category", cat).execute()
    print(f"  ✓ {NAMES[bar_id]} [{cat}] {hh_beer} — HH ${hh_price:.2f}")

print("\nDone.")
