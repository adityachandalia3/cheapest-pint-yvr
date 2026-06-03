"""Browns Socialhouse — regular prices, HH prices, HH windows."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

BROWNS = "49116e06-1da8-4e7b-8062-124cfc035a4b"
ALL_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

# ── Regular prices (385ml = 13.0oz — below pint threshold, vibe search only) ─
print("── Regular prices ──")
for cat in ("cheapest_beer", "cheapest_lager"):
    sb.table("pint_prices").upsert({
        "bar_id": BROWNS,
        "category": cat,
        "beer_name": "Social Lager",
        "price_cad": 7.50,
        "pour_size_oz": 13.0,
    }, on_conflict="bar_id,category").execute()
    print(f"  ✓ [{cat}] Social Lager — $7.50 / 13.0oz")

# ── HH prices ────────────────────────────────────────────────────────────────
print("\n── HH prices ──")
for cat in ("cheapest_beer", "cheapest_lager"):
    sb.table("pint_prices").update({
        "happy_hour_price_cad": 5.50,
        "happy_hour_beer_name": "Social Lager",
    }).eq("bar_id", BROWNS).eq("category", cat).execute()
    print(f"  ✓ [{cat}] Social Lager HH — $5.50")

# ── HH windows: daily 2–5pm + 9pm–close ─────────────────────────────────────
print("\n── HH windows ──")
windows = [
    {"bar_id": BROWNS, "days": ALL_DAYS, "start_time": "14:00", "end_time": "17:00", "notes": "Social Lager $5.50"},
    {"bar_id": BROWNS, "days": ALL_DAYS, "start_time": "21:00", "end_time": "23:59", "notes": "Social Lager $5.50, 9pm–close"},
]
for w in windows:
    result = sb.table("happy_hour_windows").insert(w).execute()
    r = result.data[0]
    print(f"  ✓ {','.join(r['days'])} | {r['start_time'][:5]}–{r['end_time'][:5]} | {r['notes']}")

print("\nDone.")
