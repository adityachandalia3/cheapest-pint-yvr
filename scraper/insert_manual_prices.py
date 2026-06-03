"""
Manual price insert for bars where the scraper couldn't extract prices.
330ml Asahi = 11.2 oz — note: 11.2oz won't surface in the pint leaderboard (filter = 14/15/16/20oz).
12oz Bar Corso also below pint threshold.
Run from scraper/ directory.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# ── Bar IDs ──────────────────────────────────────────────────────────────────
BUTCHER_BULLOCK = "7adb4b79-f811-4988-85eb-85c2065f1dee"
WATSON          = "a506c163-8cf1-48bb-8c8c-41fef36c4da7"
KEEFER          = "855a782e-5ecf-420d-884a-2ef5e5886d50"
BAR_CORSO       = "742bd3a8-d96e-4dce-b2bb-828bbee7e68a"
CHICKADEE       = "903646f3-28b6-41c3-8f5a-08486a8bea86"
ODD_SOCIETY     = "762e6585-fec1-4422-8719-10bcfde9f025"
BACK_FORTH      = "ef2abdd4-4136-4cf4-8acf-92306ac6aaa0"

prices = [
    # ── Butcher & Bullock ───────────────────────────────────────────────────
    # 20oz imperial pint — add 20 to PINT_POUR_SIZES in frontend to show in leaderboard
    {"bar_id": BUTCHER_BULLOCK, "category": "cheapest_beer",   "beer_name": "Parallel 49 Craft Lager", "price_cad": 8.00, "pour_size_oz": 20.0},
    {"bar_id": BUTCHER_BULLOCK, "category": "cheapest_lager",  "beer_name": "Parallel 49 Craft Lager", "price_cad": 8.00, "pour_size_oz": 20.0},

    # ── The Watson ──────────────────────────────────────────────────────────
    {"bar_id": WATSON, "category": "cheapest_beer",   "beer_name": "Backcountry Pilsner",  "price_cad": 9.00, "pour_size_oz": 16.0},
    {"bar_id": WATSON, "category": "cheapest_lager",  "beer_name": "Backcountry Pilsner",  "price_cad": 9.00, "pour_size_oz": 16.0},
    {"bar_id": WATSON, "category": "cheapest_ipa",    "beer_name": "Four Winds IPA",       "price_cad": 9.00, "pour_size_oz": 16.0},

    # ── The Keefer Bar ──────────────────────────────────────────────────────
    # 330ml = 11.2oz — below pint threshold, stored for vibe search only
    {"bar_id": KEEFER, "category": "cheapest_beer",  "beer_name": "Asahi", "price_cad": 8.00, "pour_size_oz": 11.2},
    {"bar_id": KEEFER, "category": "cheapest_lager", "beer_name": "Asahi", "price_cad": 8.00, "pour_size_oz": 11.2},

    # ── Bar Corso ───────────────────────────────────────────────────────────
    # 12oz — below pint threshold, stored for vibe search only
    {"bar_id": BAR_CORSO, "category": "cheapest_beer",  "beer_name": "East Van Euro Lager", "price_cad": 7.00, "pour_size_oz": 12.0},
    {"bar_id": BAR_CORSO, "category": "cheapest_lager", "beer_name": "East Van Euro Lager", "price_cad": 7.00, "pour_size_oz": 12.0},

    # ── The Chickadee Room ──────────────────────────────────────────────────
    # Non-alc excluded per user instruction. Pour sizes not confirmed — stored without oz.
    {"bar_id": CHICKADEE, "category": "cheapest_lager", "beer_name": "Twin Sails Low Life Lager",       "price_cad": 9.00, "pour_size_oz": None},
    {"bar_id": CHICKADEE, "category": "cheapest_ipa",   "beer_name": 'Steel & Oak "Shiny Things" IPA',  "price_cad": 9.50, "pour_size_oz": None},

    # ── Odd Society Spirits ─────────────────────────────────────────────────
    # Scraper found this — including here for completeness
    {"bar_id": ODD_SOCIETY, "category": "cheapest_beer", "beer_name": "Rotating BC craft draught", "price_cad": 6.00, "pour_size_oz": None},

    # ── Back and Forth Bar ──────────────────────────────────────────────────
    # Scraper found name update (price unchanged)
    {"bar_id": BACK_FORTH, "category": "cheapest_beer",  "beer_name": "Parallel 49 Craft Lager", "price_cad": 7.75, "pour_size_oz": None},
    {"bar_id": BACK_FORTH, "category": "cheapest_lager", "beer_name": "Parallel 49 Craft Lager", "price_cad": 7.75, "pour_size_oz": None},
]

for p in prices:
    result = sb.table("pint_prices").upsert(p, on_conflict="bar_id,category").execute()
    bar_id = p["bar_id"]
    name = {
        BUTCHER_BULLOCK: "Butcher & Bullock",
        WATSON:          "The Watson",
        KEEFER:          "The Keefer Bar",
        BAR_CORSO:       "Bar Corso",
        CHICKADEE:       "The Chickadee Room",
        ODD_SOCIETY:     "Odd Society Spirits",
        BACK_FORTH:      "Back and Forth Bar",
    }[bar_id]
    oz = f" / {p['pour_size_oz']}oz" if p.get("pour_size_oz") else ""
    print(f"  ✓ {name} [{p['category']}] {p['beer_name']} — ${p['price_cad']:.2f}{oz}")
