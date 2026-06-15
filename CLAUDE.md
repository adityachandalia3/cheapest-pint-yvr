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
- Dev server: `cd frontend && npx next dev` (port 3000) or `-p 3001`
- Env vars are in `frontend/.env.local` — `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`

## Branches

- `main` — production at getbrewscanner.com (World Cup features are live here as of Jun 2026)

## Database tables (key ones)

- `bars` — bar metadata, vibe profiles, neighbourhood, `screening_confirmed` (bool), `wc_profile` (JSON)
- `pint_prices` — price per bar, with happy_hour_price_cad
- `happy_hour_windows` — days[], start_time, end_time per bar
- `supporters_bars` — country, flag, bar_id or venue_name, notes
- `wc_matches` — match_date, kickoff_time, team_home, team_away, flag_home, flag_away, supporters_bar_id, neutral_bar_id, is_vancouver_match

### `wc_profile` JSON shape (on `bars` table)

```json
{
  "confidence": "high" | "medium" | "low",
  "booking_required": true | false | null,
  "atmosphere": "lively" | "chill" | null,
  "capacity_notes": "string or null",
  "opens_early": true | false | null,
  "special_features": "string or null",
  "screen_type": "string or null"
}
```

**Capacity signals** — used by WhereToWatchSheet why-line logic:
- `capacity_notes` contains `"large"` → why-line: "Large venue — easier to walk in last minute 🚪"
- `capacity_notes` contains `"fills up"` → why-line: "Fills up fast — arrive 30 mins before kickoff ⏰" + amber ⚠️ chip
- `booking_required: true` → amber ⚠️ "Gets packed fast" chip

**Known screening venues (manually set):**
- Coco Rico Cafe — `screening_confirmed: true`, `confidence: high`, local gem
- Shark Club Sports Bar & Grill — `confidence: medium`, `capacity_notes: 'large venue — usually has walk-in space'`
- The Pint Public House — `confidence: high`, `capacity_notes: 'large but fills up fast — arrive 30 mins before kickoff'`
- The Park Pub — `confidence: medium`, `booking_required: true`

## Pages

- `/` — main bar list with price map + WcPromoBanner (date-gated Jun 11–Jul 19 2026)
- `/bar-map` — map view
- `/find-your-vibe` — chat-based bar recommender
- `/crawl-builder` — pub crawl builder
- `/world-cup` — World Cup 2026 mode (live on main)
- `/install` — add to home screen

## World Cup page (`/world-cup`)

- Server component (`page.tsx`) fetches today's matches + upcoming + supporters bars + screening venues
- Screening venues query: `bars` where `screening_confirmed = true`, sorted by confidence tier then `review_count DESC`
- FK disambiguation: `bars!supporters_bar_id(...)` and `bars!neutral_bar_id(...)` — use column name, NOT constraint name
- Client component (`WorldCupClient.tsx`): match carousel, FeaturedVenuesCarousel, WcVenueList, WhereToWatchSheet

### WhereToWatchSheet — 4-step flow

Step 1 → Match, Step 2 → Area (neighbourhood or Anywhere), Step 3 → Vibe, Step 4 → Results

**Vibes:** `cheap` (sort by price + HH boost), `fans` (supporters bars + community venues), `chill` (sort by rating)

**Results sections (in order):**
1. Primary card (PrimaryCard) or CommunityCard
2. "Or try these →" alternatives (2-col AltCard grid)
3. "📅 Book ahead picks" — `booking_required: true`, any confidence
4. "💎 Hidden gems" — `confidence: high` + `review_count < 300` or null
5. "Also worth knowing 👀" — community venues (fans vibe)
6. "Or go big →" FIFA Fan Festival (fans vibe)

**Community venues (hardcoded):** FIFA Fan Festival, Portuguese Club, Croatian Cultural Centre, Alliance Française, Latin Plaza Hub (Latincouver)

**Why-line priority:** supporters country → special_features → fills-up → large capacity → HH at kickoff → opens early → walk-ins welcome → price < $6 → high rating → fallback

### FeaturedVenuesCarousel

Cards for: Canada Soccer House, Alliance Française, Latin Plaza Hub, FIFA Fan Festival. Cards with `details` field show "More Info →" which opens `FeaturedVenueSheet` bottom sheet.

### WcVenueList

Sort: confidence tier (high → medium → low/null) then `review_count DESC nulls last`.

## Nav & layout

- Mobile bottom tab bar: **hidden everywhere** (was `md:hidden`, changed to `hidden`)
- `frontend/app/layout.tsx`: no bottom padding (removed `pb-[72px]` since nav is hidden)
- Desktop nav: More dropdown + Build a Crawl + My Picks
- Mobile hamburger: Featured "Build a Crawl" card (#B34207) at top, then nav links
- Homepage: WcPromoBanner → Find Your Vibe card → FilterBar → map → Build a Crawl banner → Leaderboard

## Vibe profiler

- `scraper/vibe_profiler.py` — uses Claude (Haiku for cost) to generate vibe tags from Google reviews
- Tags include: `food_destination`, `sports_bar`, `rooftop`, etc.
- Run with `--bar-id <id>` for single bar, `--has-reviews` to filter to bars with reviews

## Vercel env vars

Both `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` must be set for **Production and Preview** (no branch filter). If preview deployments break, check this first.
