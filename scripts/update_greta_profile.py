#!/usr/bin/env python3
"""One-shot: update wc_profile for GRETA Bar YVR."""
import os, json
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

GRETA_ID = "54ce0a46-4035-40c5-8096-0caa3ac84bef"

profile = {
    "screen_type": "Multiple screens, sound on",
    "booking_required": False,
    "booking_notes": None,
    "atmosphere": "lively",
    "opens_early": True,
    "opens_early_notes": "Open for most matches from June 11",
    "capacity_notes": None,
    "special_features": "50+ arcade games, loaded nachos, chicken sandwiches, chilli cheese dogs",
    "match_day_deals": "Michelob Ultra — official FIFA World Cup beer",
    "confidence": "high",
    "source_url": "manual",
    "scraped_at": datetime.now(timezone.utc).isoformat(),
}

res = sb.from_("bars").update({"wc_profile": profile}).eq("id", GRETA_ID).execute()
print("Updated GRETA Bar YVR:", json.dumps(profile, indent=2))
