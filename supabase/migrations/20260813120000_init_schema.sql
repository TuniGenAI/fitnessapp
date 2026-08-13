-- ============================================================================
-- Migration 0001 — Core schema
-- ----------------------------------------------------------------------------
-- Creates every table for the Fitness App (see PRD.md §7 "Data model").
-- Row-level security is enabled and seeded in the NEXT migration (0002).
--
-- Conventions (see CLAUDE.md §5):
--   * Canonical units stored in the DB: weight in KG, volume in ML, macros in GRAMS.
--   * Timestamps are timestamptz in UTC; the app converts to local time for display.
--   * Every user-owned table has `user_id` referencing auth.users so RLS can scope rows.
--   * IDs are UUIDs (gen_random_uuid).
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto; Supabase ships it, this is just a safety net.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared helper: keep `updated_at` fresh on UPDATE.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles — one row per signed-in user (mirrors auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  -- Display-unit preferences. Storage stays canonical (kg/ml); these drive UI only.
  weight_unit   text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  volume_unit   text not null default 'ml' check (volume_unit in ('ml', 'oz')),
  -- Default in-workout coach behaviour; the user can still choose per session.
  coach_mode    text not null default 'recap' check (coach_mode in ('reactions', 'recap')),
  coach_enabled boolean not null default true,
  -- Gemini API key, per-user. RLS ensures a user can only ever read their own row.
  -- (Calls run server-side in an edge function; the key is never sent to other users.)
  gemini_api_key text,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- goals — nutrition targets (one row per user; train/rest variants optional)
-- ============================================================================
create table if not exists public.goals (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users (id) on delete cascade,
  goal_type            text check (goal_type in ('cut', 'bulk', 'maintain')),
  source               text not null default 'manual' check (source in ('calculated', 'manual')),
  -- Training-day (default) targets.
  calorie_target       integer,
  protein_target_g     integer,
  carbs_target_g       integer,
  fat_target_g         integer,
  water_target_ml      integer not null default 3000,
  -- Optional rest-day variants (PRD §4.3 P2: data model supports it now, UI later).
  calorie_target_rest  integer,
  protein_target_rest_g integer,
  carbs_target_rest_g  integer,
  fat_target_rest_g    integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ============================================================================
-- exercises — library. Global rows (user_id IS NULL) are the seeded library;
--             user-owned rows (user_id = auth.uid()) are custom additions.
-- ============================================================================
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete cascade, -- NULL = global/seeded
  name              text not null,
  type              text not null check (type in ('free_weight', 'machine', 'cable', 'bodyweight')),
  muscle_group      text not null,           -- primary group, e.g. 'chest', 'back', 'legs'
  secondary_muscles text[] not null default '{}',
  created_at        timestamptz not null default now()
);

-- One exercise name per owner (global names are unique among global rows).
create unique index if not exists exercises_global_name_key
  on public.exercises (lower(name)) where user_id is null;
create unique index if not exists exercises_user_name_key
  on public.exercises (user_id, lower(name)) where user_id is not null;

-- ============================================================================
-- programs → program_days → program_exercises  (the plan / split)
-- ============================================================================
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create table if not exists public.program_days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade, -- denormalized for RLS
  name       text not null,          -- e.g. 'Push', 'Pull', 'Legs'
  day_order  integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists program_days_program_id_idx on public.program_days (program_id);

create table if not exists public.program_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references public.program_days (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade, -- denormalized for RLS
  exercise_id     uuid not null references public.exercises (id) on delete restrict,
  target_sets     integer not null default 3,
  target_reps_low integer not null default 8,
  target_reps_high integer not null default 12,
  order_index     integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists program_exercises_day_idx on public.program_exercises (program_day_id);

-- ============================================================================
-- workouts → workout_sets  (actual logged sessions)
-- ============================================================================
create table if not exists public.workouts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  program_day_id uuid references public.program_days (id) on delete set null,
  name           text,
  coach_mode     text check (coach_mode in ('reactions', 'recap')),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,             -- NULL while a session is in progress
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table if not exists public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade, -- denormalized for RLS
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_number  integer not null default 1,
  weight_kg   numeric(6, 2) not null default 0,   -- canonical kg
  reps        integer not null default 0,
  is_warmup   boolean not null default false,
  is_pr       boolean not null default false,     -- flagged when this set set a PR
  logged_at   timestamptz not null default now()
);
create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id);
create index if not exists workout_sets_exercise_idx on public.workout_sets (user_id, exercise_id, logged_at desc);

-- ============================================================================
-- personal_records — current best per exercise per record type (updated on beat)
-- ============================================================================
create table if not exists public.personal_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  exercise_id    uuid not null references public.exercises (id) on delete cascade,
  record_type    text not null check (record_type in ('weight', 'volume', 'reps')),
  value          numeric(10, 2) not null,   -- kg (weight), kg*reps (volume), or reps
  weight_kg      numeric(6, 2),
  reps           integer,
  workout_set_id uuid references public.workout_sets (id) on delete set null,
  achieved_at    timestamptz not null default now(),
  unique (user_id, exercise_id, record_type)
);

-- ============================================================================
-- foods — custom foods + cached Open Food Facts items
-- ============================================================================
create table if not exists public.foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  brand         text,
  barcode       text,
  source        text not null default 'custom' check (source in ('custom', 'open_food_facts')),
  off_id        text,                       -- Open Food Facts product id, when applicable
  serving_size_g numeric(8, 2),             -- grams per serving (nullable for e.g. "1 unit")
  serving_label  text,                      -- e.g. '1 scoop', '100 g', '1 slice'
  -- Macros PER SERVING (canonical grams / kcal).
  calories      numeric(8, 2) not null default 0,
  protein_g     numeric(7, 2) not null default 0,
  carbs_g       numeric(7, 2) not null default 0,
  fat_g         numeric(7, 2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists foods_user_idx on public.foods (user_id);
create index if not exists foods_barcode_idx on public.foods (user_id, barcode);

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

-- ============================================================================
-- meals → meal_items  (saved reusable meals for one-tap logging)
-- ============================================================================
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_items (
  id       uuid primary key default gen_random_uuid(),
  meal_id  uuid not null references public.meals (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade, -- denormalized for RLS
  food_id  uuid not null references public.foods (id) on delete cascade,
  servings numeric(6, 2) not null default 1
);
create index if not exists meal_items_meal_idx on public.meal_items (meal_id);

-- ============================================================================
-- food_logs — dated entries counting toward daily totals.
--             Macro columns are a SNAPSHOT (already multiplied by servings) so
--             history stays correct even if the source food is later edited/deleted.
-- ============================================================================
create table if not exists public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  food_id    uuid references public.foods (id) on delete set null,
  log_date   date not null default current_date,
  meal_type  text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  servings   numeric(6, 2) not null default 1,
  name       text not null,             -- snapshot label
  calories   numeric(8, 2) not null default 0,   -- snapshot totals (servings already applied)
  protein_g  numeric(7, 2) not null default 0,
  carbs_g    numeric(7, 2) not null default 0,
  fat_g      numeric(7, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, log_date);

-- ============================================================================
-- supplement_templates — GLOBAL seeded defaults (read-only to users).
--   New users get a personal copy in `supplements` via the new-user trigger.
-- ============================================================================
create table if not exists public.supplement_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  serving_label   text,
  category        text not null default 'general',
  -- Macro contribution per serving (0 for non-macro supps like creatine/vitamins).
  calories        numeric(7, 2) not null default 0,
  protein_g       numeric(6, 2) not null default 0,
  carbs_g         numeric(6, 2) not null default 0,
  fat_g           numeric(6, 2) not null default 0,
  sort_order      integer not null default 0
);

-- ============================================================================
-- supplements — the user's personal stack (simple once-a-day items)
-- ============================================================================
create table if not exists public.supplements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  serving_label text,
  category      text not null default 'general',
  calories      numeric(7, 2) not null default 0,
  protein_g     numeric(6, 2) not null default 0,
  carbs_g       numeric(6, 2) not null default 0,
  fat_g         numeric(6, 2) not null default 0,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists supplements_user_idx on public.supplements (user_id);

-- ============================================================================
-- supplement_logs — one tick per supplement per day
-- ============================================================================
create table if not exists public.supplement_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  log_date      date not null default current_date,
  taken         boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (user_id, supplement_id, log_date)
);
create index if not exists supplement_logs_user_date_idx on public.supplement_logs (user_id, log_date);

-- ============================================================================
-- body_metrics — manual weigh-ins (weight + composition), logged whenever
-- ============================================================================
create table if not exists public.body_metrics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  measured_at  timestamptz not null default now(),
  weight_kg    numeric(6, 2),   -- canonical kg
  body_fat_pct numeric(5, 2),
  muscle_pct   numeric(5, 2),
  water_pct    numeric(5, 2),
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists body_metrics_user_measured_idx on public.body_metrics (user_id, measured_at desc);

-- ============================================================================
-- coach_messages — AI briefings / recaps / per-set reactions (history + context)
-- ============================================================================
create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete cascade,
  role       text not null check (role in ('briefing', 'recap', 'reaction')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user_idx on public.coach_messages (user_id, created_at desc);
create index if not exists coach_messages_workout_idx on public.coach_messages (workout_id);
