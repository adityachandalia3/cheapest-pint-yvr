-- Migration 001 — adds new columns and tables to an existing database.
-- Safe to run: uses ADD COLUMN IF NOT EXISTS and CREATE TABLE IF NOT EXISTS.
-- Does not drop or alter any existing columns or rows.

-- ============================================================
-- bars — new columns
-- ============================================================
alter table bars add column if not exists happy_hour_start        time;
alter table bars add column if not exists happy_hour_end          time;
alter table bars add column if not exists happy_hour_notes        text;
alter table bars add column if not exists average_rating          numeric(3, 2);
alter table bars add column if not exists review_count            integer;
alter table bars add column if not exists neighbourhood           text;
alter table bars add column if not exists instagram_url           text;
alter table bars add column if not exists is_permanently_closed   boolean default false;
alter table bars add column if not exists price_tier              integer;

create index if not exists bars_neighbourhood_idx on bars (neighbourhood);

-- ============================================================
-- pint_prices — new columns
-- ============================================================
alter table pint_prices add column if not exists happy_hour_price_cad    numeric(6, 2);
alter table pint_prices add column if not exists verified                boolean default false;
alter table pint_prices add column if not exists verified_at             timestamptz;
alter table pint_prices add column if not exists flagged_as_incorrect    boolean default false;
alter table pint_prices add column if not exists flagged_count           integer default 0;

-- ============================================================
-- bar_images — new table
-- ============================================================
create table if not exists bar_images (
    id          uuid primary key default gen_random_uuid(),
    bar_id      uuid not null references bars (id) on delete cascade,
    image_url   text not null,
    caption     text,
    is_primary  boolean default false,
    created_at  timestamptz not null default now()
);

create index if not exists bar_images_bar_id_idx on bar_images (bar_id);

-- ============================================================
-- reviews — new table
-- ============================================================
create table if not exists reviews (
    id              uuid primary key default gen_random_uuid(),
    bar_id          uuid not null references bars (id) on delete cascade,
    rating          integer check (rating between 1 and 5),
    review_text     text,
    submitted_by    text,
    created_at      timestamptz not null default now()
);

create index if not exists reviews_bar_id_idx on reviews (bar_id);

-- ============================================================
-- scrape_logs — new table
-- ============================================================
create table if not exists scrape_logs (
    id              uuid primary key default gen_random_uuid(),
    bar_id          uuid references bars (id) on delete set null,
    scraped_at      timestamptz not null default now(),
    success         boolean,
    menu_found      boolean,
    error_message   text,
    bars_added      integer,
    bars_updated    integer
);

create index if not exists scrape_logs_bar_id_idx on scrape_logs (bar_id);
create index if not exists scrape_logs_scraped_at_idx on scrape_logs (scraped_at desc);

-- ============================================================
-- price_submissions — new table
-- ============================================================
create table if not exists price_submissions (
    id                      uuid primary key default gen_random_uuid(),
    bar_id                  uuid not null references bars (id) on delete cascade,
    beer_name               text,
    category                text check (category in ('cheapest_beer', 'cheapest_lager', 'cheapest_ipa')),
    price_cad               numeric(6, 2),
    happy_hour_price_cad    numeric(6, 2),
    submitted_by            text,
    status                  text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at              timestamptz not null default now()
);

create index if not exists price_submissions_bar_id_idx on price_submissions (bar_id);
create index if not exists price_submissions_status_idx on price_submissions (status);
