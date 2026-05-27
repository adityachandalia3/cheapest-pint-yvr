-- migration_006: multi-window happy hours, extraction quality fields
-- Safe to re-run (all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── happy_hour_windows ───────────────────────────────────────────────────────
-- One row per distinct happy-hour window per bar.
-- Replaces the single happy_hour_start/happy_hour_end on bars (those columns
-- are kept as a denormalised "primary window" for backwards compat).
create table if not exists happy_hour_windows (
    id          uuid primary key default gen_random_uuid(),
    bar_id      uuid not null references bars(id) on delete cascade,
    days        text[] not null,   -- e.g. ARRAY['mon','tue','wed','thu','fri']
    start_time  time not null,
    end_time    time not null,
    notes       text,
    created_at  timestamptz not null default now()
);

create index if not exists happy_hour_windows_bar_id_idx on happy_hour_windows(bar_id);

-- ── bars additions ───────────────────────────────────────────────────────────
-- Flag bars whose extracted prices were modified/discarded during validation
-- so we know to re-scrape them in the next pass.
alter table bars
    add column if not exists needs_reverification boolean default false;

-- ── pint_prices additions ────────────────────────────────────────────────────
-- How confident Claude was in each extracted price.
alter table pint_prices
    add column if not exists confidence text
        check (confidence in ('high', 'medium', 'low'));

-- Which section of the menu the price came from.
alter table pint_prices
    add column if not exists source_section text
        check (source_section in ('main_menu', 'happy_hour', 'specials', 'unknown'));
