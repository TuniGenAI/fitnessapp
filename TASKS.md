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
- [x] **(you)** Apply the migrations to Supabase — 4 SQL files run via the SQL Editor. *(Applied 2026-08-13.)*

**Exit check:** ✅ MET — verified live against project `yotsunlngoudmxowiviq`: all 18 tables exist; exercise library = 45 rows (no dupes); RLS enforced (anon read on owner tables → 0 rows, anon INSERT → 401 "violates row-level security policy", `supplement_templates` hidden from anon while seeded); types available and build green with the typed client.

---

## Milestone 2 — Workouts + progressive overload (Goal #1 core) ✅
- [x] **Program builder:** create days, add exercises with target sets/reps. **Templates** (PPL, Upper/Lower, Full Body) + full customization. *(`ProgramBuilder.tsx`, `templates.ts`)*
- [x] **Workout logger:** start today's workout, log **weight × reps** per set, one-handed friendly (big steppers, warm-up flag, ad-hoc exercises). *(`WorkoutLogger.tsx`)*
- [x] Show **"last time" numbers** for each exercise inline.
- [x] **Rule-based next-target suggester** (works with no AI). *(`logic.ts` `suggestNextTarget`)*
- [x] **Workout history** + per-exercise **progress chart** (est. 1RM, recharts). *(`WorkoutHistory.tsx`, `ExerciseProgress.tsx`)*
- [x] **PR detection** (weight / volume / reps) → personal_records, with **confetti**. *(`logic.ts` `checkPrsForSet`)*

**Exit check:** ✅ MET — verified in browser (demo): built a PPL program from template, ran a Push session, logged sets with last-time context + suggestions, PR detection fired weight+volume (not reps) correctly with confetti, history + progress records reflect the data.

---

## Milestone 3 — AI coach (Gemini) ✅ (rule-based verified; Gemini needs owner deploy)
- [x] **Settings** screen stores the **Gemini key** (per-user; written to `profiles.gemini_api_key`), coach on/off, and in-workout style. *(`SettingsPage.tsx`)*
- [x] **Edge function** `supabase/functions/coach/index.ts` builds a token-frugal prompt and calls Gemini, reading the caller's key server-side (key never touches the browser). **(you)** one-time: `supabase functions deploy coach`.
- [x] **Pre-workout:** logger pre-fills targets (rule-based suggester) **and** a **briefing** shows on the dashboard.
- [x] **In-workout style toggle:** **per-set reactions** *or* **end-of-workout recap** (Settings), both wired into the logger.
- [x] Persist coach messages (`coach_messages`); **graceful fallback** to rule-based text when no key/quota. *(`coach/logic.ts`, `coach/api.ts`)*

**Exit check:** ⚠️ MET for the no-AI path (verified: rule-based briefing on dashboard, recap on finish, works with no key). The Gemini-powered text activates once the owner deploys the `coach` function and pastes a key in Settings — couldn't be verified end-to-end here (no deploy/key).

---

## Milestone 4 — Nutrition (Goal #2 core) ✅ (photo-AI + live camera scan deferred)
- [x] **Goals:** TDEE **calculator** (Mifflin-St Jeor + activity + cut/bulk/maintain) **and** manual override → calorie/macro targets. *(`GoalsEditor.tsx`, `tdee.ts`)*
- [x] **Food search** via **Open Food Facts** (keyless); add with serving size → macros. *(`off.ts`, `AddFoodSheet.tsx`)*
- [x] **Barcode** → Open Food Facts lookup, with **live camera scanning** (`@zxing/browser`, loaded on demand) + manual number-entry fallback.
- [x] **Photo → AI scan** — `food-photo` edge function (Gemini vision) estimates macros to confirm; graceful fallback when no key. **(you)** deploy: `supabase functions deploy food-photo`.
- [x] **Custom foods & saved meals** for one-tap logging.
- [x] **Water** quick-add (new `water_logs` table — **(you)** apply the migration, below).
- [x] Daily **macro rings** roll-up (food **+** checked supplements).

**Exit check:** ✅ MET — all four logging paths built (photo, search, barcode+camera, saved meals) + custom + water; rings update against goals (verified in browser: OFF "banana" search → log → rings updated exactly; TDEE math correct; water quick-add; camera scan + photo tabs render with graceful fallback). Photo-AI + camera scan need the food-photo function deployed + a Gemini key to produce real results.

---

## Milestone 5 — Supplements ✅
- [x] **Supplement stack** management (seeded defaults + custom), simple once-a-day. *(`ManageStackSheet.tsx`)*
- [x] **Daily checklist** on the dashboard; tick off per day. *(`SupplementChecklist.tsx`)*
- [x] **Macro contribution:** protein/calorie-bearing supps feed daily totals when checked.
- [x] **Adherence streak** (consecutive fully-taken days) shown on the checklist.

**Exit check:** ✅ MET — verified in browser: ticking Whey Protein added exactly +120 kcal / +24 g protein to the dashboard rings; streak logic in place.

---

## Milestone 6 — Body metrics ✅
- [x] **Manual weigh-in entry:** weight, body-fat %, muscle, water; log whenever. *(`BodyPage.tsx`, `body/api.ts`)*
- [x] **Smoothed trend line** chart (raw scale + EMA "trend weight", recharts).
- [x] Feed latest **bodyweight** into the TDEE calculator (`getLatestWeightKg`).
- [x] In-app note explaining the **manual-now / future-sync** reality (PRD §9).

**Exit check:** ✅ MET — verified in browser: logged 82.5 kg / 18% bf, snapshot + history render, honest sync note shown. (Trend chart appears at ≥2 weigh-ins.)

---

## Milestone 7 — Dashboard, motivation & polish ✅ (core done; some polish parked)
- [x] **Today dashboard:** live macro rings (food+supps), water, today's session card, coach line, supplement checklist. *(`DashboardPage.tsx`)*
- [x] **Weekly strip:** days trained this week, calories, macro adherence %.
- [x] **PR celebrations** (confetti) in the logger.
- [x] **Progress charts:** per-exercise est. 1RM, **volume-by-muscle (30 d)**, **calorie adherence (7 d)**, bodyweight trend.
- [x] **Streaks & beat-last-time prompts** surfaced (supplement streak, "last time" + suggestions, per-set reactions).
- [x] Mobile polish: **PWA install prompt** (native + iOS instructions), **code-splitting** (main bundle 849 → ~130 kB; charts + scanner lazy-loaded). *(Offline logging still parked.)*

**Exit check:** ✅ MET — verified in browser: dashboard shows today's session + coach line + live rings/water/supplements; confetti fires on PRs; per-exercise/muscle/calorie/bodyweight charts reflect real logged data.

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
