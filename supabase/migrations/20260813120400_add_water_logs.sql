-- ============================================================================
-- Migration 0005 — water_logs (Milestone 4: nutrition / hydration)
-- ----------------------------------------------------------------------------
-- The initial schema stores a hydration *target* on `goals.water_target_ml`, but
-- had no place to record actual intake. This adds a tiny append-only log: each
-- quick-add on the dashboard writes one row (ml, canonical). Daily intake =
-- sum of rows for that local date. Owner-only RLS, same pattern as every other
-- user table.
--
-- APPLY THIS like the others: paste into the Supabase SQL Editor and run (see
-- supabase/README.md). Safe/idempotent to re-run.
-- ============================================================================

create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null default (now() at time zone 'utc')::date,
  ml         integer not null check (ml <> 0),
  created_at timestamptz not null default now()
);

create index if not exists water_logs_user_date_idx
  on public.water_logs (user_id, log_date);

alter table public.water_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'water_logs'
      and policyname = 'water_logs_select_own'
  ) then
    create policy "water_logs_select_own" on public.water_logs
      for select using (auth.uid() = user_id);
    create policy "water_logs_insert_own" on public.water_logs
      for insert with check (auth.uid() = user_id);
    create policy "water_logs_update_own" on public.water_logs
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    create policy "water_logs_delete_own" on public.water_logs
      for delete using (auth.uid() = user_id);
  end if;
end;
$$;

-- Nudge PostgREST to reload its schema cache so the new table is queryable via
-- the REST API immediately (otherwise the first calls 404 with PGRST205 until
-- the cache refreshes on its own).
notify pgrst, 'reload schema';
