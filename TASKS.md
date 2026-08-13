# TASKS.md — Phase 1 (MVP) Build Checklist

Ordered so the app is **runnable early** and each step builds on a working base. Check items off as they land. See [`PRD.md`](./PRD.md) for requirements and [`CLAUDE.md`](./CLAUDE.md) for setup and conventions.

> Legend: `[ ]` todo · `[~]` in progress · `[x]` done. **(you)** = a step where the owner clicks/creates an account or pastes a key; Claude guides it.

---

## Milestone 0 — Foundations (get a blank app running & deployed)
- [x] Scaffold **React + Vite + TypeScript** project; add **Tailwind** (v4).
- [x] Add **PWA** support (`vite-plugin-pwa`): manifest, generated icons (192/512/maskable + apple-touch), installable on iPhone.
- [x] Set up base layout (bottom tab nav, safe areas), routing, and a **playful theme** (brand gradient, macro-ring colors, cards) with light/dark toggle.
- [x] **(you)** Create **Supabase** project; enable **Google auth**; grab URL + anon key. *(Project live; keys in `.env.local`; Google provider enabled + verified.)*
- [x] Wire the **Supabase client**; implement **Google sign-in / sign-out** and a protected app shell. *(Live Google OAuth handshake verified to reach accounts.google.com.)*
- [x] **(you)** Create **Vercel** project; connect repo; add env vars; first **deploy**. *(Live at https://fitnessapp-mauve-nine.vercel.app; repo https://github.com/TuniGenAI/fitnessapp auto-deploys on push. iPhone install: Safari → Share → Add to Home Screen.)*

**Exit check:** ✅ MET — live at a URL, Google sign-in reaches Google on the deployed site, dashboard renders. *(Real per-user data flows once the Milestone 1 SQL is applied — see Milestone 1.)*

---

## Milestone 1 — Data foundation
- [x] Write **database schema + migrations**: profiles, goals, programs/program_days/program_exercises, exercises, workouts/workout_sets, personal_records, foods, meals/meal_items, food_logs, supplement_templates/supplements, supplement_logs, body_metrics, coach_messages. *(`supabase/migrations/…_init_schema.sql`)*
- [x] Add **row-level security** on every table (each user sees only their own rows; seeded exercises + supplement templates are shared read-only reference data). *(`…_rls_policies.sql`, incl. a new-user trigger that seeds profile + goals + default supplement stack)*
- [x] Seed a starter **exercise library** (~44 free-weight/machine/cable/bodyweight moves) and **default supplements** (whey, creatine, multivitamin, fish oil, pre-workout). *(`…_seed_exercises.sql`, `…_seed_supplement_templates.sql`)*
- [x] Generate shared **TypeScript types** from the schema. *(`src/types/database.ts` + convenience aliases in `src/types/index.ts`; Supabase client is now typed with `<Database>`.)*
- [ ] **(you)** Apply the migrations to Supabase — paste the 4 SQL files into the SQL Editor (see [`supabase/README.md`](./supabase/README.md)). Gated on the Supabase URL + anon key being in `.env.local`.

**Exit check:** tables exist, security verified (a user can't read another's rows), types available in code.
*Progress: schema, RLS, seeds, and types are written and the build is green with the typed client. Applying to the live DB is the one remaining **(you)** step.*

---

## Milestone 2 — Workouts + progressive overload (Goal #1 core)
- [ ] **Program builder:** create days (e.g. Push/Pull/Legs), add exercises with target sets/reps. Offer **templates** (PPL, Upper/Lower, Full Body) + full customization.
- [ ] **Workout logger:** start today's workout, log **weight × reps** per set, one-handed friendly.
- [ ] Show **"last time" numbers** for each exercise inline.
- [ ] **Rule-based next-target suggester** (fallback that works with no AI).
- [ ] **Workout history** + per-exercise view.
- [ ] **PR detection** (weight / volume / reps) writing to personal_records.

**Exit check:** you can run a full session end-to-end with last-time context and get a target; PRs are detected.

---

## Milestone 3 — AI coach (Gemini)
- [ ] **(you)** Get a free **Gemini API key**; add a **Settings** screen to store it (per-user, server-side).
- [ ] **Edge function** that builds a token-frugal prompt (today's plan + recent relevant sets + goals) and calls Gemini.
- [ ] **Pre-workout:** pre-fill targets in the logger **and** show a **conversational briefing**.
- [ ] **In-workout mode toggle** (per session): **live per-set reactions** *or* **end-of-workout recap**.
- [ ] Persist coach messages; confirm **graceful fallback** to the rule-based suggester when no key/quota.

**Exit check:** starting a workout produces AI targets + a briefing; recap works; removing the key still lets you train.

---

## Milestone 4 — Nutrition (Goal #2 core)
- [ ] **Goals:** TDEE **calculator** (body stats + cut/bulk/maintain) **and** manual override → daily calorie/macro targets.
- [ ] **Food search** via **Open Food Facts**; add with serving size → macros.
- [ ] **Barcode scan** (iPhone camera) → look up in Open Food Facts.
- [ ] **Photo → AI scan** (Gemini vision edge function) → estimated macros to confirm.
- [ ] **Custom foods & saved meals** for one-tap logging.
- [ ] **Water** quick-add.
- [ ] Daily **macro rings** roll-up.

**Exit check:** you can log food all four ways + water, and rings update against your goals.

---

## Milestone 5 — Supplements
- [ ] **Supplement stack** management (from seeded defaults + custom), **simple once-a-day**.
- [ ] **Daily checklist** on the dashboard; tick off per day.
- [ ] **Macro contribution:** protein/calorie-bearing supps feed daily totals when checked.
- [ ] **Adherence streak** view.

**Exit check:** ticking protein powder increases your protein total; adherence streak shows.

---

## Milestone 6 — Body metrics
- [ ] **Manual weigh-in entry:** weight, body-fat %, muscle, water; log **whenever**.
- [ ] **Smoothed trend line** chart.
- [ ] Feed **bodyweight** into the TDEE calculator.
- [ ] In-app note explaining the **manual-now / future-sync** reality (per PRD §9).

**Exit check:** you can log a full weigh-in and see the trend; calculator uses latest weight.

---

## Milestone 7 — Dashboard, motivation & polish
- [ ] **Today dashboard:** macro rings, water, today's workout / Start Workout, coach line, supplement checklist.
- [ ] **Weekly strip:** streak, days trained, macro adherence.
- [ ] **PR celebrations** (confetti).
- [ ] **Progress charts:** per-exercise, muscle group, bodyweight, macro adherence over time.
- [ ] **Streaks & beat-last-time prompts** surfaced in the flow.
- [ ] Mobile polish: big tap targets, one-handed logging, PWA install prompt, offline-friendly shell (nice-to-have).

**Exit check:** opening the app tells you exactly what to do today and celebrates progress; charts reflect real data.

---

## Milestone 8 — Ship & verify
- [ ] End-to-end pass on **iPhone (installed PWA)** and **web**: sign in, run a workout with coach, log food 4 ways, supplements, weigh-in — all syncing.
- [ ] Confirm everything is on **free tiers ($0/month)**.
- [ ] Confirm all **PRD §6 success criteria** met and **§9 constraints** honestly represented in-app.
- [ ] Update `PRD.md` / `CLAUDE.md` / this file to reflect anything that changed during the build.

---

## Later (not Phase 1) — parked
- Apple **Shortcuts → backend bridge** for weight/body-fat auto-forward.
- Live per-set coaching polish + coach persona/tone.
- **Offline** logging with sync.
- Train-day vs rest-day macro periodization (UI).
- Rest timers, supersets, RPE, richer analytics.
- **Multi-user** opening + **native iOS app** (HealthKit scale sync).
