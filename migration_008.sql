-- migration_008: happy hour beer name on pint_prices
-- Supports Option B: HH beer may differ from regular beer (e.g. Landshark $5 HH
-- vs Stanley Park $7 regular). Stores the HH beer name separately so the
-- frontend can show the right beer name depending on whether HH is active.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

alter table pint_prices
    add column if not exists happy_hour_beer_name text;
