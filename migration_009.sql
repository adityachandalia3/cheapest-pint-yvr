-- migration_009: saved_crawls — stores shareable bar crawl itineraries
-- Run in Supabase SQL editor. Safe to re-run (CREATE TABLE IF NOT EXISTS).

create table if not exists saved_crawls (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  crawl_data jsonb not null,
  created_at timestamptz default now()
);

-- Allow anyone to read a saved crawl by ID (public share links)
alter table saved_crawls enable row level security;

create policy "public read saved crawls"
  on saved_crawls for select
  using (true);
