-- ============================================================================
-- Migration 0009 — body-tape measurements + progress photos
-- ----------------------------------------------------------------------------
-- ROADMAP Tier 3 (#11, #12): aesthetic-goal tracking the scale can't give.
--   * Adds optional tape measurements to body_metrics (waist/chest/arms/thighs/hips),
--     logged in the same weigh-in flow. Nullable = not measured.
--   * Adds a progress_photos table. To stay on free tiers with zero storage-bucket
--     setup, the (client-downscaled ~720px JPEG) image is stored as a data URL in a
--     text column — fine at personal scale; a Storage bucket is the future upgrade.
--
-- APPLY THIS like the others: paste into the Supabase SQL Editor and run (see
-- supabase/README.md). Safe/idempotent to re-run.
-- ============================================================================

-- ---- Tape measurements (cm) -------------------------------------------------
alter table public.body_metrics
  add column if not exists waist_cm  numeric(5, 1) check (waist_cm  is null or waist_cm  >= 0),
  add column if not exists chest_cm  numeric(5, 1) check (chest_cm  is null or chest_cm  >= 0),
  add column if not exists arms_cm   numeric(5, 1) check (arms_cm   is null or arms_cm   >= 0),
  add column if not exists thighs_cm numeric(5, 1) check (thighs_cm is null or thighs_cm >= 0),
  add column if not exists hips_cm   numeric(5, 1) check (hips_cm   is null or hips_cm   >= 0);

-- ---- Progress photos --------------------------------------------------------
create table if not exists public.progress_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  taken_at   timestamptz not null default now(),
  data_url   text not null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.progress_photos enable row level security;

create policy "progress_photos_select_own" on public.progress_photos
  for select using (auth.uid() = user_id);
create policy "progress_photos_insert_own" on public.progress_photos
  for insert with check (auth.uid() = user_id);
create policy "progress_photos_delete_own" on public.progress_photos
  for delete using (auth.uid() = user_id);

-- Reload PostgREST's schema cache so the new columns/table are exposed at once.
notify pgrst, 'reload schema';
