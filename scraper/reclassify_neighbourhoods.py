"""
Re-geocodes bars using Google Geocoding API reverse lookup (lat/lng → sublocality)
to replace broad labels like "Central Vancouver" with precise neighbourhoods.

Usage:
    python reclassify_neighbourhoods.py --dry-run   # preview changes only
    python reclassify_neighbourhoods.py              # write to DB
"""

import argparse
import os
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
GOOGLE_API_KEY       = os.environ["GOOGLE_PLACES_API_KEY"]
GEOCODE_URL          = "https://maps.googleapis.com/maps/api/geocode/json"

# Neighbourhood types to try, in priority order
NEIGHBOURHOOD_TYPES = [
    "neighborhood",
    "sublocality_level_1",
    "sublocality",
]

# Only reclassify bars with these broad/incorrect labels — leave specific ones alone
BROAD_LABELS = {
    "Central Vancouver", "Downtown", "Unknown", "",
}

# Manual overrides — checked first, in priority order
# Maps (lat_min, lat_max, lng_min, lng_max) → neighbourhood name
BOUNDING_OVERRIDES = [
    ((49.282, 49.290, -123.114, -123.095), "Gastown"),       # Water St / Carrall St corridor
    ((49.271, 49.279, -123.130, -123.115), "Yaletown"),
    ((49.276, 49.293, -123.152, -123.135), "West End"),
    ((49.276, 49.283, -123.145, -123.132), "Davie Village"),
    ((49.278, 49.284, -123.112, -123.098), "Chinatown"),
    ((49.283, 49.296, -123.140, -123.112), "Coal Harbour"),
    ((49.260, 49.272, -123.142, -123.118), "False Creek"),
    ((49.244, 49.268, -123.120, -123.094), "Mount Pleasant"),
    ((49.278, 49.288, -123.132, -123.110), "Downtown Vancouver"),
]


def bbox_neighbourhood(lat, lng):
    for (lat_min, lat_max, lng_min, lng_max), name in BOUNDING_OVERRIDES:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return name
    return None


def reverse_geocode(lat, lng):
    resp = requests.get(
        GEOCODE_URL,
        params={"latlng": f"{lat},{lng}", "key": GOOGLE_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])

    for result in results:
        for component in result.get("address_components", []):
            types = component.get("types", [])
            for t in NEIGHBOURHOOD_TYPES:
                if t in types:
                    name = component["long_name"]
                    # Skip generic "Vancouver" returns
                    if name.lower() not in ("vancouver", "metro vancouver", "greater vancouver"):
                        return name
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch all active bars with coordinates
    bars = (
        sb.table("bars")
        .select("id, name, neighbourhood, latitude, longitude")
        .eq("is_permanently_closed", False)
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .execute()
        .data
    )

    print(f"Processing {len(bars)} bars...\n")

    changed = skipped = failed = 0

    for bar in bars:
        lat, lng = bar["latitude"], bar["longitude"]
        old_hood = bar["neighbourhood"] or "Unknown"

        # Try bounding box first (fast, no API call)
        new_hood = bbox_neighbourhood(lat, lng)

        # Fall back to Google reverse geocode
        if not new_hood:
            try:
                new_hood = reverse_geocode(lat, lng)
                time.sleep(0.05)  # stay well under rate limit
            except Exception as e:
                print(f"  ✗ {bar['name']}: geocode failed — {e}")
                failed += 1
                continue

        if not new_hood:
            print(f"  ? {bar['name']}: no neighbourhood found (kept: {old_hood})")
            skipped += 1
            continue

        # Skip bars that already have a specific neighbourhood label
        if old_hood not in BROAD_LABELS:
            skipped += 1
            continue

        if new_hood == old_hood:
            skipped += 1
            continue

        print(f"  {bar['name']}")
        print(f"    {old_hood}  →  {new_hood}")

        if not args.dry_run:
            sb.table("bars").update({"neighbourhood": new_hood}).eq("id", bar["id"]).execute()

        changed += 1

    print(f"\n{'DRY RUN — ' if args.dry_run else ''}Done.")
    print(f"  Changed : {changed}")
    print(f"  Skipped : {skipped}")
    print(f"  Failed  : {failed}")


if __name__ == "__main__":
    main()
