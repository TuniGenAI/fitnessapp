-- ============================================================================
-- Migration 0003 — Seed the GLOBAL exercise library (user_id IS NULL)
-- ----------------------------------------------------------------------------
-- A starter set of common free-weight, machine, cable, and bodyweight moves,
-- grouped by primary muscle. Users can add their own custom exercises on top.
-- Idempotent: re-running won't duplicate rows (matched on lower(name) for globals).
-- ============================================================================

insert into public.exercises (user_id, name, type, muscle_group, secondary_muscles)
values
  -- ---- Chest -------------------------------------------------------------
  (null, 'Barbell Bench Press',        'free_weight', 'chest',      array['triceps','shoulders']),
  (null, 'Incline Barbell Bench Press','free_weight', 'chest',      array['shoulders','triceps']),
  (null, 'Dumbbell Bench Press',       'free_weight', 'chest',      array['triceps','shoulders']),
  (null, 'Incline Dumbbell Press',     'free_weight', 'chest',      array['shoulders','triceps']),
  (null, 'Machine Chest Press',        'machine',     'chest',      array['triceps','shoulders']),
  (null, 'Pec Deck Fly',               'machine',     'chest',      array[]::text[]),
  (null, 'Cable Fly',                  'cable',       'chest',      array['shoulders']),
  (null, 'Push-Up',                    'bodyweight',  'chest',      array['triceps','shoulders']),
  (null, 'Dip',                        'bodyweight',  'chest',      array['triceps','shoulders']),

  -- ---- Back --------------------------------------------------------------
  (null, 'Deadlift',                   'free_weight', 'back',       array['glutes','hamstrings','forearms']),
  (null, 'Barbell Row',                'free_weight', 'back',       array['biceps','rear_delts']),
  (null, 'Dumbbell Row',               'free_weight', 'back',       array['biceps','rear_delts']),
  (null, 'Lat Pulldown',               'cable',       'back',       array['biceps']),
  (null, 'Seated Cable Row',           'cable',       'back',       array['biceps','rear_delts']),
  (null, 'Machine Row',                'machine',     'back',       array['biceps']),
  (null, 'Pull-Up',                    'bodyweight',  'back',       array['biceps']),
  (null, 'Chin-Up',                    'bodyweight',  'back',       array['biceps']),
  (null, 'Face Pull',                  'cable',       'back',       array['rear_delts']),

  -- ---- Shoulders ---------------------------------------------------------
  (null, 'Overhead Press',             'free_weight', 'shoulders',  array['triceps']),
  (null, 'Dumbbell Shoulder Press',    'free_weight', 'shoulders',  array['triceps']),
  (null, 'Lateral Raise',              'free_weight', 'shoulders',  array[]::text[]),
  (null, 'Cable Lateral Raise',        'cable',       'shoulders',  array[]::text[]),
  (null, 'Rear Delt Fly',              'machine',     'shoulders',  array['back']),

  -- ---- Legs --------------------------------------------------------------
  (null, 'Barbell Back Squat',         'free_weight', 'legs',       array['glutes','hamstrings']),
  (null, 'Front Squat',                'free_weight', 'legs',       array['glutes']),
  (null, 'Romanian Deadlift',          'free_weight', 'legs',       array['hamstrings','glutes']),
  (null, 'Leg Press',                  'machine',     'legs',       array['glutes']),
  (null, 'Leg Extension',              'machine',     'legs',       array[]::text[]),
  (null, 'Leg Curl',                   'machine',     'legs',       array['hamstrings']),
  (null, 'Bulgarian Split Squat',      'free_weight', 'legs',       array['glutes']),
  (null, 'Walking Lunge',              'free_weight', 'legs',       array['glutes']),
  (null, 'Standing Calf Raise',        'machine',     'legs',       array['calves']),
  (null, 'Hip Thrust',                 'free_weight', 'glutes',     array['hamstrings']),

  -- ---- Arms --------------------------------------------------------------
  (null, 'Barbell Curl',               'free_weight', 'biceps',     array['forearms']),
  (null, 'Dumbbell Curl',              'free_weight', 'biceps',     array['forearms']),
  (null, 'Hammer Curl',                'free_weight', 'biceps',     array['forearms']),
  (null, 'Cable Curl',                 'cable',       'biceps',     array['forearms']),
  (null, 'Triceps Pushdown',           'cable',       'triceps',    array[]::text[]),
  (null, 'Overhead Triceps Extension', 'cable',       'triceps',    array[]::text[]),
  (null, 'Skullcrusher',               'free_weight', 'triceps',    array[]::text[]),
  (null, 'Close-Grip Bench Press',     'free_weight', 'triceps',    array['chest','shoulders']),

  -- ---- Core --------------------------------------------------------------
  (null, 'Plank',                      'bodyweight',  'core',       array[]::text[]),
  (null, 'Hanging Leg Raise',          'bodyweight',  'core',       array[]::text[]),
  (null, 'Cable Crunch',               'cable',       'core',       array[]::text[]),
  (null, 'Ab Wheel Rollout',           'bodyweight',  'core',       array[]::text[])
on conflict do nothing;
