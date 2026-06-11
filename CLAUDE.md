# Brewscanner (cheapest-pint-yvr)

Find the cheapest pint in Vancouver. Real-time prices, happy hour windows, pub crawl builder, Find Your Vibe chat, World Cup mode.

## Stack

- **Frontend**: Next.js 14 App Router — `/frontend`
- **Scraper**: Python — `/scraper/scraper.py` (Google Places + Claude API → Supabase)
- **Database**: Supabase (Postgres)
- **Hosting**: Vercel (main branch = production, feature branches = preview deployments)

## Key rules — read before doing anything

- **NEVER push to `main` (production) without explicit user approval**
- **NEVER write to the database without explicit user approval**
- Active feature branch: `feature/world-cup` — do NOT merge to main until user says so
- Dev server: `cd frontend && npx next dev` (port 3000) or `-p 3001`
- Env vars are in `frontend/.env.local` — `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`

## Branches

- `main` — production at getbrewscanner.com
- `feature/world-cup` — World Cup 2026 mode, staging on Vercel preview

## Database tables (key ones)

- `bars` — bar metadata, vibe profiles, neighbourhood
- `pint_prices` — price per bar, with happy_hour_price_cad
- `happy_hour_windows` — days[], start_time, end_time per bar
- `supporters_bars` — country, flag, bar_id or venue_name, notes
- `wc_matches` — match_date, kickoff_time, team_home, team_away, flag_home, flag_away, supporters_bar_id, neutral_bar_id, is_vancouver_match

## Pages

- `/` — main bar list with price map
- `/bar-map` — map view
- `/find-your-vibe` — chat-based bar recommender
- `/crawl-builder` — pub crawl builder
- `/world-cup` — World Cup 2026 mode (feature/world-cup branch only)
- `/install` — add to home screen

## World Cup page (`/world-cup`)

- Server component (`page.tsx`) fetches today's matches + next match + supporters bars
- FK disambiguation: `bars!supporters_bar_id(...)` and `bars!neutral_bar_id(...)` — use column name, NOT constraint name
- Client component (`WorldCupClient.tsx`): carousel of match cards, country pills, CTA
- Cards: blue gradient (`linear-gradient(135deg, #1e3a8a, #1d4ed8, #312e81)`), Vancouver matches use amber gradient
- Carousel: full viewport width, `PEEK_MOBILE=28`, `PEEK_DESKTOP=160`, `h-[190px] md:h-[240px]`

## Vibe profiler

- `scraper/vibe_profiler.py` — uses Claude (Haiku for cost) to generate vibe tags from Google reviews
- Tags include: `food_destination` (added recently), `sports_bar`, `rooftop`, etc.
- Run with `--bar-id <id>` for single bar, `--has-reviews` to filter to bars with reviews

## Vercel env vars

Both `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` must be set for **Production and Preview** (no branch filter). If preview deployments break, check this first.
