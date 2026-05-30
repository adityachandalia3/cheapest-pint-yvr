"""
Insert prices, HH prices, and happy_hour_windows for batch 4 bars.
The Pint, Six Acres, The Cascade Room, Sing Sing, Strathcona Beer Co,
Tap & Barrel OV, The Narrow Lounge, The Flying Pig Yaletown.
(Andina + Powell marked permanently closed, skipped.)
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

PINT       = "1d9202b0-ca3a-421f-bebb-cdaa6a56fb47"
SIX_ACRES  = "aab39350-e554-4023-8219-c505920b0852"
CASCADE    = "b6e224a9-c9da-4858-a46f-5b711f63f965"
SINGSING   = "f453b7fa-999b-4ec0-9a9c-5d26efa48ef0"
STRATH     = "55e11c10-4f10-4b6d-85fc-ec08729b4a8b"
TB_OV      = "d75edd4c-e7b9-4969-bc38-239f655d89c8"
NARROW     = "6868f4a2-a004-4001-a994-ec8d40a45a5b"
FLYING_PIG = "74b94a53-9ba6-4724-81b5-f57af1d42e57"

# ── Regular prices ────────────────────────────────────────────────────────────
prices = [
    # The Pint — 18oz house lager
    dict(bar_id=PINT, category="cheapest_beer",  beer_name="House Lager",                    price_cad=7.20, pour_size_oz=18, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=PINT, category="cheapest_lager", beer_name="House Lager",                    price_cad=7.20, pour_size_oz=18, verified=True, confidence="high", source_section="main_menu"),
    # Six Acres — 16oz, no draught IPA
    dict(bar_id=SIX_ACRES, category="cheapest_beer",  beer_name="6A Lager",                  price_cad=9.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=SIX_ACRES, category="cheapest_lager", beer_name="6A Lager",                  price_cad=9.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # The Cascade Room — Main Street Brewing beers, all 16oz @ $8
    dict(bar_id=CASCADE, category="cheapest_beer",  beer_name="Main Street Premium Pilsner", price_cad=8.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=CASCADE, category="cheapest_lager", beer_name="Krush Crisp Lager",           price_cad=8.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=CASCADE, category="cheapest_ipa",   beer_name="Naked Fox West Coast IPA",    price_cad=8.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # Sing Sing — 16oz
    dict(bar_id=SINGSING, category="cheapest_beer",  beer_name="Lucky Lager",                price_cad=8.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=SINGSING, category="cheapest_lager", beer_name="Lucky Lager",                price_cad=8.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=SINGSING, category="cheapest_ipa",   beer_name="Hoyne Shine On IPA",         price_cad=8.25, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # Strathcona Beer Co — 14oz
    dict(bar_id=STRATH, category="cheapest_beer",  beer_name="Strath Lager",                 price_cad=6.10, pour_size_oz=14, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STRATH, category="cheapest_lager", beer_name="Strath Lager",                 price_cad=6.10, pour_size_oz=14, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STRATH, category="cheapest_ipa",   beer_name="Big Sexy Funk Hazy IPA",       price_cad=6.10, pour_size_oz=14, verified=True, confidence="high", source_section="main_menu"),
    # Tap & Barrel Olympic Village — 16oz (same as Bridges location)
    dict(bar_id=TB_OV, category="cheapest_beer",  beer_name="Red Truck La Strada Pilsner",   price_cad=8.50, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=TB_OV, category="cheapest_lager", beer_name="Phillips Tilt Lager",           price_cad=8.50, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=TB_OV, category="cheapest_ipa",   beer_name="BREWHALL Hall Pass IPA",        price_cad=9.50, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # The Narrow Lounge — 16oz, no IPA
    dict(bar_id=NARROW, category="cheapest_beer",  beer_name="PBR",                          price_cad=7.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=NARROW, category="cheapest_lager", beer_name="PBR",                          price_cad=7.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # The Flying Pig Yaletown — 16oz
    dict(bar_id=FLYING_PIG, category="cheapest_beer",  beer_name="TFP Lager (Russell Brewing)", price_cad=7.25, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=FLYING_PIG, category="cheapest_lager", beer_name="TFP Lager (Russell Brewing)", price_cad=7.25, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=FLYING_PIG, category="cheapest_ipa",   beer_name="Happyness IPA (Superflux)",   price_cad=10.00, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
]

print("── Inserting regular prices ──")
result = sb.table("pint_prices").insert(prices).execute()
id_map = {(r["bar_id"], r["category"]): r["id"] for r in result.data}
print(f"  {len(result.data)} rows inserted")

# ── HH price updates ──────────────────────────────────────────────────────────
hh_updates = [
    # The Pint — $6 house lager HH
    (PINT,       "cheapest_beer",  6.00),
    (PINT,       "cheapest_lager", 6.00),
    # Six Acres — $7 house beers HH
    (SIX_ACRES,  "cheapest_beer",  7.00),
    (SIX_ACRES,  "cheapest_lager", 7.00),
    # Cascade Room — $6 all draught HH
    (CASCADE,    "cheapest_beer",  6.00),
    (CASCADE,    "cheapest_lager", 6.00),
    (CASCADE,    "cheapest_ipa",   6.00),
    # Sing Sing — $5 lager cans HH
    (SINGSING,   "cheapest_beer",  5.00),
    (SINGSING,   "cheapest_lager", 5.00),
    # Tap & Barrel OV — same as Bridges location
    (TB_OV,      "cheapest_beer",  5.00),
    (TB_OV,      "cheapest_lager", 5.00),
    (TB_OV,      "cheapest_ipa",   6.25),
    # The Narrow Lounge — $5 PBR HH
    (NARROW,     "cheapest_beer",  5.00),
    (NARROW,     "cheapest_lager", 5.00),
    # The Flying Pig — $5.75 TFP Lager HH
    (FLYING_PIG, "cheapest_beer",  5.75),
    (FLYING_PIG, "cheapest_lager", 5.75),
]

print("\n── Updating HH prices ──")
for bar_id, cat, hh_price in hh_updates:
    row_id = id_map.get((bar_id, cat))
    if not row_id:
        print(f"  ⚠  no row found for {bar_id[:8]}/{cat}")
        continue
    sb.table("pint_prices").update({"happy_hour_price_cad": hh_price}).eq("id", row_id).execute()
    print(f"  ✓  {bar_id[:8]}… / {cat}: HH ${hh_price:.2f}")

# ── Happy hour windows ────────────────────────────────────────────────────────
windows = [
    # The Pint — Sun–Thu 3–5pm + Sun–Thu 9–11pm
    dict(bar_id=PINT, days=["Sun","Mon","Tue","Wed","Thu"],
         start_time="15:00", end_time="17:00", notes="$6 house lager"),
    dict(bar_id=PINT, days=["Sun","Mon","Tue","Wed","Thu"],
         start_time="21:00", end_time="23:00", notes="$6 house lager late night"),
    # Six Acres — Mon–Sat 3–6pm
    dict(bar_id=SIX_ACRES, days=["Mon","Tue","Wed","Thu","Fri","Sat"],
         start_time="15:00", end_time="18:00", notes="$7 house beers 16oz"),
    # Cascade Room — all day Mon (from open) + Tue–Sat 4–6pm
    dict(bar_id=CASCADE, days=["Mon"],
         start_time="16:00", end_time="23:00", notes="$6 draught all day Monday"),
    dict(bar_id=CASCADE, days=["Tue","Wed","Thu","Fri","Sat"],
         start_time="16:00", end_time="18:00", notes="$6 draught"),
    # Sing Sing — Mon–Fri 2–5pm
    dict(bar_id=SINGSING, days=["Mon","Tue","Wed","Thu","Fri"],
         start_time="14:00", end_time="17:00", notes="$5 lager cans"),
    # Strathcona Beer Co — all day Sun + Mon–Thu 2–5pm + Mon–Thu 8–9pm
    dict(bar_id=STRATH, days=["Sun"],
         start_time="12:00", end_time="22:00", notes="All day Sunday happy hour"),
    dict(bar_id=STRATH, days=["Mon","Tue","Wed","Thu"],
         start_time="14:00", end_time="17:00", notes="Happy hour"),
    dict(bar_id=STRATH, days=["Mon","Tue","Wed","Thu"],
         start_time="20:00", end_time="21:00", notes="Happy hour"),
    # Tap & Barrel OV — same as Bridges: daily 2–5:30pm + 9pm–close
    dict(bar_id=TB_OV, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="14:00", end_time="17:30", notes="Happy hour"),
    dict(bar_id=TB_OV, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="21:00", end_time="23:59", notes="9PM–Close happy hour"),
    # The Narrow Lounge — daily from open until 7pm
    dict(bar_id=NARROW, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="17:00", end_time="19:00", notes="$5 PBR pint 16oz"),
    # The Flying Pig — daily 3–6pm + 9pm–close
    dict(bar_id=FLYING_PIG, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="15:00", end_time="18:00", notes="$5.75 TFP Lager & Pale Ale"),
    dict(bar_id=FLYING_PIG, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="21:00", end_time="23:59", notes="$5.75 TFP Lager & Pale Ale late night"),
]

print("\n── Inserting happy_hour_windows ──")
result = sb.table("happy_hour_windows").insert(windows).execute()
for r in result.data:
    print(f"  ✓  {r['bar_id'][:8]}… | {', '.join(r['days'])} | {r['start_time']}–{r['end_time']} | {r.get('notes','')}")

print("\nDone.")
