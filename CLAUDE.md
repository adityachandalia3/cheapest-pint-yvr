# cheapest-pint-yvr

A web app that helps people find the cheapest pint of beer in Vancouver, BC.

## What this project does

Aggregates pint prices from bars and pubs across Vancouver so users can quickly find the best deal near them.

## Stack

- **Frontend**: Next.js (to be built in `/app` or `/frontend`)
- **Scraper**: Python (`/scraper/scraper.py`) — discovers bars via Google Places API, extracts pint prices from menus using the Claude API, writes everything to Supabase
- **Database**: Supabase (Postgres) — two main tables: `bars` and `pint_prices`

## Data pipeline

1. `scraper.py` calls the Google Places API to find all bars/pubs in Vancouver BC
2. For each bar, it fetches name, address, lat/lng, phone, website, and opening hours
3. Bar records are upserted into the `bars` table (deduped by `google_place_id`)
4. Menu URLs / text are passed to the Claude API to parse and extract pint prices
5. Extracted prices are written to `pint_prices`, linked to the bar by `bar_id`

## Environment variables

See `.env.example` for required keys. Copy it to `.env` and fill in real values before running anything.

## Database schema

See `supabase_schema.sql` — run this in the Supabase SQL editor to set up the tables.

## Running the scraper

```bash
cd scraper
pip install -r requirements.txt
python scraper.py
```
