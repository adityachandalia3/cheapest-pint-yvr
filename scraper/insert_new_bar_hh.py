"""
One-shot: writes HH prices + happy_hour_windows for Brassneck and King's Head.
Regal Beagle and 33 Acres have no HH found — skipped.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

BRASSNECK  = "82d86b28-a923-4cc5-99f6-bcdc7c207599"
KINGS_HEAD = "e576670f-e37d-4133-a617-1a51f665e8a1"

# ── 1. Update pint_prices HH fields ─────────────────────────────────────────

hh_updates = [
    # Brassneck — $6 flat for any beer, 12oz
    (BRASSNECK,  "cheapest_beer", 6.00, None),
    (BRASSNECK,  "cheapest_ipa",  6.00, None),
    # King's Head — Lager $5 (Tue daily special / HH), Fat Tug $7.50 (Wed)
    (KINGS_HEAD, "cheapest_beer",  5.00, "King's Head Lager"),
    (KINGS_HEAD, "cheapest_lager", 5.00, "King's Head Lager"),
    (KINGS_HEAD, "cheapest_ipa",   7.50, "Fat Tug"),
]

print("── pint_prices HH updates ──")
for bar_id, cat, hh_price, hh_beer in hh_updates:
    rows = sb.table("pint_prices").select("id, beer_name").eq("bar_id", bar_id).eq("category", cat).execute().data
    if not rows:
        print(f"  ⚠  no row for {bar_id[:8]} / {cat}")
        continue
    update = {"happy_hour_price_cad": hh_price}
    if hh_beer is not None:
        update["happy_hour_beer_name"] = hh_beer
    sb.table("pint_prices").update(update).eq("id", rows[0]["id"]).execute()
    beer_label = hh_beer or rows[0]["beer_name"] or "rotating tap"
    print(f"  ✓  {bar_id[:8]}… / {cat}: {beer_label} @ ${hh_price:.2f} HH")

# ── 2. Insert happy_hour_windows ─────────────────────────────────────────────

windows = [
    # Brassneck — two separate windows
    dict(bar_id=BRASSNECK, days=["Sun","Mon","Tue","Wed","Thu","Fri"],
         start_time="14:00", end_time="17:00", notes="$6 beers"),
    dict(bar_id=BRASSNECK, days=["Sat"],
         start_time="12:00", end_time="14:00", notes="$6 beers"),
    # King's Head — daily afternoon + late night
    dict(bar_id=KINGS_HEAD, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="15:00", end_time="18:00",
         notes="Daily specials vary by day — Tue: Lager $5, Wed: Fat Tug $7.50, Sat: Blue Buck $6.50"),
    dict(bar_id=KINGS_HEAD, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="21:00", end_time="23:59",
         notes="Daily specials vary by day — 9pm to close"),
]

print("\n── happy_hour_windows inserts ──")
result = sb.table("happy_hour_windows").insert(windows).execute()
for r in result.data:
    days = ", ".join(r["days"])
    print(f"  ✓  {r['bar_id'][:8]}… | {days} | {r['start_time']}–{r['end_time']} | {r.get('notes','')}")

print("\nDone.")
