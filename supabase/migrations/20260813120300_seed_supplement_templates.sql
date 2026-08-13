-- ============================================================================
-- Migration 0004 — Seed default supplement templates (global reference data)
-- ----------------------------------------------------------------------------
-- These are the "starter stack" (PRD §4.4). When a new user signs up, the
-- new-user trigger (migration 0002) copies these into their personal
-- `supplements` table so they can start ticking them off immediately.
--
-- Macro-bearing supps (e.g. whey protein) carry per-serving macros that count
-- toward daily totals when checked. Non-macro supps (creatine, vitamins) are
-- pure adherence (all-zero macros). Idempotent on `name`.
-- ============================================================================

insert into public.supplement_templates
  (name, serving_label, category, calories, protein_g, carbs_g, fat_g, sort_order)
values
  ('Whey Protein',      '1 scoop (30 g)', 'protein',   120, 24, 3, 2, 10),
  ('Creatine',          '5 g',            'general',     0,  0, 0, 0, 20),
  ('Multivitamin',      '1 tablet',       'vitamins',    0,  0, 0, 0, 30),
  ('Fish Oil (Omega-3)','1 softgel',      'vitamins',   10,  0, 0, 1, 40),
  ('Pre-Workout',       '1 scoop',        'stimulant',   5,  0, 1, 0, 50)
on conflict (name) do nothing;
