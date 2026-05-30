"""
Writes regular prices, HH prices, and happy_hour_windows for batch 2 bars.
Main Street Brewing, Yaletown Brewing, Steamworks, R&B Brewing, Alibi Room.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

MAIN_ST    = "48826f25-7446-4062-b543-3f5d0e01be36"
YALETOWN   = "eaafc0f1-9952-46d0-844f-286eddb6fca7"
STEAMWORKS = "84fc3cb7-f8af-4aa7-8f41-7137b3d63f67"
RNB        = "8cfaf89d-ebf9-49e1-8fa7-529961bd35ea"
ALIBI      = "f98d1174-4e99-40c6-8a9d-a7e849dc826a"

# ── Regular prices ────────────────────────────────────────────────────────────
prices = [
    # Main Street Brewing — all 16oz @ $7.00
    dict(bar_id=MAIN_ST, category="cheapest_beer",  beer_name="Main Street Pilsner",        price_cad=7.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=MAIN_ST, category="cheapest_lager", beer_name="Krush Crisp Lager",           price_cad=7.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=MAIN_ST, category="cheapest_ipa",   beer_name="Naked Fox West Coast IPA",    price_cad=7.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # Yaletown Brewing — all 16oz @ $8.75
    dict(bar_id=YALETOWN, category="cheapest_beer",  beer_name="604 Lager",          price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=YALETOWN, category="cheapest_lager", beer_name="604 Lager",          price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=YALETOWN, category="cheapest_ipa",   beer_name="Loading Bay IPA",    price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # Steamworks — 15oz sleeve @ $7.75
    dict(bar_id=STEAMWORKS, category="cheapest_beer",  beer_name="Lions Gate Lager", price_cad=7.75, pour_size_oz=15, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STEAMWORKS, category="cheapest_lager", beer_name="Lions Gate Lager", price_cad=7.75, pour_size_oz=15, verified=True, confidence="high", source_section="main_menu"),
    # R&B Brewing — 20oz @ $9.75
    dict(bar_id=RNB, category="cheapest_beer",  beer_name="Stolen Bike Lager", price_cad=9.75, pour_size_oz=20, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=RNB, category="cheapest_lager", beer_name="Stolen Bike Lager", price_cad=9.75, pour_size_oz=20, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=RNB, category="cheapest_ipa",   beer_name="Hipster Haze IPA",  price_cad=9.75, pour_size_oz=20, verified=True, confidence="high", source_section="main_menu"),
    # Alibi Room — 16oz
    dict(bar_id=ALIBI, category="cheapest_beer",  beer_name="Alibi Lager",  price_cad=9.25,  pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=ALIBI, category="cheapest_lager", beer_name="Alibi Lager",  price_cad=9.25,  pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=ALIBI, category="cheapest_ipa",   beer_name="Outspoken",    price_cad=11.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
]

print("── Inserting regular prices ──")
result = sb.table("pint_prices").insert(prices).execute()
id_map = {(r["bar_id"], r["category"]): r["id"] for r in result.data}
print(f"  {len(result.data)} rows inserted")

# ── HH price updates ──────────────────────────────────────────────────────────
hh_updates = [
    # Main Street — $6 all HH beers
    (MAIN_ST,    "cheapest_beer",  6.00, None),
    (MAIN_ST,    "cheapest_lager", 6.00, None),
    (MAIN_ST,    "cheapest_ipa",   6.00, None),
    # Yaletown — $6.95 all house beers
    (YALETOWN,   "cheapest_beer",  6.95, None),
    (YALETOWN,   "cheapest_lager", 6.95, None),
    (YALETOWN,   "cheapest_ipa",   6.95, None),
    # Steamworks — $6 sleeve (Lions Gate Lager same beer)
    (STEAMWORKS, "cheapest_beer",  6.00, None),
    (STEAMWORKS, "cheapest_lager", 6.00, None),
    # Alibi — $2 off regular price
    (ALIBI,      "cheapest_beer",  7.25, None),
    (ALIBI,      "cheapest_lager", 7.25, None),
    (ALIBI,      "cheapest_ipa",   9.75, None),
]

print("\n── Updating HH prices ──")
for bar_id, cat, hh_price, hh_beer in hh_updates:
    row_id = id_map.get((bar_id, cat))
    if not row_id:
        print(f"  ⚠  no row found for {bar_id[:8]}/{cat}")
        continue
    update = {"happy_hour_price_cad": hh_price}
    if hh_beer:
        update["happy_hour_beer_name"] = hh_beer
    sb.table("pint_prices").update(update).eq("id", row_id).execute()
    print(f"  ✓  {bar_id[:8]}… / {cat}: HH ${hh_price:.2f}")

# ── Happy hour windows ────────────────────────────────────────────────────────
windows = [
    # Main Street — all day Monday + Tue-Sun 2-6pm
    dict(bar_id=MAIN_ST, days=["Mon"],
         start_time="12:00", end_time="22:00", notes="All day Monday, $6 pints"),
    dict(bar_id=MAIN_ST, days=["Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="14:00", end_time="18:00", notes="$6 pints"),
    # Yaletown — Mon-Sat 3-6pm + all day Sunday
    dict(bar_id=YALETOWN, days=["Mon","Tue","Wed","Thu","Fri","Sat"],
         start_time="15:00", end_time="18:00", notes="$6.95 all house beers 16oz"),
    dict(bar_id=YALETOWN, days=["Sun"],
         start_time="11:30", end_time="23:00", notes="All day HH (Pizza Sunday), $6.95 all house beers 16oz"),
    # Steamworks — daily 3-5pm
    dict(bar_id=STEAMWORKS, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="15:00", end_time="17:00", notes="Lions Gate Lager & Pale Ale $6 sleeve"),
    # Alibi Room — daily 4-6pm
    dict(bar_id=ALIBI, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="16:00", end_time="18:00", notes="$2 off any beer"),
]

print("\n── Inserting happy_hour_windows ──")
result = sb.table("happy_hour_windows").insert(windows).execute()
for r in result.data:
    print(f"  ✓  {r['bar_id'][:8]}… | {', '.join(r['days'])} | {r['start_time']}–{r['end_time']} | {r.get('notes','')}")

print("\nDone.")
