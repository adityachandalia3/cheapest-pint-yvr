"""
Step 1: Look up Fringe Cafe via Google Places API and insert into bars table.
"""
import os, time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GOOGLE_PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS_URL     = "https://maps.googleapis.com/maps/api/place/details/json"
DETAIL_FIELDS   = (
    "place_id,name,formatted_address,geometry,formatted_phone_number,"
    "website,opening_hours,price_level,business_status,rating,user_ratings_total,"
    "editorial_summary"
)

NEIGHBOURHOOD_HINTS = [
    ("kitsilano",     "Kitsilano"),
    ("w 4th",         "Kitsilano"),
    ("w broadway",    "Kitsilano"),
    ("cornwall",      "Kitsilano"),
    ("yaletown",      "Yaletown"),
    ("mainland",      "Yaletown"),
    ("gastown",       "Gastown"),
    ("water st",      "Gastown"),
    ("chinatown",     "Chinatown"),
    ("keefer",        "Chinatown"),
    ("strathcona",    "Strathcona"),
    ("commercial",    "Commercial Drive"),
    ("mount pleasant","Mount Pleasant"),
    ("main st",       "Main Street"),
    ("e broadway",    "Mount Pleasant"),
    ("granville",     "Downtown"),
    ("robson",        "Downtown"),
    ("georgia",       "Downtown"),
    ("burrard",       "Downtown"),
    ("davie",         "West End"),
    ("denman",        "West End"),
    ("powell",        "Gastown"),
    ("e hastings",    "East Vancouver"),
]

def infer_neighbourhood(address: str) -> str:
    addr_lower = address.lower()
    for fragment, hood in NEIGHBOURHOOD_HINTS:
        if fragment in addr_lower:
            return hood
    return "Vancouver"

def search_place(name: str):
    resp = requests.get(TEXT_SEARCH_URL, params={"query": f"{name} Vancouver BC", "key": GOOGLE_PLACES_API_KEY}, timeout=10)
    resp.raise_for_status()
    results = resp.json().get("results", [])
    return results[0]["place_id"] if results else None

def fetch_details(place_id: str) -> dict:
    resp = requests.get(DETAILS_URL, params={"place_id": place_id, "fields": DETAIL_FIELDS, "key": GOOGLE_PLACES_API_KEY}, timeout=10)
    resp.raise_for_status()
    return resp.json().get("result", {})

print("Looking up Fringe Cafe Vancouver...")
place_id = search_place("Fringe Cafe Vancouver")
if not place_id:
    print("✗ Not found on Google Places")
    exit(1)

d = fetch_details(place_id)
loc = d.get("geometry", {}).get("location", {})
address = d.get("formatted_address", "")

bar = {
    "google_place_id":       d["place_id"],
    "name":                  d.get("name", "Fringe Cafe"),
    "address":               address,
    "latitude":              loc.get("lat"),
    "longitude":             loc.get("lng"),
    "phone":                 d.get("formatted_phone_number"),
    "website":               d.get("website"),
    "opening_hours":         d.get("opening_hours", {}).get("weekday_text") or None,
    "average_rating":        d.get("rating"),
    "review_count":          d.get("user_ratings_total"),
    "neighbourhood":         infer_neighbourhood(address),
    "price_tier":            2,
    "is_permanently_closed": d.get("business_status") == "CLOSED_PERMANENTLY",
}
summary = d.get("editorial_summary", {}).get("overview")
if summary:
    bar["google_summary"] = summary

print(f"  name         : {bar['name']}")
print(f"  address      : {bar['address']}")
print(f"  neighbourhood: {bar['neighbourhood']}")
print(f"  rating       : {bar['average_rating']} ({bar['review_count']} reviews)")
print(f"  website      : {bar['website']}")
print(f"  place_id     : {bar['google_place_id']}")

existing = sb.table("bars").select("id").eq("google_place_id", bar["google_place_id"]).execute().data
if existing:
    print(f"\n  Already in DB: {existing[0]['id']}")
else:
    result = sb.table("bars").insert(bar).execute()
    print(f"\n  ✓ Inserted → {result.data[0]['id']}")
