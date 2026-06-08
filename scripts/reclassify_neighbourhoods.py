#!/usr/bin/env python3
"""Reclassify bar neighbourhoods into 5 clean zones. Run with --dry-run first."""

import os
import sys
from supabase import create_client

DRY_RUN = "--dry-run" in sys.argv

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Zone mapping — old neighbourhood → new zone
# ---------------------------------------------------------------------------
ZONE_MAP = {
    # Downtown
    "Downtown Vancouver":   "Downtown",
    "Coal Harbour":         "Downtown",
    "West End":             "Downtown",
    "Davie Village":        "Downtown",
    # Gastown & Chinatown
    "Gastown":              "Gastown & Chinatown",
    "Chinatown":            "Gastown & Chinatown",
    "Strathcona":           "Gastown & Chinatown",
    # Yaletown
    "Yaletown":             "Yaletown",
    "False Creek":          "Yaletown",
    "Fairview":             "Yaletown",
    # Kitsilano & West Side
    "Kitsilano":            "Kitsilano & West Side",
    "Point Grey":           "Kitsilano & West Side",
    "Dunbar":               "Kitsilano & West Side",
    "Granville Island":     "Kitsilano & West Side",
    "UBC":                  "Kitsilano & West Side",
    # East Vancouver
    "East Vancouver":       "East Vancouver",
    "Commercial Drive":     "East Vancouver",
    "Grandview-Woodland":   "East Vancouver",
    "Main Street":          "East Vancouver",
    "South Main":           "East Vancouver",
    "Mount Pleasant":       "East Vancouver",
    "Hastings-Sunrise":     "East Vancouver",
    "Riley Park–Little Mountain": "East Vancouver",
}

# Bars in "Central Vancouver" need individual treatment based on address
CENTRAL_VAN_OVERRIDES = {
    "Beach Ave Bar and Grill":              "Downtown",       # Beach Ave, West End
    "Centre Bar":                           "Downtown",       # Smithe St, downtown
    "Parker Rooftop":                       "Downtown",       # Howe St, downtown
    "Stanley's Bar & Grill":               "Downtown",       # Pipeline Rd, Stanley Park
    "District Bar Restaurant Vancouver":    "Downtown",       # Robson St, downtown
    "The Boxcar Cocktail Bar":              "East Vancouver", # 917 Main St, Mount Pleasant
}

# Individual bar overrides by name (for any other mislabelled bars)
BAR_OVERRIDES = {
    # Coal Harbour Bar sits at Canada Place — clearly downtown waterfront
    "Coal Harbour Bar": "Downtown",
}

def get_new_zone(bar):
    name = bar["name"]
    hood = bar["neighbourhood"]

    if name in BAR_OVERRIDES:
        return BAR_OVERRIDES[name]

    if hood == "Central Vancouver":
        return CENTRAL_VAN_OVERRIDES.get(name, "Downtown")

    if hood in ZONE_MAP:
        return ZONE_MAP[hood]

    return None  # unknown — will flag

def main():
    print(f"\n{'DRY RUN — no writes' if DRY_RUN else 'LIVE RUN — writing to Supabase'}\n{'='*60}")

    bars = client.table("bars").select("id, name, neighbourhood").eq("is_permanently_closed", False).execute().data

    changes = []
    unknowns = []

    for bar in bars:
        new_zone = get_new_zone(bar)
        old = bar["neighbourhood"]
        if new_zone is None:
            unknowns.append(bar)
        elif new_zone != old:
            changes.append((bar["id"], bar["name"], old, new_zone))

    # Print by new zone
    from collections import defaultdict
    by_zone = defaultdict(list)
    for bar_id, name, old, new in changes:
        by_zone[new].append((name, old))

    for zone in ["Downtown", "Gastown & Chinatown", "Yaletown", "Kitsilano & West Side", "East Vancouver"]:
        entries = by_zone.get(zone, [])
        if entries:
            print(f"\n→ {zone} ({len(entries)} changes)")
            for name, old in sorted(entries):
                print(f"    {old:30s}  →  {name}")

    if unknowns:
        print(f"\n⚠️  Unknown neighbourhoods (not mapped):")
        for b in unknowns:
            print(f"    [{b['neighbourhood']}] {b['name']}")

    print(f"\n{'='*60}")
    print(f"Total bars to reclassify: {len(changes)}")
    print(f"Already correct (no change needed): {len(bars) - len(changes) - len(unknowns)}")

    if not DRY_RUN and changes:
        print("\nWriting to Supabase...")
        for bar_id, name, old, new in changes:
            client.table("bars").update({"neighbourhood": new}).eq("id", bar_id).execute()
            print(f"  ✓ {name}")
        print("Done.")

if __name__ == "__main__":
    main()
