-- Migration 005 — add pour_size_oz to pint_prices.
alter table pint_prices add column if not exists pour_size_oz numeric(5,1);
