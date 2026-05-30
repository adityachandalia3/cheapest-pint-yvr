"""
Phase 1 — discovers bars in Vancouver BC via the Google Places API and upserts
           them into Supabase (deduped by google_place_id). Populates neighbourhood,
           price_tier, and is_permanently_closed from Places API data.
Phase 2 — for each bar with a website:
           1. Navigates to the best available menu page (drink-link → path guesses → Google Maps URL)
           2. Extracts Instagram URL from the homepage
           3. Tries Claude text extraction for prices + happy hour info
           4. If text yields nothing, tries Claude vision on menu images
           5. Logs each attempt to scrape_logs
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import signal
import time
from urllib.parse import urljoin, urlparse

import anthropic
from typing import Optional
import fitz  # PyMuPDF
import requests
from dotenv import load_dotenv
from PIL import Image
from playwright.sync_api import sync_playwright, Browser
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

GOOGLE_PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

VANCOUVER_LAT = 49.2827
VANCOUVER_LNG = -123.1207
SEARCH_RADIUS_M = 15000
SEARCH_KEYWORDS = ["bar", "pub", "brewery"]

DETAIL_FIELDS = (
    "place_id,name,formatted_address,address_components,geometry,"
    "formatted_phone_number,website,opening_hours,"
    "price_level,business_status,url"
)

PRICE_CATEGORIES = ("cheapest_beer", "cheapest_lager", "cheapest_ipa")
MAX_IMAGE_BYTES = 4 * 1024 * 1024   # 4 MB — Claude's per-image limit
MAX_PDF_BYTES   = 5 * 1024 * 1024   # 5 MB — conservative cap; base64 inflates ~33% so this keeps total request well under Claude's limit

MIN_PINT_PRICE_CAD = 2.00   # below this is almost certainly a misread
MAX_PINT_PRICE_CAD = 30.00  # above this is almost certainly a misread

# ---------------------------------------------------------------------------
# Claude prompts
# ---------------------------------------------------------------------------

EXTRACT_PROMPT = """\
You are extracting beer prices from a bar or restaurant's website.

Bar name: {bar_name}
Source URL: {source_url}

Website text:
{text}

The text may be split into two sections by a line that reads:
  --- HAPPY HOUR / SPECIALS PAGE ---

PRICE FORMATS — menus present prices in many ways, recognise all of them:
  - Plain:        "Lager  $7.50"  or  "Lager  7.50"  or  "Lager  7"
  - Multi-size:   "10oz / 16oz / 20oz" then "5.50 / 7.00 / 8.00" → pick the CHEAPEST price and note its size
  - Table/column: price may appear in a separate column to the right of the beer name
  - Range:        "$7–9"  or  "from $7"  → use the lower bound
  - Bundle:       "2 for $14"  or  "two for $16"  → divide by 2
  - Prefix:       "Starting at $7"  or  "as low as $6"  → use that number
  - No $ sign:    bare numbers like "8.50" next to a beer name are prices in CAD

IMPORTANT — always pick the CHEAPEST available price for each beer, regardless of pour size.
If that price is for a 10oz glass, use it. Record the size in pour_size_oz.
If no size is specified, set pour_size_oz to null.
Do NOT assume a beer costs $7 just because most beers do — scan EVERY entry.

Find:
1. The cheapest beer (any style) — lowest price from the main menu, any size
2. The cheapest lager — scan ALL pilsners, lagers, rice lagers
3. The cheapest IPA — scan ALL IPAs and hazy IPAs
4. All happy hour windows and their day/time ranges

Prefer draft prices over bottles or cans where both appear.

CRITICAL RULES — regular vs happy hour pricing:
- `price_cad` is ALWAYS the regular price paid outside of happy hour.
  Take it from the MAIN MENU section (before the --- HAPPY HOUR / SPECIALS PAGE --- marker).
- `happy_hour_price_cad` is the DISCOUNTED price during happy hour ONLY.
  Take it from the happy hour section (after the marker), if one exists.
- `happy_hour_price_cad` MUST be strictly less than `price_cad`. If it is not, set it to null.
- If the page only shows happy hour / specials prices and has no regular menu prices,
  set `price_cad` to those prices and set `happy_hour_price_cad` to null.
- If you cannot clearly tell whether a price is regular or happy-hour, set `happy_hour_price_cad` to null.

HAPPY HOUR WINDOWS — bars may have multiple windows with different day/time combinations:
- Output every distinct window you find.
- Use day abbreviations: "mon" "tue" "wed" "thu" "fri" "sat" "sun".
- If end time is "close", "closing", or "midnight", use "23:59".
- If a single window applies all week, use all seven day abbreviations.

FOR EACH PRICE, also output:
- "confidence": "high" if the price is clearly stated, "medium" if inferred, "low" if uncertain
- "source_section": "main_menu" | "happy_hour" | "specials" | "unknown"

Respond with ONLY a JSON object — no explanation, no markdown fences:
{{
  "cheapest_beer":  {{"name": "Beer Name",  "price_cad": 5.50, "pour_size_oz": 16, "happy_hour_price_cad": 4.50, "confidence": "high", "source_section": "main_menu"}},
  "cheapest_lager": {{"name": "Lager Name", "price_cad": 6.00, "pour_size_oz": 16, "happy_hour_price_cad": null, "confidence": "high", "source_section": "main_menu"}},
  "cheapest_ipa":   {{"name": "IPA Name",   "price_cad": 7.00, "pour_size_oz": null, "happy_hour_price_cad": null, "confidence": "medium", "source_section": "main_menu"}},
  "happy_hour_windows": [
    {{"days": ["mon","tue","wed","thu","fri"], "start": "15:00", "end": "18:00", "notes": null}},
    {{"days": ["sat","sun"], "start": "14:00", "end": "17:00", "notes": null}}
  ]
}}

Set any value to null if it cannot be found.
"""

IMAGE_EXTRACT_PROMPT = """\
You are looking at a bar or restaurant menu image.

Bar name: {bar_name}

From this image, extract:
1. The cheapest beer (any style) and its price in CAD
2. The cheapest lager and its price in CAD
3. The cheapest IPA and its price in CAD
4. All happy hour windows (day ranges + times)

Prefer draft/pint prices over bottles or cans.
Always pick the CHEAPEST available price regardless of pour size, and record the size.

CRITICAL RULES — regular vs happy hour pricing:
- `price_cad` is ALWAYS the regular price outside of happy hour.
- `happy_hour_price_cad` MUST be strictly less than `price_cad`. If not, set it to null.
- If the image only shows happy hour prices, use those as `price_cad` and set `happy_hour_price_cad` to null.

HAPPY HOUR WINDOWS — output every distinct window you find:
- Day abbreviations: "mon" "tue" "wed" "thu" "fri" "sat" "sun"
- "close" / "midnight" end times → use "23:59"

FOR EACH PRICE, also output:
- "confidence": "high" | "medium" | "low"
- "source_section": "main_menu" | "happy_hour" | "specials" | "unknown"

Respond with ONLY a JSON object — no explanation, no markdown fences:
{{
  "cheapest_beer":  {{"name": "Beer Name",  "price_cad": 5.50, "pour_size_oz": 16, "happy_hour_price_cad": null, "confidence": "high", "source_section": "main_menu"}},
  "cheapest_lager": {{"name": "Lager Name", "price_cad": 6.00, "pour_size_oz": 16, "happy_hour_price_cad": null, "confidence": "high", "source_section": "main_menu"}},
  "cheapest_ipa":   {{"name": "IPA Name",   "price_cad": 7.00, "pour_size_oz": null, "happy_hour_price_cad": null, "confidence": "medium", "source_section": "main_menu"}},
  "happy_hour_windows": [
    {{"days": ["mon","tue","wed","thu","fri"], "start": "15:00", "end": "18:00", "notes": null}}
  ]
}}

Set any value to null if not found.
"""

# ---------------------------------------------------------------------------
# Link / image pattern matching
# ---------------------------------------------------------------------------

DRINK_PATTERNS = re.compile(
    r"(beer|draught|draft|tap.?list|drink|beverage|hoppy)",
    re.IGNORECASE,
)
FOOD_PATTERNS = re.compile(
    r"(food|lunch|dinner|brunch|breakfast|catering|dessert|kitchen|dining|cuisine|appetizer|entree)",
    re.IGNORECASE,
)
NON_BEER_PATTERNS = re.compile(
    r"(cocktail|spirit|spirits|wine|whiskey|whisky|vodka|gin|rum|tequila|sake|cider)",
    re.IGNORECASE,
)
MENU_PATTERNS = re.compile(r"menu", re.IGNORECASE)
MENU_IMG_PATTERNS = re.compile(r"(menu|beer|drink|price|tap)", re.IGNORECASE)

MENU_PATH_GUESSES = [
    "/menu/beer-menu", "/menu/drink-menu", "/menu/drinks",
    "/menu", "/drinks", "/drink-menu", "/our-menu", "/menus", "/beer",
]

HAPPY_HOUR_PATTERNS = re.compile(
    r"(happy.?hour|specials?|promotions?|deals?|hoppy.?hour)",
    re.IGNORECASE,
)

HAPPY_HOUR_PATH_GUESSES = [
    "/happy-hour", "/happyhour", "/specials", "/promotions",
    "/menu/happy-hour", "/menu/specials", "/deals",
    "/offers", "/drink-specials", "/daily-specials", "/bar-specials",
    "/menu/promotions", "/happy-hours", "/hh",
]

COFFEE_FILTER = re.compile(
    r'\b(coffee|cafe|café|espresso|roast(?:ers?)?|tea|chai)\b',
    re.IGNORECASE,
)


# ===========================================================================
# Google Places helpers
# ===========================================================================

def fetch_places(keyword: str, lat: float, lng: float, radius: int) -> list[dict]:
    places = []
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "keyword": keyword,
        "key": GOOGLE_PLACES_API_KEY,
    }
    while True:
        resp = requests.get(PLACES_NEARBY_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"  Warning: Places API status={data.get('status')} for '{keyword}'")
            break
        places.extend(data.get("results", []))
        next_token = data.get("next_page_token")
        if not next_token:
            break
        time.sleep(2)
        params = {"pagetoken": next_token, "key": GOOGLE_PLACES_API_KEY}
    return places


def fetch_place_details(place_id: str) -> dict:
    resp = requests.get(
        PLACES_DETAILS_URL,
        params={"place_id": place_id, "fields": DETAIL_FIELDS, "key": GOOGLE_PLACES_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json().get("result", {})


def extract_neighbourhood(components: list) -> str | None:
    for priority in [["neighborhood"], ["sublocality_level_1"], ["sublocality"]]:
        for c in components:
            if any(t in c.get("types", []) for t in priority):
                return c["long_name"]
    return None


def map_price_tier(price_level) -> int | None:
    if price_level is None:
        return None
    if price_level <= 1:
        return 1
    if price_level == 2:
        return 2
    return 3


def build_bar_record(detail: dict) -> tuple[dict, str | None]:
    """
    Returns (bar_db_record, google_maps_url).
    google_maps_url (the Places `url` field) is kept separate — it is not a
    DB column but is used as a fallback menu source in Phase 2.
    """
    loc = detail.get("geometry", {}).get("location", {})
    components = detail.get("address_components", [])
    business_status = detail.get("business_status", "OPERATIONAL")
    record = {
        "google_place_id": detail["place_id"],
        "name": detail.get("name"),
        "address": detail.get("formatted_address"),
        "latitude": loc.get("lat"),
        "longitude": loc.get("lng"),
        "phone": detail.get("formatted_phone_number"),
        "website": detail.get("website"),
        "opening_hours": detail.get("opening_hours", {}).get("weekday_text"),
        "neighbourhood": extract_neighbourhood(components),
        "price_tier": map_price_tier(detail.get("price_level")),
        "is_permanently_closed": business_status == "CLOSED_PERMANENTLY",
    }
    return record, detail.get("url")  # google_maps_url returned separately


# ===========================================================================
# Supabase helpers
# ===========================================================================

def upsert_bars(supabase: Client, records: list[dict]) -> tuple[int, int, set[str]]:
    """Returns (added, updated, new_place_ids)."""
    if not records:
        return 0, 0, set()
    place_ids = [r["google_place_id"] for r in records]
    existing = (
        supabase.table("bars")
        .select("google_place_id")
        .in_("google_place_id", place_ids)
        .execute()
    )
    existing_ids = {row["google_place_id"] for row in existing.data}
    new_place_ids = {pid for pid in place_ids if pid not in existing_ids}
    added = len(new_place_ids)
    updated = len(place_ids) - added
    supabase.table("bars").upsert(records, on_conflict="google_place_id").execute()
    return added, updated, new_place_ids


def upsert_prices(supabase: Client, bar_id: str, price_records: list[dict]) -> None:
    if not price_records:
        return
    for record in price_records:
        record["bar_id"] = bar_id
    supabase.table("pint_prices").upsert(
        price_records, on_conflict="bar_id,category"
    ).execute()


def upsert_happy_hour_windows(supabase: Client, bar_id: str, windows: list[dict]) -> None:
    """Replace all happy hour windows for a bar with a fresh set."""
    if not windows:
        return
    supabase.table("happy_hour_windows").delete().eq("bar_id", bar_id).execute()
    records = [
        {
            "bar_id": bar_id,
            "days": w["days"],
            "start_time": w["start"],
            "end_time": w["end"],
            "notes": w.get("notes"),
        }
        for w in windows
        if w.get("days") and w.get("start") and w.get("end")
    ]
    if records:
        supabase.table("happy_hour_windows").insert(records).execute()


def update_bar_fields(supabase: Client, bar_id: str, fields: dict) -> None:
    if not fields:
        return
    try:
        supabase.table("bars").update(fields).eq("id", bar_id).execute()
    except Exception as e:
        # If a column isn't in PostgREST's schema cache yet, retry without it
        if "PGRST204" in str(e) or "schema cache" in str(e).lower():
            safe = {k: v for k, v in fields.items() if k != "auto_scraped"}
            if safe:
                supabase.table("bars").update(safe).eq("id", bar_id).execute()
        else:
            raise


def log_scrape(
    supabase: Client,
    bar_id: str,
    success: bool,
    menu_found: bool,
    menu_type: str | None = None,
    error_message: str | None = None,
) -> None:
    try:
        supabase.table("scrape_logs").insert({
            "bar_id": bar_id,
            "success": success,
            "menu_found": menu_found,
            "menu_type": menu_type,
            "error_message": error_message,
        }).execute()
    except Exception:
        pass  # logging is best-effort; don't crash the scraper


def detect_menu_type(source_url: str, used_image: bool) -> str:
    """Classify what kind of menu source was used."""
    if used_image:
        return "image"
    url = source_url.lower()
    if url.endswith(".pdf") or ".pdf?" in url:
        return "pdf"
    # Third-party ordering/menu platforms
    if any(p in url for p in ("tock.com", "opentable", "yelp.com", "grubhub",
                               "doordash", "ubereats", "menulog", "bentobox",
                               "popmenu", "toast", "square.site")):
        return "third_party"
    if "maps.google.com" in url:
        return "js_rendered"
    return "html"


# ===========================================================================
# Link / Instagram detection
# ===========================================================================

def find_menu_url(base_url: str, raw_html: str, top_n: int = 3) -> list[str]:
    """Return up to top_n internal drink/menu links ranked by score."""
    base_domain = urlparse(base_url).netloc
    links = re.findall(
        r'<a[^>]+href=["\']([^"\'#][^"\']*)["\'][^>]*>(.*?)</a>',
        raw_html,
        re.IGNORECASE | re.DOTALL,
    )
    seen: set[str] = set()
    candidates: list[tuple[int, str]] = []
    for href, link_text in links:
        full = urljoin(base_url, href)
        if urlparse(full).netloc != base_domain or full in seen:
            continue
        seen.add(full)
        visible = re.sub(r"<[^>]+>", "", link_text).strip()
        score = 0
        if DRINK_PATTERNS.search(full):      score += 5
        if DRINK_PATTERNS.search(visible):   score += 4
        if MENU_PATTERNS.search(full):       score += 2
        if MENU_PATTERNS.search(visible):    score += 1
        if FOOD_PATTERNS.search(full):       score -= 4
        if FOOD_PATTERNS.search(visible):    score -= 3
        if NON_BEER_PATTERNS.search(full):   score -= 3
        if NON_BEER_PATTERNS.search(visible): score -= 2
        if score > 0:
            candidates.append((score, full))
    candidates.sort(reverse=True)
    return [url for _, url in candidates[:top_n]]


def find_happy_hour_url(base_url: str, raw_html: str) -> str | None:
    """Return the best internal happy-hour / specials link, or None."""
    base_domain = urlparse(base_url).netloc
    links = re.findall(
        r'<a[^>]+href=["\']([^"\'#][^"\']*)["\'][^>]*>(.*?)</a>',
        raw_html,
        re.IGNORECASE | re.DOTALL,
    )
    best = (0, None)
    for href, link_text in links:
        full = urljoin(base_url, href)
        if urlparse(full).netloc != base_domain:
            continue
        visible = re.sub(r"<[^>]+>", "", link_text).strip()
        score = 0
        if HAPPY_HOUR_PATTERNS.search(full):    score += 5
        if HAPPY_HOUR_PATTERNS.search(visible): score += 4
        if score > best[0]:
            best = (score, full)
    return best[1]


def find_instagram_url(raw_html: str) -> str | None:
    """Find an Instagram profile link in page HTML."""
    _SKIP = {"p", "explore", "accounts", "reel", "stories", "tv", "reels", "direct"}
    for handle in re.findall(
        r'https?://(?:www\.)?instagram\.com/([a-zA-Z0-9_.]{1,30})/?',
        raw_html,
    ):
        if handle.lower() not in _SKIP:
            return f"https://instagram.com/{handle}"
    return None


# ===========================================================================
# Image-based menu extraction
# ===========================================================================

def find_menu_image_urls(page, max_images: int = 3) -> list[str]:
    """Return up to max_images URLs of images on the current page likely to be menus."""
    imgs = page.evaluate("""() => Array.from(document.querySelectorAll('img[src]')).map(img => ({
        src: img.src,
        width: img.naturalWidth  || img.width  || 0,
        height: img.naturalHeight || img.height || 0,
        alt: img.alt || ''
    }))""")
    candidates = []
    seen: set[str] = set()
    for img in imgs:
        src = img.get("src", "")
        if not src or src.startswith("data:") or src in seen:
            continue
        if not re.search(r"\.(jpe?g|png|webp)(\?|$)", src, re.IGNORECASE):
            continue
        w, h = img.get("width", 0), img.get("height", 0)
        if w and h and (w < 100 or h < 100):
            continue  # skip icons / spacers
        score = 0
        if MENU_IMG_PATTERNS.search(src):           score += 5
        if MENU_IMG_PATTERNS.search(img.get("alt", "")): score += 3
        if w > 800 or h > 600:                      score += 2
        elif w > 400 or h > 300:                    score += 1
        if score > 0:
            candidates.append((score, src))
            seen.add(src)
    candidates.sort(reverse=True)
    return [url for _, url in candidates[:max_images]]


def fetch_image_as_base64(url: str) -> tuple[str, str] | None:
    """Download an image and return (base64_data, media_type), or None on failure."""
    VALID_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; cheapest-pint-yvr/1.0)"},
            timeout=15,
            stream=True,
        )
        resp.raise_for_status()
        ct = resp.headers.get("Content-Type", "").split(";")[0].strip()
        if ct not in VALID_TYPES:
            if re.search(r"\.jpe?g", url, re.I): ct = "image/jpeg"
            elif re.search(r"\.png",  url, re.I): ct = "image/png"
            elif re.search(r"\.webp", url, re.I): ct = "image/webp"
            else: return None
        chunks, total = [], 0
        for chunk in resp.iter_content(65536):
            total += len(chunk)
            if total > MAX_IMAGE_BYTES:
                return None
            chunks.append(chunk)
        return base64.standard_b64encode(b"".join(chunks)).decode(), ct
    except Exception:
        return None


# ===========================================================================
# PDF extraction
# ===========================================================================

PDF_SMALL  = 5  * 1024 * 1024   # <5 MB  → send as Claude document
PDF_LARGE  = 50 * 1024 * 1024   # >50 MB → skip entirely
PDF_RENDER_DPI        = 150
PDF_RENDER_MAX_BYTES  = 1 * 1024 * 1024   # 1 MB per rendered page image
PDF_RENDER_MAX_PAGES  = 3
PDF_DOWNLOAD_TIMEOUT  = 30


def _is_pdf_url(url: str) -> bool:
    u = url.lower()
    return u.endswith(".pdf") or ".pdf?" in u


def get_pdf_content_length(url: str) -> int | None:
    """HEAD request to get PDF file size without downloading. Returns bytes or None."""
    try:
        resp = requests.head(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; cheapest-pint-yvr/1.0)"},
            timeout=10,
            allow_redirects=True,
        )
        cl = resp.headers.get("Content-Length")
        return int(cl) if cl else None
    except Exception:
        return None


def fetch_pdf_bytes(url: str, max_bytes: int = PDF_LARGE) -> bytes | None:
    """Download PDF raw bytes up to max_bytes. Returns None on failure or size exceeded."""
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; cheapest-pint-yvr/1.0)"},
            timeout=PDF_DOWNLOAD_TIMEOUT,
            stream=True,
        )
        resp.raise_for_status()
        chunks, total = [], 0
        for chunk in resp.iter_content(65536):
            total += len(chunk)
            if total > max_bytes:
                return None
            chunks.append(chunk)
        return b"".join(chunks)
    except requests.Timeout:
        return None
    except Exception:
        return None


def render_pdf_pages_as_images(
    pdf_bytes: bytes,
    max_pages: int = PDF_RENDER_MAX_PAGES,
    dpi: int = PDF_RENDER_DPI,
    max_image_bytes: int = PDF_RENDER_MAX_BYTES,
) -> list[tuple[str, str]]:
    """
    Render the first max_pages of a PDF to compressed JPEG images.
    Returns list of (base64_data, 'image/jpeg').
    """
    results = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        for page_num in range(min(max_pages, len(doc))):
            pix = doc[page_num].get_pixmap(matrix=matrix)
            img_bytes = pix.tobytes("jpeg")
            # Compress down to max_image_bytes if needed
            if len(img_bytes) > max_image_bytes:
                img = Image.open(io.BytesIO(img_bytes))
                for quality in range(85, 15, -10):
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=quality)
                    img_bytes = buf.getvalue()
                    if len(img_bytes) <= max_image_bytes:
                        break
            results.append((base64.standard_b64encode(img_bytes).decode(), "image/jpeg"))
    except Exception:
        pass
    return results


def extract_prices_from_pdf(
    claude: anthropic.Anthropic,
    bar_name: str,
    pdf_b64: str,
    source_url: str,
    model: str = "claude-haiku-4-5-20251001",
) -> ExtractionResult:
    msg = claude.messages.create(
        model=model,
        max_tokens=768,
        messages=[{"role": "user", "content": [
            {"type": "document", "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": pdf_b64,
            }},
            {"type": "text", "text": IMAGE_EXTRACT_PROMPT.format(bar_name=bar_name)},
        ]}],
    )
    return _build_price_records(_parse_claude_json(msg.content[0].text), source_url, bar_name)


# ===========================================================================
# Playwright navigation + smart waits
# ===========================================================================

MENU_CONTENT_JS = (
    "() => /beer|lager|ipa|pint|\\$/i.test(document.body.innerText)"
)

IFRAME_PLATFORMS = (
    "bentobox", "toasttab", "square.site", "bopple", "popmenu",
    "menufy", "olo.com", "ordering.app", "clover.com", "lightspeedrestaurant",
)


def _wait_for_menu_content(page, timeout: int = 5000) -> bool:
    """
    Wait up to `timeout` ms for beer/price text to appear.
    Returns True if found, False if timed out (JS render may be incomplete).
    """
    try:
        page.wait_for_function(MENU_CONTENT_JS, timeout=timeout)
        return True
    except Exception:
        return False


def find_iframe_menu_url(page) -> str | None:
    """Return the src of a recognisable third-party menu iframe, or None."""
    try:
        for frame in page.query_selector_all("iframe[src]"):
            src = frame.get_attribute("src") or ""
            if src and any(p in src.lower() for p in IFRAME_PLATFORMS):
                return src
    except Exception:
        pass
    return None


def _nav(page, url: str, timeout: int = 8000) -> None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(1500)
    # If content is still thin the page is likely JS-rendered — wait for network idle
    if len(page.inner_text("body")) < 300:
        try:
            page.wait_for_load_state("networkidle", timeout=4000)
        except Exception:
            pass


def fetch_happy_hour_text(
    page,
    website_url: str,
    homepage_html: str,
    extra_html: str | None = None,
    max_chars: int = 4000,
) -> str:
    """
    Try to find and fetch a happy-hour / specials page.
    Searches homepage_html first, then extra_html (e.g. menu page) if provided.
    Returns its text (truncated), or empty string if nothing found.
    Leaves the page in whatever state it ends up — caller navigates next.
    """
    hh_url = find_happy_hour_url(website_url, homepage_html)
    if not hh_url and extra_html:
        hh_url = find_happy_hour_url(website_url, extra_html)
    if hh_url and hh_url.rstrip("/") != website_url.rstrip("/"):
        try:
            _nav(page, hh_url, timeout=6000)
            text = page.inner_text("body")
            if len(text) > 100:
                return text[:max_chars]
        except Exception:
            pass

    base = website_url.rstrip("/")
    for path in HAPPY_HOUR_PATH_GUESSES:
        guess = base + path
        try:
            _nav(page, guess, timeout=5000)
            if page.url.rstrip("/") == website_url.rstrip("/"):
                continue
            text = page.inner_text("body")
            if len(text) > 100:
                return text[:max_chars]
        except Exception:
            continue

    return ""


def navigate_to_menu(
    page,
    website_url: str,
    google_maps_url: str | None,
    homepage_html: str,
    max_chars: int = 10000,
    skip_path_guesses: bool = False,
) -> tuple[str, str]:
    """
    Given an already-loaded homepage, navigate to the best menu page and also
    try to append happy-hour page text for richer Claude context.
    Returns (combined_text, primary_source_url).
    """
    menu_text = ""
    source_url = website_url

    # 1. Try ranked drink/menu links from the homepage (up to 3 candidates)
    for menu_url in find_menu_url(website_url, homepage_html):
        if menu_url.rstrip("/") == website_url.rstrip("/"):
            continue
        if _is_pdf_url(menu_url):
            return "", menu_url
        _nav(page, menu_url)
        _wait_for_menu_content(page)
        t = page.inner_text("body")
        if len(t) > 200:
            menu_text, source_url = t[:max_chars], menu_url
            break

    # 2. Common menu path guesses (if step 1 found nothing) — skipped for known JS sites
    if not menu_text and not skip_path_guesses:
        base = website_url.rstrip("/")
        for path in MENU_PATH_GUESSES:
            guess = base + path
            try:
                _nav(page, guess, timeout=5000)
                if page.url.rstrip("/") == website_url.rstrip("/"):
                    continue
                _wait_for_menu_content(page)
                t = page.inner_text("body")
                if len(t) > 500:
                    menu_text, source_url = t[:max_chars], page.url
                    break
            except Exception:
                continue

    # 3. Google Maps URL as last-resort text source
    if not menu_text and google_maps_url:
        try:
            _nav(page, google_maps_url, timeout=8000)
            t = page.inner_text("body")
            if len(t) > 300:
                menu_text, source_url = t[:max_chars], google_maps_url
        except Exception:
            pass

    # 4. Fall back to homepage
    if not menu_text:
        _nav(page, website_url)
        menu_text = page.inner_text("body")[:max_chars]
        source_url = website_url

    # 5. Append happy-hour page text (skip guessing loop for known JS sites)
    menu_page_html = page.content()
    hh_text = "" if skip_path_guesses else fetch_happy_hour_text(
        page, website_url, homepage_html, extra_html=menu_page_html
    )
    if hh_text:
        combined = menu_text + "\n\n--- HAPPY HOUR / SPECIALS PAGE ---\n\n" + hh_text
        return combined[:max_chars + 4000], source_url

    return menu_text, source_url


# ===========================================================================
# Claude extraction helpers
# ===========================================================================

def consolidate_menu_text(text: str) -> str:
    """
    Clean and consolidate menu text before sending to Claude:
    1. Strip IBU/ABV preamble lines that appear before every beer entry.
    2. Collapse fragmented 'X\n/\nY' size and price lines back onto one line.
    Applied iteratively until stable.
    """
    # Remove IBU + ABV blocks: a number, then "IBU", then a number, then "%"
    # These appear as preamble before each beer name on some menus (e.g. Malone's)
    text = re.sub(r'\d+(?:\.\d+)?\s*\n\s*IBU\s*\n\s*[\d.]+\s*\n\s*%\s*\n', '\n', text)
    # Catch remaining standalone "IBU" lines
    text = re.sub(r'^\s*IBU\s*$', '', text, flags=re.MULTILINE)
    # Catch standalone ABV-only lines like "5.4\n%\n" that weren't caught above
    text = re.sub(r'^\s*[\d.]+\s*\n\s*%\s*$', '', text, flags=re.MULTILINE)

    # Collapse fragmented slash-separated lines iteratively
    prev = None
    while prev != text:
        prev = text
        # Sizes: "14oz \n / \n 20oz" → "14oz / 20oz"
        text = re.sub(r'(\d+\s*oz)\s*\n\s*/\s*\n\s*(\d)', r'\1 / \2', text)
        # Prices: "6 \n / \n 8" → "6 / 8"
        text = re.sub(r'([\d]+(?:\.\d+)?)\s*\n\s*/\s*\n\s*([\d])', r'\1 / \2', text)

    # Collapse surplus blank lines left by the removals above
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def _parse_claude_json(raw: str) -> dict:
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"```$", "", raw).strip()
    # If Claude appended text after the JSON object, extract just the object
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Happy hour window helpers
# ---------------------------------------------------------------------------

_CLOSE_ALIASES = {"close", "closing", "midnight", "last call", "2:00", "2:00am", "2am"}

_DAY_MAP = {
    "mon": "mon", "monday": "mon",
    "tue": "tue", "tuesday": "tue",
    "wed": "wed", "wednesday": "wed",
    "thu": "thu", "thursday": "thu",
    "fri": "fri", "friday": "fri",
    "sat": "sat", "saturday": "sat",
    "sun": "sun", "sunday": "sun",
}
ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _normalise_hh_windows(raw_windows) -> list[dict]:
    """Parse and normalise happy_hour_windows from a Claude response."""
    if not isinstance(raw_windows, list):
        return []
    result = []
    for w in raw_windows:
        if not isinstance(w, dict):
            continue
        days_raw = w.get("days") or ALL_DAYS
        if not isinstance(days_raw, list):
            continue
        days = [_DAY_MAP.get(str(d).lower().strip()) for d in days_raw]
        days = sorted({d for d in days if d}, key=ALL_DAYS.index)
        if not days:
            days = ALL_DAYS[:]

        start = str(w.get("start") or w.get("start_time") or "").strip()
        end   = str(w.get("end")   or w.get("end_time")   or "").strip()
        if not start or not end:
            continue
        if end.lower() in _CLOSE_ALIASES:
            end = "23:59"
        if not re.match(r'^\d{1,2}:\d{2}$', start):
            continue
        if not re.match(r'^\d{1,2}:\d{2}$', end):
            continue

        result.append({
            "days": days,
            "start": start,
            "end": end,
            "notes": w.get("notes"),
        })
    return result


# ---------------------------------------------------------------------------
# Price validation
# ---------------------------------------------------------------------------

def _validate_price_records(
    records: list[dict],
    hh_windows: list[dict],
    bar_name: str = "",
) -> tuple[list[dict], list[dict], bool]:
    """
    Validate and clean extracted price records.
    Returns (cleaned_records, cleaned_windows, needs_reverification).

    Rules enforced:
    - price_cad must be in [MIN_PINT_PRICE_CAD, MAX_PINT_PRICE_CAD]
    - happy_hour_price_cad must be strictly less than price_cad
    - happy_hour_price_cad must also pass the range check
    - HH prices with no HH windows → strip the HH prices (we have no idea when they apply)
    """
    needs_reverification = False
    cleaned = []
    any_hh_price = False

    for r in records:
        price    = r["price_cad"]
        hh_price = r.get("happy_hour_price_cad")
        category = r["category"]

        if not (MIN_PINT_PRICE_CAD <= price <= MAX_PINT_PRICE_CAD):
            print(f"    ⚠  {category}: regular price ${price:.2f} outside "
                  f"[${MIN_PINT_PRICE_CAD:.0f}–${MAX_PINT_PRICE_CAD:.0f}] — dropped")
            needs_reverification = True
            continue

        if hh_price is not None:
            if hh_price >= price:
                print(f"    ⚠  {category}: HH price ${hh_price:.2f} ≥ regular "
                      f"${price:.2f} — discarding HH price")
                r = {**r, "happy_hour_price_cad": None}
                needs_reverification = True
            elif not (MIN_PINT_PRICE_CAD <= hh_price <= MAX_PINT_PRICE_CAD):
                print(f"    ⚠  {category}: HH price ${hh_price:.2f} outside "
                      f"[${MIN_PINT_PRICE_CAD:.0f}–${MAX_PINT_PRICE_CAD:.0f}] — discarding HH price")
                r = {**r, "happy_hour_price_cad": None}
                needs_reverification = True
            else:
                any_hh_price = True

        cleaned.append(r)

    # HH prices without any time windows are useless — we can't show the right price
    if any_hh_price and not hh_windows:
        print(f"    ⚠  HH prices found but no time windows — stripping HH prices")
        cleaned = [{**r, "happy_hour_price_cad": None} for r in cleaned]
        needs_reverification = True

    return cleaned, hh_windows, needs_reverification


def _build_price_records(
    data: dict,
    source_url: str,
    bar_name: str = "",
) -> tuple[list[dict], list[dict], str | None, str | None, bool]:
    """
    Convert a Claude response dict into
    (price_records, hh_windows, hh_start, hh_end, needs_reverification).
    hh_start/hh_end are derived from the primary window for backwards compat.
    """
    records = []
    for category in PRICE_CATEGORIES:
        entry = data.get(category)
        if not entry or entry.get("price_cad") is None:
            continue
        try:
            price = float(entry["price_cad"])
        except (TypeError, ValueError):
            continue
        hh_raw = entry.get("happy_hour_price_cad")
        sz     = entry.get("pour_size_oz")
        records.append({
            "category":             category,
            "beer_name":            entry.get("name"),
            "price_cad":            price,
            "pour_size_oz":         float(sz) if sz is not None else None,
            "happy_hour_price_cad": float(hh_raw) if hh_raw is not None else None,
            "confidence":           entry.get("confidence"),
            "source_section":       entry.get("source_section"),
            "source_url":           source_url,
            "verified":             False,
        })

    # Parse multi-window happy hour (new format)
    hh_windows = _normalise_hh_windows(data.get("happy_hour_windows", []))

    # Legacy fallback: top-level happy_hour_start / happy_hour_end → single all-week window
    if not hh_windows:
        legacy_start = data.get("happy_hour_start")
        legacy_end   = data.get("happy_hour_end")
        if legacy_start and legacy_end:
            end_val = "23:59" if str(legacy_end).lower().strip() in _CLOSE_ALIASES else legacy_end
            hh_windows = [{"days": ALL_DAYS[:], "start": legacy_start, "end": end_val, "notes": None}]

    records, hh_windows, needs_reverification = _validate_price_records(
        records, hh_windows, bar_name
    )

    # Derive primary window for the bars table (backwards compat)
    hh_start = hh_windows[0]["start"] if hh_windows else None
    hh_end   = hh_windows[0]["end"]   if hh_windows else None

    return records, hh_windows, hh_start, hh_end, needs_reverification


ExtractionResult = tuple  # (price_records, hh_windows, hh_start, hh_end, needs_reverification)


def extract_prices_from_text(
    claude: anthropic.Anthropic,
    bar_name: str,
    text: str,
    source_url: str,
    model: str = "claude-haiku-4-5-20251001",
) -> ExtractionResult:
    msg = claude.messages.create(
        model=model,
        max_tokens=768,
        messages=[{"role": "user", "content": EXTRACT_PROMPT.format(
            bar_name=bar_name,
            source_url=source_url,
            text=consolidate_menu_text(text),
        )}],
    )
    return _build_price_records(_parse_claude_json(msg.content[0].text), source_url, bar_name)


def extract_prices_from_image(
    claude: anthropic.Anthropic,
    bar_name: str,
    image_b64: str,
    media_type: str,
    source_url: str,
    model: str = "claude-haiku-4-5-20251001",
) -> ExtractionResult:
    msg = claude.messages.create(
        model=model,
        max_tokens=768,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {
                "type": "base64", "media_type": media_type, "data": image_b64,
            }},
            {"type": "text", "text": IMAGE_EXTRACT_PROMPT.format(bar_name=bar_name)},
        ]}],
    )
    return _build_price_records(_parse_claude_json(msg.content[0].text), source_url, bar_name)


def extract_prices_from_json_responses(
    claude: anthropic.Anthropic,
    bar_name: str,
    json_texts: list[str],
    source_url: str,
    model: str = "claude-haiku-4-5-20251001",
) -> ExtractionResult:
    """Try to extract prices from XHR/fetch JSON responses captured during page load."""
    combined = "\n\n---\n\n".join(json_texts[:5])
    return extract_prices_from_text(claude, bar_name, combined[:10000], source_url, model=model)


# ===========================================================================
# Main
# ===========================================================================

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true",
        help="Test mode: 50 bars within 2 km of downtown Vancouver")
    parser.add_argument("--prices-only", action="store_true",
        help="Skip discovery — run Phase 2 on all existing DB bars")
    parser.add_argument("--js-only", action="store_true",
        help="Skip discovery — run Phase 2 only on js_rendered bars in DB")
    parser.add_argument("--lat", type=float, default=None, help="Search centre latitude")
    parser.add_argument("--lng", type=float, default=None, help="Search centre longitude")
    parser.add_argument("--radius", type=int, default=None, help="Search radius in metres")
    parser.add_argument("--max-bars", type=int, default=None, help="Max new bars to discover")
    parser.add_argument("--area-label", type=str, default=None, help="Label printed in batch summary")
    parser.add_argument("--bar", type=str, default=None,
        help="Target a single bar by name (case-insensitive substring match). Skips Phase 1.")
    parser.add_argument("--dry-run", action="store_true",
        help="Print what would be written without touching the database")
    parser.add_argument("--model", type=str, default="claude-haiku-4-5-20251001",
        help="Claude model to use for price extraction (default: haiku)")
    args = parser.parse_args()

    if args.test:
        lat, lng, radius, max_bars = 49.28318, -123.12513, 2000, 50
        print("Test mode: 50 bars, 2 km radius, downtown Vancouver\n")
    elif args.lat is not None:
        lat      = args.lat
        lng      = args.lng if args.lng is not None else VANCOUVER_LNG
        radius   = args.radius if args.radius is not None else 2000
        max_bars = args.max_bars
        label    = args.area_label or f"{lat},{lng}"
        print(f"Area: {label} | radius: {radius}m | max new bars: {max_bars}\n")
    else:
        lat, lng, radius, max_bars = VANCOUVER_LAT, VANCOUVER_LNG, SEARCH_RADIUS_M, None

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # ── Phase 1: discover and upsert bars ────────────────────────────────────
    bar_records: list[dict] = []
    google_maps_urls: dict[str, str | None] = {}
    total_added = total_updated = 0
    all_new_place_ids: set[str] = set()

    if args.dry_run:
        print("*** DRY-RUN MODE — nothing will be written to the database ***\n")

    if args.bar:
        print(f"Single-bar mode: targeting bars whose name contains {args.bar!r}\n")

    if args.prices_only or args.js_only or args.bar:
        print("Skipping discovery — using existing bars in DB.\n")
    else:
        seen_ids: set[str] = set()
        candidate_ids: list[str] = []

        for keyword in SEARCH_KEYWORDS:
            print(f"Searching Places API for keyword: '{keyword}' …")
            results = fetch_places(keyword, lat, lng, radius)
            for place in results:
                pid = place.get("place_id")
                if not pid or pid in seen_ids:
                    continue
                place_types = place.get("types", [])
                if not any(t in place_types for t in ("bar", "brewery")):
                    continue
                seen_ids.add(pid)
                candidate_ids.append(pid)
                if max_bars and len(candidate_ids) >= max_bars:
                    break
            print(f"  Found {len(results)} results, {len(candidate_ids)} unique so far")
            if max_bars and len(candidate_ids) >= max_bars:
                break

        print(f"\nFetching details for {len(candidate_ids)} unique places …")
        for i, place_id in enumerate(candidate_ids, 1):
            try:
                detail = fetch_place_details(place_id)
                if detail.get("place_id"):
                    record, maps_url = build_bar_record(detail)
                    if COFFEE_FILTER.search(record.get("name", "")):
                        print(f"  Skipping (coffee/café): {record['name']}")
                        continue
                    if "Vancouver, BC" not in (record.get("address") or ""):
                        print(f"  Skipping (outside Vancouver): {record['name']} — {record.get('address')}")
                        continue
                    bar_records.append(record)
                    google_maps_urls[record["google_place_id"]] = maps_url
            except Exception as exc:
                print(f"  [{i}/{len(candidate_ids)}] Error fetching {place_id}: {exc}")
            if i % 10 == 0:
                time.sleep(1)

        print(f"\nUpserting {len(bar_records)} bars into Supabase …")
        batch_size = 100
        for start in range(0, len(bar_records), batch_size):
            batch = bar_records[start : start + batch_size]
            added, updated, new_ids = upsert_bars(supabase, batch)
            total_added += added
            total_updated += updated
            all_new_place_ids |= new_ids
        print(f"  Added: {total_added}, updated: {total_updated}")

    # ── Phase 2: extract prices from bar websites ────────────────────────────
    query = (
        supabase.table("bars")
        .select("id,name,website,google_place_id")
        .not_.is_("website", "null")
        .eq("is_permanently_closed", False)
    )
    if args.bar:
        query = query.ilike("name", f"%{args.bar}%")
    elif args.js_only:
        query = query.eq("menu_type", "js_rendered")
    elif args.prices_only:
        query = query.eq("price_entry_count", 0)  # only bars with no prices yet
    elif all_new_place_ids:
        # Discovery run — only scrape bars that were newly added (skip pre-existing)
        query = query.in_("google_place_id", list(all_new_place_ids))
    targets = query.execute().data
    print(f"\nExtracting prices from {len(targets)} bar websites …")

    prices_written = prices_skipped = prices_failed = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)

        BAR_TIMEOUT = 120  # seconds — hard cap per bar so one stuck site can't block the run

        for i, bar in enumerate(targets, 1):
            bar_id   = bar["id"]
            name     = bar["name"]
            url      = bar["website"]
            maps_url = google_maps_urls.get(bar["google_place_id"])
            print(f"  [{i}/{len(targets)}] {name}", flush=True)

            def _timeout_handler(signum, frame):
                raise TimeoutError(f"Bar processing exceeded {BAR_TIMEOUT}s")

            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(BAR_TIMEOUT)
            try:
                ctx = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                               "AppleWebKit/537.36 (KHTML, like Gecko) "
                               "Chrome/120.0.0.0 Safari/537.36"
                )
                page = ctx.new_page()

                # ── Set up XHR/fetch JSON interception ───────────────────
                captured_json: list[str] = []

                def _handle_response(response, _cj=captured_json):
                    try:
                        ct = response.headers.get("content-type", "")
                        if "json" not in ct:
                            return
                        body = response.body()
                        if len(body) < 200 or len(body) > 200_000:
                            return
                        text = body.decode("utf-8", errors="ignore")
                        if re.search(
                            r'(\$|\bprice\b|\bbeer\b|\blager\b|\bipa\b|\bdraft\b|\bdraught\b)',
                            text, re.IGNORECASE,
                        ):
                            _cj.append(text[:8000])
                    except Exception:
                        pass

                page.on("response", _handle_response)

                try:
                    # ── Load homepage, extract Instagram ─────────────────
                    _nav(page, url)
                    homepage_html = page.content()
                    # If the homepage has content but no menu candidates, JS may still
                    # be injecting nav links — wait for networkidle and re-fetch
                    if not find_menu_url(url, homepage_html):
                        try:
                            page.wait_for_load_state("networkidle", timeout=6000)
                            homepage_html = page.content()
                        except Exception:
                            pass
                    instagram = find_instagram_url(homepage_html)
                    if instagram:
                        if not args.dry_run:
                            update_bar_fields(supabase, bar_id, {"instagram_url": instagram})
                        print(f"    Instagram: {instagram}")

                    # ── Navigate to best menu page ────────────────────────
                    text, source_url = navigate_to_menu(
                        page, url, maps_url, homepage_html,
                        skip_path_guesses=args.js_only,
                    )
                    via = f" (via {source_url})" if source_url != url else ""

                    # ── Try text extraction ───────────────────────────────
                    records:              list[dict] = []
                    hh_windows:           list[dict] = []
                    hh_start:             str | None = None
                    hh_end:               str | None = None
                    needs_reverification: bool       = False
                    skip_reason:          str | None = None

                    if _is_pdf_url(source_url):
                        print(f"    PDF menu detected — downloading …")
                        pdf_size = get_pdf_content_length(source_url)
                        if pdf_size is not None and pdf_size > PDF_LARGE:
                            skip_reason = f"pdf_too_large ({pdf_size // (1024 * 1024)} MB)"
                        else:
                            pdf_bytes = fetch_pdf_bytes(source_url, max_bytes=PDF_LARGE)
                            if pdf_bytes is None:
                                skip_reason = "pdf_download_failed"
                            elif len(pdf_bytes) < PDF_SMALL:
                                pdf_b64 = base64.standard_b64encode(pdf_bytes).decode()
                                try:
                                    records, hh_windows, hh_start, hh_end, needs_reverification = \
                                        extract_prices_from_pdf(claude, name, pdf_b64, source_url, model=args.model)
                                except Exception as exc:
                                    skip_reason = f"PDF extraction failed: {exc}"
                            else:
                                rendered_pages = render_pdf_pages_as_images(pdf_bytes)
                                for page_b64, img_media_type in rendered_pages:
                                    try:
                                        pg_r, pg_w, pg_s, pg_e, pg_rv = extract_prices_from_image(
                                            claude, name, page_b64, img_media_type, source_url, model=args.model
                                        )
                                        if pg_r:
                                            records, hh_windows, hh_start, hh_end = pg_r, pg_w, pg_s, pg_e
                                            needs_reverification = needs_reverification or pg_rv
                                            break
                                        if pg_w and not hh_windows:
                                            hh_windows, hh_start, hh_end = pg_w, pg_s, pg_e
                                    except Exception:
                                        continue
                                if not records and not skip_reason:
                                    skip_reason = "pdf_no_prices_found"
                    elif len(text) < 100:
                        skip_reason = "Too little content on page"
                    else:
                        records, hh_windows, hh_start, hh_end, needs_reverification = \
                            extract_prices_from_text(claude, name, text, source_url, model=args.model)

                    # ── Try captured XHR JSON if text gave nothing ────────
                    if not records and not _is_pdf_url(source_url) and not skip_reason and captured_json:
                        print(f"    Text gave no prices — trying {len(captured_json)} captured XHR response(s) …")
                        try:
                            records, hh_windows, hh_start, hh_end, needs_reverification = \
                                extract_prices_from_json_responses(claude, name, captured_json, source_url, model=args.model)
                            if records:
                                via = " (XHR JSON)"
                        except Exception:
                            pass

                    # ── Try iframe extraction if text gave nothing ────────
                    iframe_tried = False
                    if not records and not _is_pdf_url(source_url) and not skip_reason:
                        iframe_url = find_iframe_menu_url(page)
                        if iframe_url:
                            iframe_tried = True
                            print(f"    Iframe detected — trying {iframe_url[:70]} …")
                            _nav(page, iframe_url)
                            _wait_for_menu_content(page)
                            iframe_text = page.inner_text("body")
                            if len(iframe_text) > 100:
                                try:
                                    records, hh_windows, hh_start, hh_end, needs_reverification = \
                                        extract_prices_from_text(claude, name, iframe_text, iframe_url, model=args.model)
                                    if records:
                                        source_url = iframe_url
                                        via = f" (iframe: {iframe_url[:50]})"
                                except Exception:
                                    pass

                    # ── Try image extraction if text gave nothing ─────────
                    used_image = False
                    if not records and not _is_pdf_url(source_url):
                        image_urls = find_menu_image_urls(page)
                        if image_urls:
                            print(f"    Text gave no prices — trying {len(image_urls)} menu image(s) …")
                        for img_url in image_urls:
                            img_data = fetch_image_as_base64(img_url)
                            if not img_data:
                                continue
                            b64, media_type = img_data
                            try:
                                img_r, img_w, img_s, img_e, img_rv = extract_prices_from_image(
                                    claude, name, b64, media_type, img_url, model=args.model
                                )
                                if img_r:
                                    records, hh_windows, hh_start, hh_end = img_r, img_w, img_s, img_e
                                    needs_reverification = needs_reverification or img_rv
                                    via = " (menu image)"
                                    used_image = True
                                    break
                            except Exception:
                                continue

                    menu_type = detect_menu_type(source_url, used_image)

                    # ── Persist results ───────────────────────────────────
                    hh_found = bool(hh_windows)

                    if records:
                        # Print per-category prices (always shown, dry-run or not)
                        for r in records:
                            hh_str = f"  (HH: ${r['happy_hour_price_cad']:.2f})" if r.get("happy_hour_price_cad") else ""
                            conf_str = f"  [{r.get('confidence','?')} / {r.get('source_section','?')}]"
                            print(f"    {r['category']}: {r['beer_name'] or '?'}  ${r['price_cad']:.2f}{hh_str}{conf_str}")
                        hh_status = f"{hh_start}–{hh_end}" if hh_found else "not found"
                        print(f"    menu_type: {menu_type} | price_entries: {len(records)} | happy_hour: {hh_status}{via}")
                        if hh_windows:
                            for w in hh_windows:
                                days_str = ",".join(w["days"])
                                print(f"    HH window: [{days_str}] {w['start']}–{w['end']}"
                                      + (f"  notes: {w['notes']}" if w.get("notes") else ""))
                        if needs_reverification:
                            print(f"    needs_reverification: True")

                        if args.dry_run:
                            print(f"    [DRY-RUN] Would write {len(records)} row(s) to pint_prices"
                                  + (f" + {len(hh_windows)} row(s) to happy_hour_windows" if hh_windows else ""))
                        else:
                            upsert_prices(supabase, bar_id, records)
                            if hh_windows:
                                upsert_happy_hour_windows(supabase, bar_id, hh_windows)
                            bar_updates: dict = {
                                "menu_type": menu_type,
                                "notes": None,
                                "needs_reverification": needs_reverification,
                                "auto_scraped": True,
                            }
                            if hh_start: bar_updates["happy_hour_start"] = hh_start
                            if hh_end:   bar_updates["happy_hour_end"]   = hh_end
                            update_bar_fields(supabase, bar_id, bar_updates)
                            log_scrape(
                                supabase, bar_id, success=True, menu_found=True,
                                menu_type=menu_type,
                                error_message="happy hour not found" if not hh_found else None,
                            )
                        prices_written += len(records)
                    else:
                        if not skip_reason:
                            if iframe_tried:
                                skip_reason = "iframe_detected"
                            elif menu_type == "js_rendered":
                                skip_reason = "js_no_prices"
                            else:
                                skip_reason = "price_format_unknown"
                        print(f"    menu_type: {menu_type} | price_entries: 0 | happy_hour: n/a")
                        print(f"    Skipped — {skip_reason}")
                        prices_skipped += 1
                        if not args.dry_run:
                            update_bar_fields(supabase, bar_id, {
                                "menu_type": menu_type,
                                "notes": "No prices available online",
                                "auto_scraped": False,
                            })
                            log_scrape(
                                supabase, bar_id,
                                success=False, menu_found=False,
                                menu_type=menu_type,
                                error_message=skip_reason,
                            )

                finally:
                    ctx.close()

            except json.JSONDecodeError as exc:
                msg = f"Claude returned non-JSON: {exc}"
                print(f"    Failed — {msg}", flush=True)
                prices_failed += 1
                if not args.dry_run:
                    log_scrape(supabase, bar_id, success=False, menu_found=False, error_message=msg)
            except TimeoutError as exc:
                msg = str(exc)
                print(f"    Failed — {msg}", flush=True)
                prices_failed += 1
                if not args.dry_run:
                    log_scrape(supabase, bar_id, success=False, menu_found=False, error_message=msg)
            except Exception as exc:
                msg = str(exc)[:300]
                print(f"    Failed — {msg}", flush=True)
                prices_failed += 1
                if not args.dry_run:
                    log_scrape(supabase, bar_id, success=False, menu_found=False, error_message=msg)
            finally:
                signal.alarm(0)  # cancel the alarm regardless of outcome

        browser.close()

    print(f"\nDone.")
    print(f"  Bars added:         {total_added}")
    print(f"  Bars updated:       {total_updated}")
    print(f"  Price rows written: {prices_written}")
    print(f"  Bars skipped:       {prices_skipped}")
    print(f"  Bars failed:        {prices_failed}")


if __name__ == "__main__":
    main()
