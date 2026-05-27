-- Migration 003 — keep bars.price_entry_count in sync via trigger.
-- Safe to re-run: uses CREATE OR REPLACE and DROP TRIGGER IF EXISTS.

-- ============================================================
-- Trigger function
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

-- ============================================================
-- Backfill existing bars
-- ============================================================
update bars b
set price_entry_count = (
    select count(*) from pint_prices where bar_id = b.id
);
