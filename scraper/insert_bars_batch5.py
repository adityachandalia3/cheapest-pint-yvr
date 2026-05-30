"""Insert 6 new bars (batch 5) into the bars table."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

bars = [
    {
        "google_place_id": "ChIJEYz1RwBxhlQRZQLylDwvT5Q",
        "name": "The Ballyhoo Public House",
        "address": "888 Burrard St #103, Vancouver, BC V6Z 1X9, Canada",
        "latitude": 49.282096, "longitude": -123.1239668,
        "phone": "(604) 423-2771",
        "website": "https://www.freehouse.co/locations/ballyhoo",
        "opening_hours": [
            "Monday: 12:00 PM – 2:00 AM", "Tuesday: 12:00 PM – 2:00 AM",
            "Wednesday: 12:00 PM – 2:00 AM", "Thursday: 12:00 PM – 2:00 AM",
            "Friday: 12:00 PM – 3:00 AM", "Saturday: 12:00 PM – 3:00 AM",
            "Sunday: 12:00 PM – 2:00 AM",
        ],
        "average_rating": 4.3, "review_count": 561,
        "neighbourhood": "Downtown", "price_tier": 2,
        "is_permanently_closed": False,
    },
    {
        "google_place_id": "ChIJ2bLkcrhzhlQRhOLCxW3brh4",
        "name": "Storm Crow Alehouse",
        "address": "1619 W Broadway, Vancouver, BC V6J 1W9, Canada",
        "latitude": 49.2638382, "longitude": -123.1416661,
        "phone": "(604) 428-9670",
        "website": "http://www.stormcrow.com/",
        "opening_hours": [],
        "average_rating": 4.4, "review_count": 2703,
        "neighbourhood": "Kitsilano", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Board & card games entertain patrons at this lively pub with a sci-fi theme, bar fare & patio seats.",
    },
    {
        "google_place_id": "ChIJeRU6feJzhlQRuDkJm1Yjr_Q",
        "name": "Biltmore Cabaret",
        "address": "2755 Prince Edward St, Vancouver, BC V5T 0B5, Canada",
        "latitude": 49.2603959, "longitude": -123.0966792,
        "phone": None,
        "website": "http://www.biltmorecabaret.com/",
        "opening_hours": [],
        "average_rating": 4.2, "review_count": 1037,
        "neighbourhood": "Mount Pleasant", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Eclectic haunt for burlesque shows, DJs spinning soul music, punk bands & other entertainment.",
    },
    {
        "google_place_id": "ChIJW2YgAKdzhlQRbwV3y1GcTDM",
        "name": "Shamrock Storehouse",
        "address": "678 Nelson St, Vancouver, BC V6B 6K4, Canada",
        "latitude": 49.2790455, "longitude": -123.1230341,
        "phone": "(604) 620-1404",
        "website": "https://www.shamrockstorehouse.com/",
        "opening_hours": [
            "Monday: 7:00 AM – 12:00 AM", "Tuesday: 7:00 AM – 12:00 AM",
            "Wednesday: 7:00 AM – 12:00 AM", "Thursday: 7:00 AM – 1:00 AM",
            "Friday: 7:00 AM – 3:00 AM", "Saturday: 7:00 AM – 3:00 AM",
            "Sunday: 7:00 AM – 12:00 AM",
        ],
        "average_rating": 4.2, "review_count": 22,
        "neighbourhood": "Downtown", "price_tier": 2,
        "is_permanently_closed": False,
    },
    {
        "google_place_id": "ChIJtReZSvRyhlQRnNa9l4jlW3M",
        "name": "The Galley Patio & Grill",
        "address": "1300 Discovery St, Vancouver, BC V6R 4L9, Canada",
        "latitude": 49.2754568, "longitude": -123.201313,
        "phone": "(604) 222-1331",
        "website": "http://www.thegalley.ca/",
        "opening_hours": [
            "Monday: 11:30 AM – 9:00 PM", "Tuesday: 11:30 AM – 9:00 PM",
            "Wednesday: 11:30 AM – 9:00 PM", "Thursday: 11:30 AM – 9:00 PM",
            "Friday: 11:30 AM – 9:00 PM",
            "Saturday: 11:00 AM – 9:00 PM", "Sunday: 11:00 AM – 8:30 PM",
        ],
        "average_rating": 4.2, "review_count": 346,
        "neighbourhood": "Point Grey", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Relaxed Canadian eatery serving grill fare & craft beer in a picturesque setting with water views.",
    },
    {
        "google_place_id": "ChIJOVIWNndxhlQRSImd0AeAIIQ",
        "name": "Guilt & Co",
        "address": "1 Alexander Street, Underground, 3 Alexander St, Vancouver, BC V6A 1B2, Canada",
        "latitude": 49.2836479, "longitude": -123.1041275,
        "phone": "(604) 288-1704",
        "website": "http://guiltandcompany.com/",
        "opening_hours": [
            "Monday: 6:00 PM – 12:00 AM", "Tuesday: 6:00 PM – 12:00 AM",
            "Wednesday: 6:00 PM – 12:00 AM", "Thursday: 6:00 PM – 1:00 AM",
            "Friday: 6:00 PM – 2:00 AM", "Saturday: 6:00 PM – 2:00 AM",
            "Sunday: 6:00 PM – 12:00 AM",
        ],
        "average_rating": 4.5, "review_count": 2325,
        "neighbourhood": "Gastown", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Dark, intimate space for cocktails, nibbles & a stage for live performances.",
    },
]

for bar in bars:
    existing = sb.table("bars").select("id").eq("google_place_id", bar["google_place_id"]).execute().data
    if existing:
        print(f"  already exists: {bar['name']} ({existing[0]['id']})")
        continue
    result = sb.table("bars").insert(bar).execute()
    print(f"  inserted: {bar['name']} → {result.data[0]['id']}")
