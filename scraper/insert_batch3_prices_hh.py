"""
Insert prices, HH prices, and happy_hour_windows for batch 3 bars.
St. Augustine's, Strange Fellows, The Lamplighter, CRAFT Beer Market False Creek.
(Parallel 49 — no price data available, skipped.)
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

STAUGUSTINES = "d79a84fb-6ef7-43fa-bc29-ab399c532487"
STRANGE      = "8a059d22-47b0-4167-a925-cffa3d220454"
LAMPLIGHTER  = "5fbbbe4f-74c2-4293-9c10-7d884e5a2abe"
CRAFT        = "11ba6b85-6948-431e-8be4-a53a41432787"

# ── Regular prices ────────────────────────────────────────────────────────────
prices = [
    # St. Augustine's — 16oz @ $8.75
    dict(bar_id=STAUGUSTINES, category="cheapest_beer",  beer_name="Premium Rice Lager",        price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STAUGUSTINES, category="cheapest_lager", beer_name="Premium Rice Lager",        price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STAUGUSTINES, category="cheapest_ipa",   beer_name="Beyond The Peel Juicy IPA", price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    # Strange Fellows — 12oz
    dict(bar_id=STRANGE, category="cheapest_beer",  beer_name="Scarab Superdry Lager",    price_cad=5.25, pour_size_oz=12, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STRANGE, category="cheapest_lager", beer_name="Beldame Old World Pilsner", price_cad=5.25, pour_size_oz=12, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=STRANGE, category="cheapest_ipa",   beer_name="Silva West Coast IPA",     price_cad=6.25, pour_size_oz=12, verified=True, confidence="high", source_section="main_menu"),
    # The Lamplighter — 15oz
    dict(bar_id=LAMPLIGHTER, category="cheapest_beer",  beer_name="Molson Canadian", price_cad=9.00, pour_size_oz=15, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=LAMPLIGHTER, category="cheapest_lager", beer_name="Molson Canadian", price_cad=9.00, pour_size_oz=15, verified=True, confidence="high", source_section="main_menu"),
    # CRAFT Beer Market False Creek — 16oz
    dict(bar_id=CRAFT, category="cheapest_beer",  beer_name="Hatching Post Five Joaquins Mexican Salted Lime Lager", price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=CRAFT, category="cheapest_lager", beer_name="Hatching Post Five Joaquins Mexican Salted Lime Lager", price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=CRAFT, category="cheapest_ipa",   beer_name="August Blonde IPA",                                    price_cad=8.75, pour_size_oz=16, verified=True, confidence="high", source_section="main_menu"),
]

print("── Inserting regular prices ──")
result = sb.table("pint_prices").insert(prices).execute()
id_map = {(r["bar_id"], r["category"]): r["id"] for r in result.data}
print(f"  {len(result.data)} rows inserted")

# ── HH price updates ──────────────────────────────────────────────────────────
hh_updates = [
    # St. Augustine's — $6 house beers HH
    (STAUGUSTINES, "cheapest_beer",  6.00),
    (STAUGUSTINES, "cheapest_lager", 6.00),
    (STAUGUSTINES, "cheapest_ipa",   6.00),
    # Lamplighter — $5 HH pints
    (LAMPLIGHTER,  "cheapest_beer",  5.00),
    (LAMPLIGHTER,  "cheapest_lager", 5.00),
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
    # St. Augustine's — 2–5pm daily + late-night Mon–Thu 9pm–1am, Fri–Sat 10pm–1am
    dict(bar_id=STAUGUSTINES, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="14:00", end_time="17:00", notes="$6 house beers"),
    dict(bar_id=STAUGUSTINES, days=["Mon","Tue","Wed","Thu"],
         start_time="21:00", end_time="01:00", notes="$6 house beers late night"),
    dict(bar_id=STAUGUSTINES, days=["Fri","Sat"],
         start_time="22:00", end_time="01:00", notes="$6 house beers late night"),
    # Strange Fellows — 12–4pm Mon–Thu
    dict(bar_id=STRANGE, days=["Mon","Tue","Wed","Thu"],
         start_time="12:00", end_time="16:00", notes="Happy hour pricing on all taps"),
    # Lamplighter — 3–6pm Wed–Sun + Power Hour Fri–Sat 9:30–10:30pm
    dict(bar_id=LAMPLIGHTER, days=["Wed","Thu","Fri","Sat","Sun"],
         start_time="15:00", end_time="18:00", notes="$5 pints"),
    dict(bar_id=LAMPLIGHTER, days=["Fri","Sat"],
         start_time="21:30", end_time="22:30", notes="Power Hour — $2 schooners"),
    # CRAFT Beer Market — 2–5pm daily + 9pm–midnight daily
    dict(bar_id=CRAFT, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="14:00", end_time="17:00", notes="Happy hour"),
    dict(bar_id=CRAFT, days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
         start_time="21:00", end_time="23:59", notes="Late night happy hour"),
]

print("\n── Inserting happy_hour_windows ──")
result = sb.table("happy_hour_windows").insert(windows).execute()
for r in result.data:
    print(f"  ✓  {r['bar_id'][:8]}… | {', '.join(r['days'])} | {r['start_time']}–{r['end_time']} | {r.get('notes','')}")

print("\nDone.")
