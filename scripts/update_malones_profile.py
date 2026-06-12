#!/usr/bin/env python3
"""One-shot: update wc_profile for Malone's Taphouse."""
import os, json
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

MALONES_ID = "0251d3d2-2fb8-414f-a571-735de9455691"

profile = {
    "screen_type": None,
    "booking_required": False,
    "booking_notes": None,
    "atmosphere": "lively",
    "opens_early": True,
    "opens_early_notes": "Open from 10 AM daily throughout tournament (Sun–Thu until 1 AM, Fri–Sat until 2 AM)",
    "capacity_notes": None,
    "special_features": "DJs and late-night celebrations around matches, special tournament menu from June 10",
    "match_day_deals": "Happy Hour daily 3–5 PM; Late Night HH Sun–Thu 9 PM–close, Fri–Sat 11 PM–close",
    "confidence": "high",
    "source_url": "manual",
    "scraped_at": datetime.now(timezone.utc).isoformat(),
}

res = sb.from_("bars").update({"wc_profile": profile}).eq("id", MALONES_ID).execute()
print("Updated Malone's Taphouse:", json.dumps(profile, indent=2))
