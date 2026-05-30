"""
One-shot script: inserts manually-researched pint prices for 4 new bars.
Run from the scraper/ directory.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# ── look up bar IDs ──────────────────────────────────────────────────────────
names = ["The Regal Beagle", "33 Acres Brewing Company", "Brassneck Brewery", "The King's Head Public House"]
rows = sb.table("bars").select("id, name").in_("name", names).execute().data
id_map = {r["name"]: r["id"] for r in rows}
print("Found bars:", id_map)

missing = [n for n in names if n not in id_map]
if missing:
    print("MISSING from DB:", missing)
    raise SystemExit(1)

# ── price rows ───────────────────────────────────────────────────────────────
prices = [
    # Regal Beagle — all 16oz @ $7.75
    dict(bar_id=id_map["The Regal Beagle"], category="cheapest_beer",
         beer_name="Red Truck Lager", price_cad=7.75, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["The Regal Beagle"], category="cheapest_lager",
         beer_name="Red Truck Lager", price_cad=7.75, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["The Regal Beagle"], category="cheapest_ipa",
         beer_name="Reverb West Coast IPA", price_cad=7.75, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),

    # 33 Acres Brewing Company — 16oz pints
    dict(bar_id=id_map["33 Acres Brewing Company"], category="cheapest_beer",
         beer_name="33 Acres of Life (Amber Lager)", price_cad=8.50, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["33 Acres Brewing Company"], category="cheapest_lager",
         beer_name="33 Acres of Life (Amber Lager)", price_cad=8.50, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["33 Acres Brewing Company"], category="cheapest_ipa",
         beer_name="33 Acres of Nirvana (West Coast IPA)", price_cad=8.75, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),

    # Brassneck Brewery — medium 12oz
    dict(bar_id=id_map["Brassneck Brewery"], category="cheapest_beer",
         beer_name="NORMCORE Pale Ale", price_cad=7.50, pour_size_oz=12,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["Brassneck Brewery"], category="cheapest_ipa",
         beer_name="Not So… (Cold IPA)", price_cad=7.50, pour_size_oz=12,
         verified=True, confidence="high", source_section="main_menu"),

    # King's Head Public House — 16oz
    dict(bar_id=id_map["The King's Head Public House"], category="cheapest_beer",
         beer_name="King's Head Lager", price_cad=7.00, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["The King's Head Public House"], category="cheapest_lager",
         beer_name="King's Head Lager", price_cad=7.00, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
    dict(bar_id=id_map["The King's Head Public House"], category="cheapest_ipa",
         beer_name="Fat Tug IPA", price_cad=8.50, pour_size_oz=16,
         verified=True, confidence="high", source_section="main_menu"),
]

result = sb.table("pint_prices").insert(prices).execute()
print(f"\nInserted {len(result.data)} rows.")
for r in result.data:
    print(f"  {r['bar_id']} | {r['category']} | {r['beer_name']} | ${r['price_cad']}")
