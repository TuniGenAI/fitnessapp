-- ============================================================================
-- Migration 0007 — workout_sets.rpe (optional effort rating per set)
-- ----------------------------------------------------------------------------
-- Adds an optional RPE (Rate of Perceived Exertion, 1–10) to each logged set.
-- Null = not rated (the field is always optional so the core log-a-set loop
-- stays one tap). RPE lets the progression suggester and AI coach tell an easy
-- set from a grind — e.g. "hit the top of the range at RPE 7, add load with
-- confidence" vs "RPE 10, hold weight". Numeric(3,1) allows half-points (7.5).
--
-- APPLY THIS like the others: paste into the Supabase SQL Editor and run (see
-- supabase/README.md). Safe/idempotent to re-run.
-- ============================================================================

alter table public.workout_sets
  add column if not exists rpe numeric(3, 1)
    check (rpe is null or (rpe >= 1 and rpe <= 10));

-- Nudge PostgREST to reload its schema cache so the new column is exposed via
-- the REST API immediately (otherwise selects/inserts that reference `rpe`
-- fail until the cache refreshes on its own).
notify pgrst, 'reload schema';
