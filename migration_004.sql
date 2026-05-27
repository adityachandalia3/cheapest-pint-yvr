-- Migration 004 — add notes column to bars.
alter table bars add column if not exists notes text;
