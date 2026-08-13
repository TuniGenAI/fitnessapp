-- ============================================================================
-- Migration 0006 — supplement_logs.count (multiple servings per day)
-- ----------------------------------------------------------------------------
-- Until now a supplement was a once-a-day tick (`taken` boolean). This adds a
-- `count` = how many servings were taken today, so e.g. two protein scoops
-- contribute 2× the macros. `taken` stays as the "at least one" flag (kept in
-- sync by the app: taken = count > 0) so adherence logic is unchanged.
--
-- APPLY THIS like the others: paste into the Supabase SQL Editor and run (see
-- supabase/README.md). Safe/idempotent to re-run.
-- ============================================================================

alter table public.supplement_logs
  add column if not exists count integer not null default 1 check (count >= 0);

-- Backfill: existing ticked rows represent one serving.
update public.supplement_logs set count = 1 where taken and count = 0;

-- Nudge PostgREST to reload its schema cache so the new column is exposed via
-- the REST API immediately (otherwise selects/inserts that reference `count`
-- fail until the cache refreshes on its own).
notify pgrst, 'reload schema';
