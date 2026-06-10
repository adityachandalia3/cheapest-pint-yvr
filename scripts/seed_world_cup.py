#!/usr/bin/env python3
"""Seed supporters_bars for World Cup 2026. Run with --dry-run first."""

import os
import sys
from supabase import create_client

DRY_RUN = "--dry-run" in sys.argv

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

client = create_client(SUPABASE_URL, SUPABASE_KEY)

ENTRIES = [
    {
        "country": "Germany",
        "flag": "🇩🇪",
        "bar_name": "Dublin Calling",
        "venue_name": None,
        "neighbourhood": "Downtown",
        "notes": "German House since 2014, ticketed events sell out fast",
    },
    {
        "country": "England",
        "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "bar_name": "Dublin Calling",
        "venue_name": None,
        "neighbourhood": "Downtown",
        "notes": "England House for WC 2026",
    },
    {
        "country": "Australia",
        "flag": "🇦🇺",
        "bar_name": "The Moose",
        "venue_name": None,
        "neighbourhood": "Downtown",
        "notes": "Aussie HQ",
    },
    {
        "country": "Spain",
        "flag": "🇪🇸",
        "bar_name": "Bodega on Main",
        "venue_name": None,
        "neighbourhood": "Main Street",
        "notes": "Spanish hub",
    },
    {
        "country": "Canada",
        "flag": "🇨🇦",
        "bar_name": "Shark Club",
        "venue_name": None,
        "neighbourhood": "Downtown",
        "notes": "Canada House by Coca-Cola, steps from BC Place",
    },
    {
        "country": "Ireland",
        "flag": "🇮🇪",
        "bar_name": "Blarney Stone",
        "venue_name": None,
        "neighbourhood": "Gastown",
        "notes": "Home of the Southsiders, Vancouver's longest-running Irish bar",
    },
    {
        "country": "Italy",
        "flag": "🇮🇹",
        "bar_name": None,
        "venue_name": "Commercial Drive (Little Italy)",
        "neighbourhood": "Grandview-Woodland",
        "notes": "Caffe Roma, Cafe Napoli, Italian Cultural Centre",
    },
    {
        "country": "Portugal",
        "flag": "🇵🇹",
        "bar_name": None,
        "venue_name": "Portuguese Club of Vancouver",
        "neighbourhood": "Commercial Drive",
        "notes": "1144 Commercial Dr",
    },
    {
        "country": "Croatia",
        "flag": "🇭🇷",
        "bar_name": None,
        "venue_name": "Croatian Cultural Centre",
        "neighbourhood": "Commercial Drive",
        "notes": "3250 Commercial Dr",
    },
    {
        "country": "Latin America",
        "flag": "🌎",
        "bar_name": None,
        "venue_name": "Latin Plaza Hub (Latincouver)",
        "neighbourhood": "Gastown",
        "notes": "Tribuna Latina screenings",
    },
    {
        "country": "France",
        "flag": "🇫🇷",
        "bar_name": None,
        "venue_name": "Alliance Française",
        "neighbourhood": "South Granville",
        "notes": "Les Bleus watch parties",
    },
]

# ---------------------------------------------------------------------------
# Resolve bar IDs
# ---------------------------------------------------------------------------
print("Resolving bar IDs...")
failures = []
resolved = []

for entry in ENTRIES:
    bar_name = entry.get("bar_name")
    bar_id = None

    if bar_name:
        result = client.table("bars").select("id, name").ilike("name", f"%{bar_name}%").eq("is_permanently_closed", False).execute()
        if result.data:
            bar_id = result.data[0]["id"]
            print(f"  ✓ {entry['country']}: {result.data[0]['name']} ({bar_id[:8]}…)")
        else:
            print(f"  ✗ {entry['country']}: no match for '{bar_name}'")
            failures.append(entry["country"])
    else:
        print(f"  — {entry['country']}: venue only ({entry['venue_name']})")

    resolved.append({
        "country": entry["country"],
        "flag": entry["flag"],
        "bar_id": bar_id,
        "venue_name": entry["venue_name"],
        "neighbourhood": entry["neighbourhood"],
        "notes": entry["notes"],
        "verified": False,
    })

print()
if failures:
    print(f"⚠️  Bar lookup failures (fix manually): {', '.join(failures)}")
    print()

if DRY_RUN:
    print("=== DRY RUN — rows that would be inserted: ===")
    for r in resolved:
        print(f"  {r['flag']} {r['country']} | bar_id={r['bar_id'] or 'None'} | {r['venue_name'] or r['neighbourhood']}")
    print("\nDry run complete — pass no flag to execute.")
    sys.exit(0)

# ---------------------------------------------------------------------------
# Check for existing rows and insert
# ---------------------------------------------------------------------------
existing = client.table("supporters_bars").select("country").execute()
existing_countries = {r["country"] for r in (existing.data or [])}

to_insert = [r for r in resolved if r["country"] not in existing_countries]
skipped = [r["country"] for r in resolved if r["country"] in existing_countries]

if skipped:
    print(f"Skipping already-inserted: {', '.join(skipped)}")

if not to_insert:
    print("Nothing to insert.")
    sys.exit(0)

client.table("supporters_bars").insert(to_insert).execute()
print(f"Inserted {len(to_insert)} supporters bar entries.")
