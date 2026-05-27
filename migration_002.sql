-- Migration 002 — price_entry_count, menu_type on bars; menu_type on scrape_logs.
-- Safe to run: uses ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

-- ============================================================
-- bars — new columns
-- ============================================================
alter table bars add column if not exists price_entry_count integer default 0;
alter table bars add column if not exists menu_type text
    check (menu_type in ('html', 'pdf', 'image', 'js_rendered', 'third_party', 'none'));

-- ============================================================
-- scrape_logs — new column
-- ============================================================
alter table scrape_logs add column if not exists menu_type text
    check (menu_type in ('html', 'pdf', 'image', 'js_rendered', 'third_party', 'none'));
