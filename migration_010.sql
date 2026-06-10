-- migration_010: World Cup 2026 — supporters bars and match schedule
-- Run in Supabase SQL editor. Safe to re-run (CREATE TABLE IF NOT EXISTS).

-- ── Supporters bars (country → bar/venue mapping) ──────────────────────────
create table if not exists supporters_bars (
  id            uuid primary key default gen_random_uuid(),
  country       text not null,
  flag          text not null,
  bar_id        uuid references bars(id) on delete set null,
  venue_name    text,
  neighbourhood text,
  notes         text,
  verified      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table supporters_bars enable row level security;

create policy "public read supporters_bars"
  on supporters_bars for select using (true);

-- ── Match schedule ──────────────────────────────────────────────────────────
create table if not exists wc_matches (
  id                   uuid primary key default gen_random_uuid(),
  match_date           date not null,
  kickoff_time         time not null,
  group_label          text,
  venue                text,
  team_home            text not null,
  team_away            text not null,
  flag_home            text not null,
  flag_away            text not null,
  is_vancouver_match   boolean not null default false,
  supporters_bar_id    uuid references bars(id) on delete set null,
  supporters_bar_label text,
  neutral_bar_id       uuid references bars(id) on delete set null,
  created_at           timestamptz not null default now()
);

alter table wc_matches enable row level security;

create policy "public read wc_matches"
  on wc_matches for select using (true);

create index if not exists wc_matches_date_idx on wc_matches (match_date, kickoff_time);
