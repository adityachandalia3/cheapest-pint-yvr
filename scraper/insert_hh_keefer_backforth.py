"""HH windows + prices for Keefer Bar and Back and Forth Bar."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

KEEFER     = "855a782e-5ecf-420d-884a-2ef5e5886d50"
BACK_FORTH = "ef2abdd4-4136-4cf4-8acf-92306ac6aaa0"

# ── 1. Keefer HH window: Sun–Fri 4–6pm ──────────────────────────────────────
print("── Keefer Bar ──")
sb.table("happy_hour_windows").insert({
    "bar_id": KEEFER,
    "days": ["Sun","Mon","Tue","Wed","Thu","Fri"],
    "start_time": "16:00",
    "end_time": "18:00",
    "notes": "Asahi $6",
}).execute()
print("  ✓ window: Sun–Fri 16:00–18:00")

# Keefer HH prices
for cat in ("cheapest_beer", "cheapest_lager"):
    sb.table("pint_prices").update({
        "happy_hour_price_cad": 6.00,
        "happy_hour_beer_name": "Asahi",
    }).eq("bar_id", KEEFER).eq("category", cat).execute()
    print(f"  ✓ [{cat}] Asahi HH $6.00")

# ── 2. Back and Forth — add IPA row + HH prices ──────────────────────────────
print("\n── Back and Forth Bar ──")

# Add cheapest_ipa (wasn't in manual insert)
sb.table("pint_prices").upsert({
    "bar_id": BACK_FORTH,
    "category": "cheapest_ipa",
    "beer_name": "Parallel 49 Trash Panda Hazy IPA",
    "price_cad": 7.75,
    "pour_size_oz": None,
}, on_conflict="bar_id,category").execute()
print("  ✓ [cheapest_ipa] Parallel 49 Trash Panda Hazy IPA — $7.75")

# HH prices: all three categories $6, daily 5–6pm (window already exists)
for cat in ("cheapest_beer", "cheapest_lager", "cheapest_ipa"):
    sb.table("pint_prices").update({
        "happy_hour_price_cad": 6.00,
    }).eq("bar_id", BACK_FORTH).eq("category", cat).execute()
    print(f"  ✓ [{cat}] HH $6.00")

print("\nDone.")
