-- Full schema for cheapest-pint-yvr.
-- All statements use IF NOT EXISTS / OR REPLACE — safe to re-run on a fresh database.
-- To migrate an existing database, run migration.sql instead.

-- ============================================================
-- bars
-- ============================================================
create table if not exists bars (
    id                      uuid primary key default gen_random_uuid(),
    google_place_id         text unique not null,
    name                    text not null,
    address                 text,
    latitude                double precision,
    longitude               double precision,
    phone                   text,
    website                 text,
    opening_hours           jsonb,              -- weekday_text array from Places API
    happy_hour_start        time,
    happy_hour_end          time,
    happy_hour_notes        text,
    average_rating          numeric(3, 2),
    review_count            integer,
    neighbourhood           text,
    instagram_url           text,
    is_permanently_closed   boolean default false,
    price_tier              integer,            -- 1=cheap, 2=mid, 3=pricey
    price_entry_count       integer default 0,  -- denormalised count of pint_prices rows
    menu_type               text check (menu_type in ('html','pdf','image','js_rendered','third_party','none')),
    notes                   text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index if not exists bars_google_place_id_idx on bars (google_place_id);
create index if not exists bars_lat_idx on bars (latitude);
create index if not exists bars_lng_idx on bars (longitude);
create index if not exists bars_neighbourhood_idx on bars (neighbourhood);

-- ============================================================
-- pint_prices
-- ============================================================
-- Three rows per bar: one per category.
-- The unique constraint on (bar_id, category) enables upsert.
create table if not exists pint_prices (
    id                      uuid primary key default gen_random_uuid(),
    bar_id                  uuid not null references bars (id) on delete cascade,
    category                text not null check (category in ('cheapest_beer', 'cheapest_lager', 'cheapest_ipa')),
    beer_name               text,
    price_cad               numeric(6, 2) not null,
    happy_hour_price_cad    numeric(6, 2),
    pour_size_oz            numeric(5, 1),
    source_url              text,
    verified                boolean default false,
    verified_at             timestamptz,
    flagged_as_incorrect    boolean default false,
    flagged_count           integer default 0,
    scraped_at              timestamptz not null default now(),
    created_at              timestamptz not null default now(),

    constraint pint_prices_bar_category_unique unique (bar_id, category)
);

create index if not exists pint_prices_bar_id_idx on pint_prices (bar_id);
create index if not exists pint_prices_price_idx on pint_prices (price_cad);
create index if not exists pint_prices_category_idx on pint_prices (category);

-- ============================================================
-- bar_images
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
-- reviews
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
-- scrape_logs
-- ============================================================
create table if not exists scrape_logs (
    id              uuid primary key default gen_random_uuid(),
    bar_id          uuid references bars (id) on delete set null,
    scraped_at      timestamptz not null default now(),
    success         boolean,
    menu_found      boolean,
    menu_type       text check (menu_type in ('html','pdf','image','js_rendered','third_party','none')),
    error_message   text,
    bars_added      integer,
    bars_updated    integer
);

create index if not exists scrape_logs_bar_id_idx on scrape_logs (bar_id);
create index if not exists scrape_logs_scraped_at_idx on scrape_logs (scraped_at desc);

-- ============================================================
-- price_submissions
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

-- ============================================================
-- updated_at trigger (bars)
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists bars_updated_at on bars;
create trigger bars_updated_at
    before update on bars
    for each row execute function set_updated_at();

-- ============================================================
-- price_entry_count trigger (pint_prices → bars)
-- ============================================================
create or replace function sync_price_entry_count()
returns trigger language plpgsql as $$
begin
    if tg_op = 'DELETE' then
        update bars
        set price_entry_count = (
            select count(*) from pint_prices where bar_id = old.bar_id
        )
        where id = old.bar_id;
    else
        update bars
        set price_entry_count = (
            select count(*) from pint_prices where bar_id = new.bar_id
        )
        where id = new.bar_id;
    end if;
    return null;
end;
$$;

drop trigger if exists pint_prices_sync_count on pint_prices;
create trigger pint_prices_sync_count
    after insert or update or delete on pint_prices
    for each row execute function sync_price_entry_count();
