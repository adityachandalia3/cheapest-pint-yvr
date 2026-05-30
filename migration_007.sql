-- migration_007: vibe profiles, bar summaries
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).

alter table bars
    add column if not exists google_summary  text,
    add column if not exists best_known_for  text,
    add column if not exists vibe_profile    jsonb;
