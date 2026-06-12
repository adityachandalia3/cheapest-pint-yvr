#!/usr/bin/env python3
"""
Simulate the Near Me algorithm for any lat/lng.
Usage: python simulate_near_me.py [lat] [lng]
Default: Earls on Hornby / downtown Vancouver area
"""

import sys
import math
import json
import os
import urllib.request
import urllib.parse

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

RADII = [1, 2, 5]
MIN_BARS = 5
PINT_POUR_SIZES = {14, 15, 16}


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_bars():
    url = f"{SUPABASE_URL}/rest/v1/bars?select=id,name,address,latitude,longitude,pint_prices(category,price_cad,pour_size_oz)&is_permanently_closed=eq.false"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def get_cheapest_price(bar):
    prices = bar.get("pint_prices", [])
    if not prices:
        return None, None
    best_price = None
    best_pour = None
    for p in prices:
        price = p.get("price_cad")
        pour = p.get("pour_size_oz")
        if price is None:
            continue
        if pour not in PINT_POUR_SIZES:
            continue
        price = float(price)
        if best_price is None or price < best_price:
            best_price = price
            best_pour = pour
    return best_price, best_pour


def simulate(user_lat, user_lng):
    print(f"\n📍 Simulating Near Me from ({user_lat:.4f}, {user_lng:.4f})\n")

    bars = fetch_bars()
    print(f"  Total bars in DB: {len(bars)}")

    # Compute distances
    with_distance = []
    no_latlng = []
    no_price = []

    for bar in bars:
        lat, lng = bar.get("latitude"), bar.get("longitude")
        if lat is None or lng is None:
            no_latlng.append(bar["name"])
            continue
        dist = haversine_km(user_lat, user_lng, lat, lng)
        price, pour = get_cheapest_price(bar)
        with_distance.append({**bar, "dist_km": dist, "best_price": price, "best_pour": pour})

    print(f"  Bars with lat/lng: {len(with_distance)}")
    print(f"  Bars missing lat/lng: {len(no_latlng)}")

    # Try each radius — same logic as useNearMe hook
    chosen_radius = None
    chosen_bars = None

    for r in RADII:
        nearby = [b for b in with_distance if b["dist_km"] <= r]
        with_price = [b for b in nearby if b["best_price"] is not None]
        print(f"\n  ── Radius {r}km ──")
        print(f"     Bars with lat/lng within {r}km : {len(nearby)}")
        print(f"     Bars with valid pint price     : {len(with_price)}")

        # Show all bars within radius
        nearby_sorted = sorted(nearby, key=lambda b: b["dist_km"])
        for b in nearby_sorted:
            price_str = f"${b['best_price']:.2f} ({b['best_pour']}oz)" if b["best_price"] else "NO VALID PRICE"
            print(f"       {b['dist_km']:.3f}km  {b['name'][:40]:40s}  {price_str}")

        if len(nearby) >= MIN_BARS:
            chosen_radius = r
            chosen_bars = nearby
            break

    print()
    if chosen_radius:
        priced = [b for b in chosen_bars if b["best_price"] is not None]
        priced_sorted = sorted(priced, key=lambda b: b["best_price"])
        print(f"✅ Radius chosen: {chosen_radius}km  ({len(chosen_bars)} bars found, {len(priced)} with prices)")
        print(f"\n🏆 Leaderboard (sorted by price):\n")
        for i, b in enumerate(priced_sorted[:10], 1):
            print(f"  #{i}  ${b['best_price']:.2f} ({b['best_pour']}oz)  {b['dist_km']:.3f}km  {b['name']}")
    else:
        print("⚠️  Fewer than 5 bars within 5km — would fall back to all Vancouver")


if __name__ == "__main__":
    lat = float(sys.argv[1]) if len(sys.argv) > 1 else 49.2816
    lng = float(sys.argv[2]) if len(sys.argv) > 2 else -123.1237
    simulate(lat, lng)
