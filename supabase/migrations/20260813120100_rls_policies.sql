-- ============================================================================
-- Migration 0002 — Row-Level Security (RLS) + new-user bootstrap
-- ----------------------------------------------------------------------------
-- CLAUDE.md §5: "every table has row-level security so a user only ever sees
-- their own rows." This migration:
--   1. Enables RLS on every table.
--   2. Adds policies so each user can only read/write rows where user_id = auth.uid().
--      Exceptions:
--        * exercises           — global rows (user_id IS NULL) are readable by all.
--        * supplement_templates — global read-only reference data.
--   3. Adds a trigger that, when a new auth user is created, seeds their profile,
--      an empty goals row, and a personal copy of the default supplement stack.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.goals                enable row level security;
alter table public.exercises            enable row level security;
alter table public.programs             enable row level security;
alter table public.program_days         enable row level security;
alter table public.program_exercises    enable row level security;
alter table public.workouts             enable row level security;
alter table public.workout_sets         enable row level security;
alter table public.personal_records     enable row level security;
alter table public.foods                enable row level security;
alter table public.meals                enable row level security;
alter table public.meal_items           enable row level security;
alter table public.food_logs            enable row level security;
alter table public.supplement_templates enable row level security;
alter table public.supplements          enable row level security;
alter table public.supplement_logs      enable row level security;
alter table public.body_metrics         enable row level security;
alter table public.coach_messages       enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------------------------

-- profiles: a user sees/edits only their own profile. Inserts are handled by the
-- new-user trigger (SECURITY DEFINER), but we allow self-insert as a safety net.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- exercises: read global (user_id IS NULL) + your own; write only your own customs.
create policy "exercises_select_global_or_own" on public.exercises
  for select using (user_id is null or auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises
  for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises
  for delete using (auth.uid() = user_id);

-- supplement_templates: global reference data — any authenticated user may read.
create policy "supplement_templates_select_all" on public.supplement_templates
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- All remaining tables follow the same "owner-only" pattern. Rather than repeat
-- four policies per table by hand, generate them in a DO block.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  owner_tables text[] := array[
    'goals', 'programs', 'program_days', 'program_exercises',
    'workouts', 'workout_sets', 'personal_records',
    'foods', 'meals', 'meal_items', 'food_logs',
    'supplements', 'supplement_logs', 'body_metrics', 'coach_messages'
  ];
begin
  foreach t in array owner_tables loop
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id);',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id);',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id);',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. New-user bootstrap: profile + empty goals + default supplement stack
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profile (name/avatar pulled from the Google OAuth metadata when present).
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Empty goals row (targets filled in later via the TDEE calculator / manual entry).
  insert into public.goals (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- Personal copy of the seeded default supplement stack.
  insert into public.supplements
    (user_id, name, serving_label, category, calories, protein_g, carbs_g, fat_g, is_active, sort_order)
  select
    new.id, t.name, t.serving_label, t.category, t.calories, t.protein_g, t.carbs_g, t.fat_g, true, t.sort_order
  from public.supplement_templates t;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
