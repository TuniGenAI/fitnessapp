# Supabase — database setup

This folder holds the **database schema** for the Fitness App. The `migrations/`
files build every table, lock them down with security rules, and fill in the
starter exercise library and default supplements.

You run these **once**, against your Supabase project. Two ways — pick one.

---

## Option A — Paste into the SQL Editor (easiest, no tools to install)

1. Open your project on **supabase.com** → left sidebar → **SQL Editor** → **New query**.
2. Open each file below **in order**, copy its whole contents, paste, and click **Run**.
   Run them one at a time, top to bottom:
   1. `migrations/20260813120000_init_schema.sql` — creates the tables
   2. `migrations/20260813120100_rls_policies.sql` — turns on per-user security + new-user setup
   3. `migrations/20260813120200_seed_exercises.sql` — fills the exercise library
   4. `migrations/20260813120300_seed_supplement_templates.sql` — default supplement stack
   5. `migrations/20260813120400_add_water_logs.sql` — **water tracking (added for Milestone 4)**
3. Each should finish with **Success. No rows returned** (that's expected).

> **Already applied files 1–4 earlier?** Just run **file 5** (`…_add_water_logs.sql`) —
> it's the only new one. Water quick-add on the live signed-in site needs it (demo
> mode works without it). Safe/idempotent to re-run.

That's it — the backend is ready. The files are safe to re-run if you're unsure;
they won't create duplicates.

---

## Option B — Supabase CLI (automatic, optional)

If you'd rather push automatically (and later regenerate types), install the CLI,
then from the project root:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## After it's applied

- **Check it worked:** Supabase → **Table Editor**. You should see all the tables
  (`profiles`, `workouts`, `exercises`, …). Open `exercises` — it should list ~44
  seeded moves. Open `supplement_templates` — 5 default supplements.
- **Security check (the exit criteria):** every table shows a shield / "RLS enabled"
  badge. A signed-in user can only ever read their own rows; the seeded `exercises`
  and `supplement_templates` are the only shared, readable-by-all reference data.
- **New accounts self-setup:** when you sign in with Google for the first time, a
  trigger automatically creates your profile, an empty goals row, and copies the
  default supplements into your personal stack — nothing to do by hand.

## Keeping the TypeScript types in sync

The app's types live in `src/types/database.ts` and are kept in step with these
migrations. If you change the schema and have the CLI linked, regenerate them:

```bash
supabase gen types typescript --linked > src/types/database.ts
```
