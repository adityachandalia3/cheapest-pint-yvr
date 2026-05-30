"""Insert 5 new bars (batch 3) into the bars table."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

bars = [
    {
        "google_place_id": "ChIJAasqz0hxhlQRU3dfsfnfkoU",
        "name": "St. Augustine's",
        "address": "2360 Commercial Dr, Vancouver, BC V5N 4B7, Canada",
        "latitude": 49.2637918, "longitude": -123.0695484,
        "phone": "(604) 225-9135",
        "website": "http://staugustinesvancouver.com/",
        "opening_hours": [
            "Monday: 11:30 AM – 1:00 AM", "Tuesday: 11:30 AM – 12:00 AM",
            "Wednesday: 11:30 AM – 1:00 AM", "Thursday: 11:30 AM – 1:00 AM",
            "Friday: 11:30 AM – 1:00 AM", "Saturday: 11:30 AM – 1:00 AM",
            "Sunday: 11:30 AM – 1:00 AM",
        ],
        "average_rating": 4.1, "review_count": 2837,
        "neighbourhood": "Commercial Drive", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Relaxed tavern offering Canadian pub grub, a rotating selection of local microbrews & a patio.",
    },
    {
        "google_place_id": "ChIJ4S1x8xlxhlQRE8HG0PL5H8Y",
        "name": "Parallel 49 Brewing Company",
        "address": "1950 Triumph St, Vancouver, BC V5L 1K5, Canada",
        "latitude": 49.2837864, "longitude": -123.064411,
        "phone": "(604) 558-2739",
        "website": "http://parallel49brewing.com/",
        "opening_hours": [
            "Monday: 11:00 AM – 11:00 PM", "Tuesday: 11:00 AM – 11:00 PM",
            "Wednesday: 11:00 AM – 11:00 PM", "Thursday: 11:00 AM – 11:00 PM",
            "Friday: 11:00 AM – 12:00 AM", "Saturday: 11:00 AM – 12:00 AM",
            "Sunday: 11:00 AM – 11:00 PM",
        ],
        "average_rating": 4.4, "review_count": 1310,
        "neighbourhood": "East Vancouver", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Brewery with a low-key tasting room offering its craft beer on tap, plus bar bites & growler fills.",
    },
    {
        "google_place_id": "ChIJpwbgtEFxhlQRE-QxNGY40wo",
        "name": "Strange Fellows Brewing",
        "address": "1345 Clark Dr, Vancouver, BC V5L 3K9, Canada",
        "latitude": 49.2725703, "longitude": -123.0777551,
        "phone": "(604) 215-0092",
        "website": "http://strangefellowsbrewing.com/",
        "opening_hours": [
            "Monday: 12:00 – 10:00 PM", "Tuesday: 12:00 – 10:00 PM",
            "Wednesday: 12:00 – 10:00 PM", "Thursday: 12:00 – 10:00 PM",
            "Friday: 12:00 – 11:00 PM", "Saturday: 12:00 – 11:00 PM",
            "Sunday: 12:00 – 10:00 PM",
        ],
        "average_rating": 4.6, "review_count": 589,
        "neighbourhood": "Strathcona", "price_tier": 2,
        "is_permanently_closed": False,
    },
    {
        "google_place_id": "ChIJEzyfYHdxhlQRC_Zlm3TTciw",
        "name": "The Lamplighter Public House",
        "address": "92 Water St, Vancouver, BC V6B 2K8, Canada",
        "latitude": 49.28371079999999, "longitude": -123.1062305,
        "phone": "(604) 687-4424",
        "website": "https://www.freehouse.co/locations/lamplighter",
        "opening_hours": [
            "Monday: Closed", "Tuesday: Closed",
            "Wednesday: 4:00 PM – 12:00 AM", "Thursday: 4:00 PM – 1:00 AM",
            "Friday: 4:00 PM – 3:00 AM", "Saturday: 4:00 PM – 3:00 AM",
            "Sunday: 4:00 PM – 12:00 AM",
        ],
        "average_rating": 4.1, "review_count": 2155,
        "neighbourhood": "Gastown", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Easygoing, brick-lined hangout with stained glass & a patio for drinks, pub plates & weekend DJs.",
    },
    {
        "google_place_id": "ChIJD9X_gIB-C0ER-aY29gH18cM",
        "name": "CRAFT Beer Market False Creek",
        "address": "85 W 1st Ave, Vancouver, BC V5Y 0C4, Canada",
        "latitude": 49.27076630000001, "longitude": -123.1063801,
        "phone": "(604) 709-2337",
        "website": "https://www.craftbeermarket.ca/locations/vancouver-false-creek/",
        "opening_hours": [
            "Monday: 11:00 AM – 12:00 AM", "Tuesday: 11:00 AM – 12:00 AM",
            "Wednesday: 11:00 AM – 12:00 AM", "Thursday: 11:00 AM – 12:00 AM",
            "Friday: 11:00 AM – 1:00 AM", "Saturday: 10:30 AM – 1:00 AM",
            "Sunday: 10:30 AM – 12:00 AM",
        ],
        "average_rating": 4.3, "review_count": 8257,
        "neighbourhood": "False Creek", "price_tier": 2,
        "is_permanently_closed": False,
        "google_summary": "Former Olympic village outpost set in the 1930s Salt Building, serving draft brews & pub grub.",
    },
]

for bar in bars:
    existing = sb.table("bars").select("id").eq("google_place_id", bar["google_place_id"]).execute().data
    if existing:
        print(f"  already exists: {bar['name']}")
        continue
    result = sb.table("bars").insert(bar).execute()
    print(f"  inserted: {bar['name']} → {result.data[0]['id']}")
