"""Insert 4 new bars (metadata only) into the bars table."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

bars = [
    {
        "google_place_id": "ChIJVRfsn19xhlQRz8RcxJPGDPU",
        "name": "Main Street Brewing Co.",
        "address": "261 E 7th Ave, Vancouver, BC V5T 0B8, Canada",
        "latitude": 49.2646765,
        "longitude": -123.0992152,
        "phone": "(604) 336-7711",
        "website": "http://mainstreetbeer.ca/",
        "opening_hours": [
            "Monday: 12:00 – 10:00 PM", "Tuesday: 12:00 – 10:00 PM",
            "Wednesday: 12:00 – 10:00 PM", "Thursday: 12:00 – 10:00 PM",
            "Friday: 12:00 – 11:00 PM", "Saturday: 12:00 – 11:00 PM",
            "Sunday: 12:00 – 9:30 PM",
        ],
        "average_rating": 4.4,
        "review_count": 552,
        "neighbourhood": "Mount Pleasant",
        "price_tier": 2,
        "is_permanently_closed": False,
    },
    {
        "google_place_id": "ChIJefmz9dZzhlQRCnVoCGiuGYs",
        "name": "Yaletown Brewing Company",
        "address": "1111 Mainland St, Vancouver, BC V6B 5L1, Canada",
        "latitude": 49.275665,
        "longitude": -123.1209285,
        "phone": "(604) 681-2739",
        "website": "https://yaletownbrewing.com/",
        "opening_hours": [
            "Monday: 11:30 AM – 11:00 PM", "Tuesday: 11:30 AM – 11:00 PM",
            "Wednesday: 11:30 AM – 11:00 PM", "Thursday: 11:30 AM – 11:00 PM",
            "Friday: 11:30 AM – 11:00 PM", "Saturday: 11:30 AM – 11:00 PM",
            "Sunday: 11:30 AM – 10:00 PM",
        ],
        "average_rating": 4.0,
        "review_count": 1448,
        "neighbourhood": "Yaletown",
        "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Bustling hangout offering house-brewed beers & a weekly small-batch tasting plus unique pub grub.",
    },
    {
        "google_place_id": "ChIJNXC5QXhxhlQRaqLfMpShR-k",
        "name": "Steamworks Brewpub",
        "address": "375 Water St, Vancouver, BC V6B 1B8, Canada",
        "latitude": 49.2848803,
        "longitude": -123.1109429,
        "phone": "(604) 689-2739",
        "website": "https://steamworks.com/brew-pub/",
        "opening_hours": [
            "Monday: 11:30 AM – 12:00 AM", "Tuesday: 11:30 AM – 12:00 AM",
            "Wednesday: 11:30 AM – 12:00 AM", "Thursday: 11:30 AM – 12:00 AM",
            "Friday: 11:30 AM – 1:00 AM", "Saturday: 11:00 AM – 1:00 AM",
            "Sunday: 11:00 AM – 12:00 AM",
        ],
        "average_rating": 4.4,
        "review_count": 7936,
        "neighbourhood": "Gastown",
        "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Cheery microbrewery serving its house beers with diverse pub grub including steaks, pizza & chili.",
    },
    {
        "google_place_id": "ChIJFw7ZEGBxhlQRbkip7_rmQxo",
        "name": "R&B Brewing | Ale & Pizza House",
        "address": "54 E 4th Ave #1, Vancouver, BC V5T 1E8, Canada",
        "latitude": 49.2672357,
        "longitude": -123.1033402,
        "phone": "(604) 336-0275",
        "website": "http://www.randbbrewing.com/",
        "opening_hours": [
            "Monday: 11:30 AM – 11:00 PM", "Tuesday: 11:30 AM – 11:00 PM",
            "Wednesday: 11:30 AM – 11:00 PM", "Thursday: 11:30 AM – 12:00 AM",
            "Friday: 11:30 AM – 12:00 AM", "Saturday: 10:00 AM – 12:00 AM",
            "Sunday: 10:00 AM – 11:00 PM",
        ],
        "average_rating": 4.4,
        "review_count": 1232,
        "neighbourhood": "Mount Pleasant",
        "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "This brewery venue pours a selection of its own beers, special brewings & offers a range of pizzas.",
    },
]

for bar in bars:
    existing = sb.table("bars").select("id").eq("google_place_id", bar["google_place_id"]).execute().data
    if existing:
        print(f"  already exists: {bar['name']} ({existing[0]['id']})")
        continue
    result = sb.table("bars").insert(bar).execute()
    print(f"  inserted: {bar['name']} → {result.data[0]['id']}")
