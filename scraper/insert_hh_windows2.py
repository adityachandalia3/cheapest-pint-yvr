"""HH windows for Butcher & Bullock, Library Square, and The Watson."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

BUTCHER_BULLOCK = "7adb4b79-f811-4988-85eb-85c2065f1dee"
LIBRARY_SQUARE  = "9a39c6a6-9381-4ce8-9428-e7244a0cbdb8"
WATSON          = "a506c163-8cf1-48bb-8c8c-41fef36c4da7"

windows = [
    # Butcher & Bullock — 4–6pm Mon–Fri
    {"bar_id": BUTCHER_BULLOCK, "days": ["Mon","Tue","Wed","Thu","Fri"],
     "start_time": "16:00", "end_time": "18:00", "notes": "Happy hour $5 craft lager"},
    # Butcher & Bullock — 9pm–midnight Mon–Thu
    {"bar_id": BUTCHER_BULLOCK, "days": ["Mon","Tue","Wed","Thu"],
     "start_time": "21:00", "end_time": "00:00", "notes": "Late night happy hour $5 craft lager"},

    # Library Square — 2–5pm weekdays
    {"bar_id": LIBRARY_SQUARE, "days": ["Mon","Tue","Wed","Thu","Fri"],
     "start_time": "14:00", "end_time": "17:00", "notes": "Fuggle pints $6"},

    # The Watson — 4–6pm Mon–Fri
    {"bar_id": WATSON, "days": ["Mon","Tue","Wed","Thu","Fri"],
     "start_time": "16:00", "end_time": "18:00", "notes": "Draught beer $6.75"},
    # The Watson — 3–6pm Saturday
    {"bar_id": WATSON, "days": ["Sat"],
     "start_time": "15:00", "end_time": "18:00", "notes": "Draught beer $6.75"},
    # The Watson — all day Sunday (opens 3pm)
    {"bar_id": WATSON, "days": ["Sun"],
     "start_time": "15:00", "end_time": "23:59", "notes": "All day happy hour, draught beer $6.75"},
]

NAMES = {
    BUTCHER_BULLOCK: "Butcher & Bullock",
    LIBRARY_SQUARE:  "Library Square",
    WATSON:          "The Watson",
}

for w in windows:
    result = sb.table("happy_hour_windows").insert(w).execute()
    r = result.data[0]
    print(f"  ✓ {NAMES[w['bar_id']]} | {','.join(r['days'])} | {r['start_time'][:5]}–{r['end_time'][:5]} | {r.get('notes','')}")

print("\nDone.")
