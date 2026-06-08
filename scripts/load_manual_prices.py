#!/usr/bin/env python3
"""Load manually researched price data into Supabase. Run with --dry-run first."""

import os
import sys
from supabase import create_client

DRY_RUN = "--dry-run" in sys.argv

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

def parse_days(s):
    s = s.strip().lower()
    if "-" not in s:
        return [s]
    start, end = [p.strip() for p in s.split("-", 1)]
    si, ei = DAY_ORDER.index(start), DAY_ORDER.index(end)
    if si <= ei:
        return DAY_ORDER[si:ei + 1]
    # wraps (e.g. sat-sun)
    return DAY_ORDER[si:] + DAY_ORDER[:ei + 1]

def parse_time(s):
    """Return (start_time, end_time) as 'HH:MM:00' strings."""
    s = s.strip()
    sep = " - " if " - " in s else " -"
    start_raw, end_raw = [p.strip() for p in s.split(sep, 1)]
    def fmt(t):
        t = t.strip().lower()
        if t == "close":
            return "23:59:00"
        h, m = (t.split(":") + ["0"])[:2]
        return f"{int(h):02d}:{int(m):02d}:00"
    return fmt(start_raw), fmt(end_raw)

# ---------------------------------------------------------------------------
# Data parsed from PDF
# Skipped bars: Bar One, Blind Rabbit, Blosm Bar Lounge, Crystal Sports Bar,
#   Empress Bar, Granville Room, Hello Goodbye Bar, Parallel 49 Brewing,
#   The Diamond, The Georgia Bar, The Shameful Tiki Room, The West Pub,
#   Leopold's Tavern (no regular price)
# ---------------------------------------------------------------------------

EARLS_SOURCE = "https://earls.ca/"

PRICES = [
    # --- 1017 On Granville ---
    {"bar_id": "cf6d1803-9cf1-4039-a2c9-e96e823ebcbd", "category": "cheapest_beer",  "beer_name": "Pinky's Lager",              "price_cad": 7.25, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://1017ongranville.restaurants-info.com/menu"},
    {"bar_id": "cf6d1803-9cf1-4039-a2c9-e96e823ebcbd", "category": "cheapest_lager", "beer_name": "Pinky's Lager",              "price_cad": 7.25, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://1017ongranville.restaurants-info.com/menu"},
    {"bar_id": "cf6d1803-9cf1-4039-a2c9-e96e823ebcbd", "category": "cheapest_ipa",   "beer_name": "Trailhopper IPA",            "price_cad": 7.95, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://1017ongranville.restaurants-info.com/menu"},
    # --- Bartholomew ---
    {"bar_id": "3597f350-7542-4cb6-bcf4-19c50730f34b", "category": "cheapest_beer",  "beer_name": "Twin Sails Lager",           "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 6.75, "source_url": "https://www.bartholomewbar.com/"},
    {"bar_id": "3597f350-7542-4cb6-bcf4-19c50730f34b", "category": "cheapest_lager", "beer_name": "Twin Sails Lager",           "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 6.75, "source_url": "https://www.bartholomewbar.com/"},
    {"bar_id": "3597f350-7542-4cb6-bcf4-19c50730f34b", "category": "cheapest_ipa",   "beer_name": "Tofino Brewing Ethereal IPA","price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 6.75, "source_url": "https://www.bartholomewbar.com/"},
    # --- Bayside Lounge ---
    {"bar_id": "1106885a-06ec-4a7a-adf1-86818d83688f", "category": "cheapest_beer",  "beer_name": "House Lager",                "price_cad": 7.50, "pour_size_oz": 16.0,  "hh_price": 5.75, "source_url": "https://www.baysidelounge.ca/menu?location=Location+1&menu=happy-hour"},
    {"bar_id": "1106885a-06ec-4a7a-adf1-86818d83688f", "category": "cheapest_lager", "beer_name": "House Lager",                "price_cad": 7.50, "pour_size_oz": 16.0,  "hh_price": 5.75, "source_url": "https://www.baysidelounge.ca/menu?location=Location+1&menu=happy-hour"},
    {"bar_id": "1106885a-06ec-4a7a-adf1-86818d83688f", "category": "cheapest_ipa",   "beer_name": "Fat Tug",                    "price_cad": 7.50, "pour_size_oz": 16.0,  "hh_price": 5.75, "source_url": "https://www.baysidelounge.ca/menu?location=Location+1&menu=happy-hour"},
    # --- Browns Crafthouse UBC ---
    {"bar_id": "74a9603c-223e-48a9-a1bf-c3b6e4758feb", "category": "cheapest_beer",  "beer_name": "Social Lager",               "price_cad": 6.75, "pour_size_oz": 13.0,  "hh_price": 6.00, "source_url": "https://crafthouse.xdineapp.com/#viewMenu/4675/UBC/819033/DINE%20IN%20MENU"},
    {"bar_id": "74a9603c-223e-48a9-a1bf-c3b6e4758feb", "category": "cheapest_lager", "beer_name": "Social Lager",               "price_cad": 6.75, "pour_size_oz": 13.0,  "hh_price": 6.00, "source_url": "https://crafthouse.xdineapp.com/#viewMenu/4675/UBC/819033/DINE%20IN%20MENU"},
    {"bar_id": "74a9603c-223e-48a9-a1bf-c3b6e4758feb", "category": "cheapest_ipa",   "beer_name": "Parkside Human's IPA",       "price_cad": 9.50, "pour_size_oz": 13.0,  "hh_price": None, "source_url": "https://crafthouse.xdineapp.com/#viewMenu/4675/UBC/819033/DINE%20IN%20MENU"},
    # --- Carlos O'Bryan's ---
    {"bar_id": "ac5e75b2-d3e7-4f3f-88b3-a37f76daebdc", "category": "cheapest_beer",  "beer_name": "Daily Special Beer",         "price_cad": 6.75, "pour_size_oz": 16.0,  "hh_price": 6.25, "source_url": "https://www.kobcob.com/"},
    # --- Cavo Bar+Kitchen ---
    {"bar_id": "cf4dbcc2-34ed-4f65-a311-8baa0d1bd0e9", "category": "cheapest_beer",  "beer_name": "P49 Lager",                  "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": None},
    {"bar_id": "cf4dbcc2-34ed-4f65-a311-8baa0d1bd0e9", "category": "cheapest_lager", "beer_name": "P49 Lager",                  "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": None},
    {"bar_id": "cf4dbcc2-34ed-4f65-a311-8baa0d1bd0e9", "category": "cheapest_ipa",   "beer_name": "Fat Tug",                    "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": None},
    # --- Centre Bar ---
    {"bar_id": "d55fb398-5b6e-455d-9bf8-42b5327f448e", "category": "cheapest_beer",  "beer_name": "Coors Light",                "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 6.00, "source_url": "https://08b6e882-c0af-4d8b-8ade-36fddba8a155.filesusr.com/ugd/93f176_7e9a2d7c7522448ea509b574f4009711.pdf"},
    {"bar_id": "d55fb398-5b6e-455d-9bf8-42b5327f448e", "category": "cheapest_lager", "beer_name": "Molson Canadian Draft",      "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 6.00, "source_url": "https://08b6e882-c0af-4d8b-8ade-36fddba8a155.filesusr.com/ugd/93f176_7e9a2d7c7522448ea509b574f4009711.pdf"},
    {"bar_id": "d55fb398-5b6e-455d-9bf8-42b5327f448e", "category": "cheapest_ipa",   "beer_name": "Phillips Reverb IPA",        "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 6.00, "source_url": "https://08b6e882-c0af-4d8b-8ade-36fddba8a155.filesusr.com/ugd/93f176_7e9a2d7c7522448ea509b574f4009711.pdf"},
    # --- Earls Yaletown ---
    {"bar_id": "2b8369c7-3213-4eaa-9fc4-dd0fa890be7b", "category": "cheapest_beer",  "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "2b8369c7-3213-4eaa-9fc4-dd0fa890be7b", "category": "cheapest_lager", "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "2b8369c7-3213-4eaa-9fc4-dd0fa890be7b", "category": "cheapest_ipa",   "beer_name": "Driftwood Fat Tug",          "price_cad": 8.50, "pour_size_oz": 12.0,  "hh_price": None, "source_url": EARLS_SOURCE},
    # --- Earls Coal Harbour ---
    {"bar_id": "5e90d395-70af-4f40-b4f4-3ffcbf928cb0", "category": "cheapest_beer",  "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "5e90d395-70af-4f40-b4f4-3ffcbf928cb0", "category": "cheapest_lager", "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "5e90d395-70af-4f40-b4f4-3ffcbf928cb0", "category": "cheapest_ipa",   "beer_name": "Driftwood Fat Tug",          "price_cad": 8.50, "pour_size_oz": 12.0,  "hh_price": None, "source_url": EARLS_SOURCE},
    # --- Earls Fairview ---
    {"bar_id": "4bfc02d3-cd8a-45f7-8bba-de70b8bcd77a", "category": "cheapest_beer",  "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "4bfc02d3-cd8a-45f7-8bba-de70b8bcd77a", "category": "cheapest_lager", "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "4bfc02d3-cd8a-45f7-8bba-de70b8bcd77a", "category": "cheapest_ipa",   "beer_name": "Driftwood Fat Tug",          "price_cad": 8.50, "pour_size_oz": 12.0,  "hh_price": None, "source_url": EARLS_SOURCE},
    # --- Earls Downtown Hornby ---
    {"bar_id": "1b54ae78-a7cc-4042-b65b-8e72d9401d61", "category": "cheapest_beer",  "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "1b54ae78-a7cc-4042-b65b-8e72d9401d61", "category": "cheapest_lager", "beer_name": "Parallel 49 Rhino Lager",   "price_cad": 8.25, "pour_size_oz": 12.0,  "hh_price": 5.25, "source_url": EARLS_SOURCE},
    {"bar_id": "1b54ae78-a7cc-4042-b65b-8e72d9401d61", "category": "cheapest_ipa",   "beer_name": "Driftwood Fat Tug",          "price_cad": 8.50, "pour_size_oz": 12.0,  "hh_price": None, "source_url": EARLS_SOURCE},
    # --- GRETA Bar YVR ---
    {"bar_id": "54ce0a46-4035-40c5-8096-0caa3ac84bef", "category": "cheapest_beer",  "beer_name": "Greta Blonde",               "price_cad": 7.39, "pour_size_oz": 16.5,  "hh_price": 7.00, "source_url": "https://gretabar.com/vancouver/food-menu/"},
    {"bar_id": "54ce0a46-4035-40c5-8096-0caa3ac84bef", "category": "cheapest_lager", "beer_name": "Redwind Laser Lite Lager",   "price_cad": 8.04, "pour_size_oz": 16.5,  "hh_price": None, "source_url": "https://gretabar.com/vancouver/food-menu/"},
    # --- Honeybrew Bar + Bistro ---
    {"bar_id": "afcd6ddb-e405-407a-8ce4-15994fd89fa3", "category": "cheapest_beer",  "beer_name": "Sapporo Lager",              "price_cad": 7.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://honeybrewbar.com/"},
    {"bar_id": "afcd6ddb-e405-407a-8ce4-15994fd89fa3", "category": "cheapest_lager", "beer_name": "Sapporo Lager",              "price_cad": 7.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://honeybrewbar.com/"},
    {"bar_id": "afcd6ddb-e405-407a-8ce4-15994fd89fa3", "category": "cheapest_ipa",   "beer_name": "Wildeye Hazy IPA",           "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://honeybrewbar.com/"},
    # --- Koerner's Pub ---
    {"bar_id": "cf42d91b-63f0-4ad0-ade0-d7bb6746fa60", "category": "cheapest_beer",  "beer_name": "Red Truck Lager",            "price_cad": 7.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://www.koerners.ca/menu"},
    {"bar_id": "cf42d91b-63f0-4ad0-ade0-d7bb6746fa60", "category": "cheapest_lager", "beer_name": "Red Truck Lager",            "price_cad": 7.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://www.koerners.ca/menu"},
    {"bar_id": "cf42d91b-63f0-4ad0-ade0-d7bb6746fa60", "category": "cheapest_ipa",   "beer_name": "Fat Tug",                    "price_cad": 7.00, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://www.koerners.ca/menu"},
    # --- Parker Rooftop ---
    {"bar_id": "0c6c29e3-3852-4bf5-a66f-1c61d6a71159", "category": "cheapest_beer",  "beer_name": "Bomber Rice Lager",          "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 7.00, "source_url": "https://www.parkerrooftop.com/menu"},
    {"bar_id": "0c6c29e3-3852-4bf5-a66f-1c61d6a71159", "category": "cheapest_lager", "beer_name": "Bomber Rice Lager",          "price_cad": 9.00, "pour_size_oz": 16.0,  "hh_price": 7.00, "source_url": "https://www.parkerrooftop.com/menu"},
    # --- Savoy Pub ---
    {"bar_id": "c991f080-29a1-4880-9ce6-a8afd37335e9", "category": "cheapest_beer",  "beer_name": "House Beer",                 "price_cad": 5.50, "pour_size_oz": 14.0,  "hh_price": None, "source_url": None},
    # --- Shark Club ---
    {"bar_id": "2aae2142-e4c0-42b4-98f9-b7665bafb2c9", "category": "cheapest_beer",  "beer_name": "Molson Canadian",            "price_cad": 8.50, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://www.sharkclub.com/our-menus/vancouver-happy-hour/"},
    {"bar_id": "2aae2142-e4c0-42b4-98f9-b7665bafb2c9", "category": "cheapest_lager", "beer_name": "Shark Club Euro Lager",      "price_cad": 9.25, "pour_size_oz": 16.0,  "hh_price": 7.00, "source_url": "https://www.sharkclub.com/our-menus/vancouver-happy-hour/"},
    {"bar_id": "2aae2142-e4c0-42b4-98f9-b7665bafb2c9", "category": "cheapest_ipa",   "beer_name": "Fat Tug",                    "price_cad": 9.25, "pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://www.sharkclub.com/our-menus/vancouver-happy-hour/"},
    # --- Speakeasy on Granville ---
    {"bar_id": "0918e80d-6b58-4a6e-aab5-88d931c9927a", "category": "cheapest_beer",  "beer_name": "House Draft Lager",          "price_cad": 8.25, "pour_size_oz": 16.0,  "hh_price": None, "source_url": None},
    {"bar_id": "0918e80d-6b58-4a6e-aab5-88d931c9927a", "category": "cheapest_lager", "beer_name": "House Draft Lager",          "price_cad": 8.25, "pour_size_oz": 16.0,  "hh_price": None, "source_url": None},
    {"bar_id": "0918e80d-6b58-4a6e-aab5-88d931c9927a", "category": "cheapest_ipa",   "beer_name": "Fat Tug IPA",                "price_cad": 8.25, "pour_size_oz": 16.0,  "hh_price": None, "source_url": None},
    # --- Stanley's Bar & Grill ---
    {"bar_id": "7aaf48ce-47d6-404e-9dde-1af39a0eef3d", "category": "cheapest_beer",  "beer_name": "Elementary Lager",           "price_cad": 10.00,"pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://stanleyparkpavilion.com/stanleys-bar-and-grill/"},
    {"bar_id": "7aaf48ce-47d6-404e-9dde-1af39a0eef3d", "category": "cheapest_lager", "beer_name": "Elementary Lager",           "price_cad": 10.00,"pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://stanleyparkpavilion.com/stanleys-bar-and-grill/"},
    {"bar_id": "7aaf48ce-47d6-404e-9dde-1af39a0eef3d", "category": "cheapest_ipa",   "beer_name": "Way of Life Hazy IPA",       "price_cad": 10.00,"pour_size_oz": 16.0,  "hh_price": None, "source_url": "https://stanleyparkpavilion.com/stanleys-bar-and-grill/"},
    # --- The 515 Bar ---
    {"bar_id": "16352d5f-00c1-48a9-8176-3e0177c9ba44", "category": "cheapest_beer",  "beer_name": "Beldame Old Worlds Pilsner", "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": 6.00, "source_url": "https://the515bar.ca/menu/happy-hour-and-daily-features"},
    {"bar_id": "16352d5f-00c1-48a9-8176-3e0177c9ba44", "category": "cheapest_ipa",   "beer_name": "Superflux IPA",              "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": 6.00, "source_url": "https://the515bar.ca/menu/happy-hour-and-daily-features"},
    # --- The Boxcar Cocktail Bar ---
    {"bar_id": "2a3d7319-478b-4746-ad5e-03a929f4a551", "category": "cheapest_beer",  "beer_name": "Good Company Lager",         "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": 6.50, "source_url": "https://www.google.com/maps/place/The+Boxcar+Cocktail+Bar/@49.2765676,-123.0999611,3a,75y,90t/"},
    {"bar_id": "2a3d7319-478b-4746-ad5e-03a929f4a551", "category": "cheapest_lager", "beer_name": "Good Company Lager",         "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": 6.50, "source_url": "https://www.google.com/maps/place/The+Boxcar+Cocktail+Bar/@49.2765676,-123.0999611,3a,75y,90t/"},
    {"bar_id": "2a3d7319-478b-4746-ad5e-03a929f4a551", "category": "cheapest_ipa",   "beer_name": "Cascadia West Coast IPA",    "price_cad": 8.00, "pour_size_oz": 16.0,  "hh_price": 6.50, "source_url": "https://www.google.com/maps/place/The+Boxcar+Cocktail+Bar/@49.2765676,-123.0999611,3a,75y,90t/"},
    # --- The Dime ---
    {"bar_id": "59f0029c-352b-48ad-9cf2-cb8002222d8a", "category": "cheapest_beer",  "beer_name": "Bud Light",                  "price_cad": 7.25, "pour_size_oz": 14.0,  "hh_price": None, "source_url": "https://warehousegroup.ca/location/the-dime-commercial/"},
    {"bar_id": "59f0029c-352b-48ad-9cf2-cb8002222d8a", "category": "cheapest_ipa",   "beer_name": "Trail hopper IPA",           "price_cad": 7.75, "pour_size_oz": 14.0,  "hh_price": None, "source_url": "https://warehousegroup.ca/location/the-dime-commercial/"},
    # --- The Irish Heather Shebeen ---
    {"bar_id": "74d0298c-e2d8-4fff-b9be-0831b524cc75", "category": "cheapest_beer",  "beer_name": "Harp Lager",                 "price_cad": 8.70, "pour_size_oz": 20.0,  "hh_price": None, "source_url": "https://www.irishheather.com/drink#beer-wine-cocktails"},
    {"bar_id": "74d0298c-e2d8-4fff-b9be-0831b524cc75", "category": "cheapest_lager", "beer_name": "Harp Lager",                 "price_cad": 8.70, "pour_size_oz": 20.0,  "hh_price": None, "source_url": "https://www.irishheather.com/drink#beer-wine-cocktails"},
    {"bar_id": "74d0298c-e2d8-4fff-b9be-0831b524cc75", "category": "cheapest_ipa",   "beer_name": "Fat Tug IPA",                "price_cad": 8.70, "pour_size_oz": 20.0,  "hh_price": None, "source_url": "https://www.irishheather.com/drink#beer-wine-cocktails"},
    # --- The Lennox Pub ---
    {"bar_id": "500a5bce-65d5-4cef-bedb-b2032b7bcc57", "category": "cheapest_beer",  "beer_name": "Steamworks Lionsgate Lager", "price_cad": 9.25, "pour_size_oz": 20.0,  "hh_price": None, "source_url": None},
    {"bar_id": "500a5bce-65d5-4cef-bedb-b2032b7bcc57", "category": "cheapest_lager", "beer_name": "Steamworks Lionsgate Lager", "price_cad": 9.25, "pour_size_oz": 20.0,  "hh_price": None, "source_url": None},
    {"bar_id": "500a5bce-65d5-4cef-bedb-b2032b7bcc57", "category": "cheapest_ipa",   "beer_name": "Steamworks North West IPA",  "price_cad": 9.25, "pour_size_oz": 20.0,  "hh_price": None, "source_url": None},
    # --- Ventura Room ---
    {"bar_id": "59f487c6-a739-4282-bb45-8a05e17c0143", "category": "cheapest_beer",  "beer_name": "Ventura Lager",              "price_cad": 8.00, "pour_size_oz": 13.0,  "hh_price": None, "source_url": "https://static1.squarespace.com/static/5ca3daed9d41495c5d099b93/t/6a0f2795b52bde5cbfd625ce/1779378069664/VR+-+May+2026+-+Website.pdf"},
    {"bar_id": "59f487c6-a739-4282-bb45-8a05e17c0143", "category": "cheapest_lager", "beer_name": "Ventura Lager",              "price_cad": 8.00, "pour_size_oz": 13.0,  "hh_price": None, "source_url": "https://static1.squarespace.com/static/5ca3daed9d41495c5d099b93/t/6a0f2795b52bde5cbfd625ce/1779378069664/VR+-+May+2026+-+Website.pdf"},
    {"bar_id": "59f487c6-a739-4282-bb45-8a05e17c0143", "category": "cheapest_ipa",   "beer_name": "Yellow Dog Play Dead IPA",   "price_cad": 9.00, "pour_size_oz": 13.0,  "hh_price": None, "source_url": "https://static1.squarespace.com/static/5ca3daed9d41495c5d099b93/t/6a0f2795b52bde5cbfd625ce/1779378069664/VR+-+May+2026+-+Website.pdf"},
]

HH_WINDOWS = [
    # Bartholomew: mon-sun 17:00-18:00
    {"bar_id": "3597f350-7542-4cb6-bcf4-19c50730f34b", "days_str": "mon-sun", "time_str": "17:00 - 18:00"},
    # Bayside: mon-fri 12:00-18:00 and sat-sun 15:00-18:00
    {"bar_id": "1106885a-06ec-4a7a-adf1-86818d83688f", "days_str": "mon-fri", "time_str": "12:00 - 18:00"},
    {"bar_id": "1106885a-06ec-4a7a-adf1-86818d83688f", "days_str": "sat-sun", "time_str": "15:00 - 18:00"},
    # Browns Crafthouse: mon-sun 14:00-17:00 and mon-sun 21:00-close
    {"bar_id": "74a9603c-223e-48a9-a1bf-c3b6e4758feb", "days_str": "mon-sun", "time_str": "14:00 - 17:00"},
    {"bar_id": "74a9603c-223e-48a9-a1bf-c3b6e4758feb", "days_str": "mon-sun", "time_str": "21:00 - close"},
    # Carlos O'Bryan's: mon-sun 14:00-17:00 and mon-sun 21:00-close
    {"bar_id": "ac5e75b2-d3e7-4f3f-88b3-a37f76daebdc", "days_str": "mon-sun", "time_str": "14:00 - 17:00"},
    {"bar_id": "ac5e75b2-d3e7-4f3f-88b3-a37f76daebdc", "days_str": "mon-sun", "time_str": "21:00 - close"},
    # Centre Bar: mon-sun 14:00-18:00
    {"bar_id": "d55fb398-5b6e-455d-9bf8-42b5327f448e", "days_str": "mon-sun", "time_str": "14:00 - 18:00"},
    # Earls (all 4 locations): mon-sun 15:00-18:00 and mon-sun 21:00-close
    {"bar_id": "2b8369c7-3213-4eaa-9fc4-dd0fa890be7b", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
    {"bar_id": "2b8369c7-3213-4eaa-9fc4-dd0fa890be7b", "days_str": "mon-sun", "time_str": "21:00 - close"},
    {"bar_id": "5e90d395-70af-4f40-b4f4-3ffcbf928cb0", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
    {"bar_id": "5e90d395-70af-4f40-b4f4-3ffcbf928cb0", "days_str": "mon-sun", "time_str": "21:00 - close"},
    {"bar_id": "4bfc02d3-cd8a-45f7-8bba-de70b8bcd77a", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
    {"bar_id": "4bfc02d3-cd8a-45f7-8bba-de70b8bcd77a", "days_str": "mon-sun", "time_str": "21:00 - close"},
    {"bar_id": "1b54ae78-a7cc-4042-b65b-8e72d9401d61", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
    {"bar_id": "1b54ae78-a7cc-4042-b65b-8e72d9401d61", "days_str": "mon-sun", "time_str": "21:00 - close"},
    # GRETA Bar: tue-sat 16:00-18:00 and tue-thur 22:00-00:00
    {"bar_id": "54ce0a46-4035-40c5-8096-0caa3ac84bef", "days_str": "tue-sat", "time_str": "16:00 - 18:00"},
    {"bar_id": "54ce0a46-4035-40c5-8096-0caa3ac84bef", "days_str": "tue-thu", "time_str": "22:00 - 00:00"},
    # Honeybrew: mon-sun 15:00-18:00 and sun-thur 22:00-00:00
    {"bar_id": "afcd6ddb-e405-407a-8ce4-15994fd89fa3", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
    {"bar_id": "afcd6ddb-e405-407a-8ce4-15994fd89fa3", "days_str": "sun-thu", "time_str": "22:00 - 00:00"},
    # Parker Rooftop: mon-sun 15:00-18:00
    {"bar_id": "0c6c29e3-3852-4bf5-a66f-1c61d6a71159", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
    # Shark Club: mon-fri 14:00-17:00 and mon-fri 21:00-00:00
    {"bar_id": "2aae2142-e4c0-42b4-98f9-b7665bafb2c9", "days_str": "mon-fri", "time_str": "14:00 - 17:00"},
    {"bar_id": "2aae2142-e4c0-42b4-98f9-b7665bafb2c9", "days_str": "mon-fri", "time_str": "21:00 - 00:00"},
    # The 515 Bar: mon-sun 16:00-18:00
    {"bar_id": "16352d5f-00c1-48a9-8176-3e0177c9ba44", "days_str": "mon-sun", "time_str": "16:00 - 18:00"},
    # The Boxcar: mon-sun 17:00-19:00
    {"bar_id": "2a3d7319-478b-4746-ad5e-03a929f4a551", "days_str": "mon-sun", "time_str": "17:00 - 19:00"},
    # The Lennox Pub: mon-sun 15:00-18:00
    {"bar_id": "500a5bce-65d5-4cef-bedb-b2032b7bcc57", "days_str": "mon-sun", "time_str": "15:00 - 18:00"},
]

SKIPPED = [
    ("1460465a-bb38-4a45-840a-f1af6e6bfaea", "Bar One",                       "No menu"),
    ("6ba765eb-d65c-4548-b820-02302f74f058", "Blind Rabbit",                   "Website not working"),
    ("44ef3a11-0159-42c6-89eb-fd56e77a7731", "Blosm Bar Lounge",               "Closed"),
    ("54b939ca-112d-41f1-9167-82486048c928", "Crystal Sports Bar & Grill",     "Menu doesn't have a beer section"),
    ("5dbd3b41-5db5-48bd-a03e-ac4afdb8690c", "Empress Bar",                    "Website not loading"),
    ("4571c74e-b426-4556-aa10-b881f0976745", "Granville Room",                 "Menu doesn't show bottle vs draught"),
    ("54596a31-cc3b-49db-8abe-d5c95ddcaf49", "Hello Goodbye Bar",              "Club not bar + no menu"),
    ("3e2dffd7-a568-4336-a841-4a6420824173", "Parallel 49 Brewing Company",    "No price list"),
    ("18bd5798-4152-4903-b80a-0208b28f6391", "The Diamond",                    "Closed"),
    ("5f7db101-7071-4503-932f-3a799b9b7e01", "The Georgia Bar",                "No menu online"),
    ("10f0af2c-7d3d-432b-b210-96f17b4c2447", "The Shameful Tiki Room",         "Only has bottled beer"),
    ("04087d6d-d3b0-4c1c-990a-5bc0db0bd532", "The West Pub",                   "No menu or website"),
    ("416bc567-8298-4d02-8c29-5047d942c2c1", "Leopold's Tavern",               "No regular price (HH price only)"),
]

# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------
def main():
    print(f"\n{'DRY RUN — no writes' if DRY_RUN else 'LIVE RUN — writing to Supabase'}\n{'='*50}")

    # Fetch existing pint_prices to avoid duplicates
    existing_pp = client.table("pint_prices").select("bar_id,category").execute()
    existing_keys = {(r["bar_id"], r["category"]) for r in existing_pp.data}

    # Fetch existing hh_windows to avoid duplicates
    existing_hh = client.table("happy_hour_windows").select("bar_id,start_time,end_time").execute()
    existing_hh_keys = {(r["bar_id"], r["start_time"], r["end_time"]) for r in existing_hh.data}

    # Verify all bar UUIDs exist
    all_bar_ids = {p["bar_id"] for p in PRICES} | {h["bar_id"] for h in HH_WINDOWS}
    existing_bars = client.table("bars").select("id").in_("id", list(all_bar_ids)).execute()
    found_ids = {r["id"] for r in existing_bars.data}
    missing_ids = all_bar_ids - found_ids
    if missing_ids:
        print(f"\n⚠️  UUIDs NOT found in bars table:")
        for mid in missing_ids:
            print(f"   {mid}")

    # Insert pint_prices
    pp_inserted, pp_skipped_dup = 0, 0
    for row in PRICES:
        key = (row["bar_id"], row["category"])
        if key in existing_keys:
            pp_skipped_dup += 1
            continue
        record = {
            "bar_id":               row["bar_id"],
            "category":             row["category"],
            "beer_name":            row["beer_name"],
            "price_cad":            row["price_cad"],
            "pour_size_oz":         row["pour_size_oz"],
            "happy_hour_price_cad": row["hh_price"],
            "source_url":           row["source_url"],
            "verified":             False,
        }
        if DRY_RUN:
            print(f"  [DRY] pint_prices: {row['bar_id'][:8]}… {row['category']:15s} ${row['price_cad']:.2f}  {row['beer_name']}")
        else:
            client.table("pint_prices").insert(record).execute()
        pp_inserted += 1

    # Insert happy_hour_windows
    hh_inserted, hh_skipped_dup = 0, 0
    for win in HH_WINDOWS:
        days = parse_days(win["days_str"])
        start, end = parse_time(win["time_str"])
        hh_key = (win["bar_id"], start, end)
        if hh_key in existing_hh_keys:
            hh_skipped_dup += 1
            continue
        record = {
            "bar_id":     win["bar_id"],
            "days":       days,
            "start_time": start,
            "end_time":   end,
        }
        if DRY_RUN:
            print(f"  [DRY] hh_windows:  {win['bar_id'][:8]}… {days}  {start}-{end}")
        else:
            client.table("happy_hour_windows").insert(record).execute()
        hh_inserted += 1

    print(f"\n{'='*50}")
    print(f"pint_prices  inserted: {pp_inserted}  (skipped duplicates: {pp_skipped_dup})")
    print(f"hh_windows   inserted: {hh_inserted}  (skipped duplicates: {hh_skipped_dup})")
    print(f"\nBars skipped ({len(SKIPPED)}):")
    for bar_id, name, reason in SKIPPED:
        print(f"  - {name}: {reason}")

if __name__ == "__main__":
    main()
