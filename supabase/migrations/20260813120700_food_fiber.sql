-- ============================================================================
-- Migration 0008 — fiber tracking on foods + food_logs
-- ----------------------------------------------------------------------------
-- Open Food Facts already returns fiber; we were discarding it. This adds an
-- optional `fiber_g` to both the food library and each logged entry so daily
-- fiber can be surfaced (it matters on a bulk, and is the first of the "keep the
-- micros" roadmap item). Nullable = unknown/not provided; the four core macros
-- and the rings are untouched.
--
-- APPLY THIS like the others: paste into the Supabase SQL Editor and run (see
-- supabase/README.md). Safe/idempotent to re-run.
-- ============================================================================

alter table public.foods
  add column if not exists fiber_g numeric(6, 1)
    check (fiber_g is null or fiber_g >= 0);

alter table public.food_logs
  add column if not exists fiber_g numeric(6, 1)
    check (fiber_g is null or fiber_g >= 0);

-- Nudge PostgREST to reload its schema cache so the new columns are exposed via
-- the REST API immediately.
notify pgrst, 'reload schema';
