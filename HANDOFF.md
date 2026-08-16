# HANDOFF — build context for the next conversation

> Read this first (after `CLAUDE.md` / `PRD.md` / `TASKS.md`) for full context. Last updated: **2026-08-16**.
>
> **TL;DR:** Phase-1 is **complete and live** — all features (M0–M7) built, deployed to Vercel, backend on Supabase, AI functions deployed, Gemini key set. `npm run build` green. Post-Phase-1 work now follows [`ROADMAP.md`](./ROADMAP.md) (from the competitive audit vs MacroFactor / MFP / Strong). Only Milestone 8 (owner's iPhone-PWA end-to-end pass) and one parked item (offline logging) remain from Phase 1. See the Runbook near the bottom for ops.

---

## Where we are

> **✅ ALL DEPLOYED (2026-08-16).** The full audit roadmap (v0.9.0–v0.12.0) is **live**. Frontend pushed to
> `main` (`6745a4a`) → Vercel; the three migrations (`workout_sets.rpe`, `food_logs.fiber_g`, `body_metrics`
> tape cols, `progress_photos`) are applied and REST-verified (all `200`); `coach` edge fn redeployed to **v4**
> (sends session `history`), `nutrition-coach` already ACTIVE. Nothing pending. The ⚠️ "MIGRATION TO APPLY"
> callouts in the per-version notes below are **historical** — those migrations are now applied.
> *Ops gotcha for next time:* the CLI's remote migration-history table is empty (earlier migrations were pasted
> into the SQL Editor), so `supabase db push` alone re-runs everything and fails on `0002`'s `create policy` —
> `migration repair --status applied <old versions>` first, or keep using the SQL Editor.

> **🏁 Tier 2 + Tier 3 complete (2026-08-16, app v0.12.0).** ROADMAP items #8–#14 — the whole audit backlog
> is now shipped (v0.9.0 → v0.12.0). **⚠️ Includes a DB migration to apply + an edge-function redeploy.**
> - **#8 Stall→deload:** `detectStall` + `deloadTarget` in `workouts/logic.ts`; `getRecentSessionBestE1RMs`
>   (api) feeds the logger, which swaps the suggestion for a ~10% deload after 3 flat sessions. Pure-logic; traced.
> - **#9 Custom-food AI aid:** OFF search empty-state gains an "✨ Estimate with AI" button (reuses `describeMeal`).
>   *(Empty-results branch couldn't be exercised in the sandbox — OFF is CORS-blocked there — but is build-clean.)*
> - **#10 Coach memory:** recap passes `trainedThisWeek` (rule-based continuity line in `buildRecap`) + a recent-recap
>   digest to the **`coach` edge function** (`supabase/functions/coach/index.ts` gained a `history` field) — **redeploy `coach`**.
> - **#11 Progress photos:** Body screen add/view/delete; client-downscaled to ~720px JPEG, stored as a data URL in the
>   new **`progress_photos`** table. Verified: PNG→~1KB JPEG stored + thumbnail rendered. *(Storage bucket = future upgrade.)*
> - **#12 Tape measurements:** optional waist/chest/arms/thighs/hips in the weigh-in sheet → new **`body_metrics`**
>   columns; shown as a "Measurements (cm)" panel. Verified: stored + displayed.
> - **#13 In-app nudges:** one dismissible, data-driven dashboard nudge (`computeNudge` in `DashboardPage`), per-day
>   dismissal in localStorage. Verified: rendered + prioritized the in-progress workout.
> - **#14 Data export:** Settings → "Export my data (JSON)" (`src/lib/exportData.ts`) — every user-owned table
>   (Gemini key stripped), demo + backend. Verified: produced a 7.4 KB JSON blob.
> - **⚠️ MIGRATION TO APPLY:** `supabase/migrations/20260813120800_body_extras.sql` (body_metrics tape columns +
>   `progress_photos` table + RLS + `notify pgrst`). **Also redeploy the `coach` edge function** (now sends `history`).
> - `npm run build` green; demo-mode browser pass for the observable features, zero app-side console errors.

> **🥗 Recents quick-add + fiber (2026-08-16, app v0.11.0).** ROADMAP items #5 + #7 (and #6 was found
> **already done**). **⚠️ Includes a DB migration to apply on deploy.**
> - **Recents (#5):** new **"Recent"** tab (now the default) in `AddFoodSheet` — `listRecentFoods()`
>   (`nutrition/api.ts`) returns distinct recently-logged foods newest-first with per-serving macros
>   reconstructed from the denormalized log. Row tap → confirm step prefilled with last servings/meal; the
>   green **＋** re-logs instantly. Verified: quick-log created a 2nd identical entry (meal + fiber preserved).
> - **Fiber (#7):** captured from Open Food Facts (`off.ts`, null when absent), stored on new
>   **`foods.fiber_g` + `food_logs.fiber_g`**, enterable in the Custom-food form, shown as a daily total
>   under the rings + `· Fib N` per row. `Macros.fiber_g` is **optional** (kept the 4 rings untouched;
>   photo/text AI paths simply omit it). Verified: custom food stored `fiber:12`, log `fiber_g:12`, row shows "· Fib 12".
> - **#6 meal buckets — no work needed:** the audit claim was wrong. `guessMeal()` + `ServingStep`'s meal
>   picker + `FoodLogList` grouping (Breakfast/Lunch/Dinner/Snack) were already shipped. Confirmed live.
> - **⚠️ MIGRATION TO APPLY:** `supabase/migrations/20260813120700_food_fiber.sql` (adds both `fiber_g`
>   columns, ends with `notify pgrst`). Apply alongside the RPE migration below. Types already updated.
> - `npm run build` green; demo-mode browser pass, zero console errors.

> **⏱️ Rest timer + optional RPE (2026-08-16, app v0.10.0).** ROADMAP items #3 + #4 — workout-side table
> stakes. **⚠️ This batch includes a DB migration that must be applied on deploy** (see below).
> - **Rest timer (#3):** auto-starts a countdown after each *working* set (skips warm-ups). Floating bar
>   above the nav with −15/+15/Skip and a haptic+beep cue at zero (`restDoneCue`, best-effort — iOS Safari
>   ignores vibrate harmlessly). Prefs (on/off + default duration) live in **localStorage**, not the DB —
>   `src/features/workouts/restTimer.ts`, surfaced in Settings → "Rest timer". No schema change for this part.
> - **RPE (#4):** optional 6–10 chip row in `WorkoutLogger`'s `ExerciseLogCard` (tap to set/clear; hidden on
>   warm-ups; resets after each log so it never slows the core loop). Stored on a new **`workout_sets.rpe`**
>   column (`numeric(3,1)`, nullable). Shows as `@8` on logged rows. `suggestNextTarget` (`logic.ts`) now reads
>   it: RPE ≤ 6 at the top of the range → **double** load jump; last set ≥ 9.5 → **hold and consolidate**;
>   absent → unchanged double-progression. Feeding RPE into the Gemini `coach` edge-function prompt is a later step.
> - **⚠️ MIGRATION TO APPLY:** `supabase/migrations/20260813120600_workout_set_rpe.sql` (adds `rpe`, ends with
>   `notify pgrst`). Paste into the Supabase SQL Editor before/at deploy, or REST inserts referencing `rpe` will
>   fail with `PGRST205` until the schema cache reloads. Types already updated in `src/types/database.ts`.
> - Verified: `npm run build` green; demo-mode browser pass — RPE chip stores `rpe:8` + renders `@8`, rest timer
>   counts down 2:00 with working −15/Skip, Settings section toggles, zero console errors.

> **📈 Adaptive TDEE engine (2026-08-16, app v0.9.0).** ROADMAP item #1 (+#2) — the MacroFactor-style
> differentiator. The app no longer relies only on the one-time Mifflin formula: it **back-calculates
> real maintenance calories** from logged intake + smoothed weight trend, then sets targets from a
> **weekly rate-of-change** slider. Frontend-only (no schema/edge-function change) — push to `main` deploys.
> - **Pure engine** `src/features/nutrition/adaptiveTdee.ts`: `estimateExpenditure(intake, weights)` uses
>   `expenditure ≈ avgIntake − (Δtrend-weight × 7700)/days` over a rolling ~21-day window, with
>   confidence gating (needs ≥10 logged days + ≥10-day weigh-in span, else returns null); `targetsFromRate`
>   derives calories/macros from a kg/week rate (protein 2 g/kg, fat 25%, carbs remainder — same split as `tdee.ts`).
> - **Data wrapper** `getExpenditureEstimate()` in `nutrition/api.ts` gathers per-day calories from
>   `food_logs` + one weigh-in/day from `body_metrics`; no raw logs leave the function.
> - **UI:** third **"Adaptive"** tab in `GoalsEditor` (now default; old calculator renamed **"Formula"**,
>   Manual unchanged). Shows estimated maintenance + a rate slider (−1.0…+0.5 kg/week) with a live
>   calorie/macro preview. Saves with `source: "calculated"`; the chosen rate persists in `localStorage`
>   (`fitnessapp.goalRate`) — **no DB migration needed** for this slice.
> - **Graceful degradation:** with <2 weeks of data the Adaptive tab shows an honest "Not enough data yet"
>   state and a "Use the formula instead" button that switches to the Formula tab. Never dead-ends.
> - Verified: `npm run build` green; math sanity-checked against a cutting scenario (ate 2410, trend −0.95 kg/20 d
>   → expenditure 2775, −0.5 kg/wk target 2225); demo-mode browser pass — Adaptive tab renders, empty-state +
>   fallback work, zero console errors. The real-estimate path needs ~2 weeks of live logs to light up.
> - **Next on the roadmap:** #3 rest timer, #4 optional RPE/RIR (both workout-side). See [`ROADMAP.md`](./ROADMAP.md).

**Milestones 0–7 are code-complete.** M0 (foundations) + M1 (schema, applied live) were done earlier; **M2–M7 (workouts, AI coach, nutrition, supplements, body, dashboard) were built and verified in demo mode on 2026-08-13.** `npm run build` is green (TS + PWA). The app is fully usable end-to-end in **demo mode** (local-first store, no backend needed) and against the live Supabase backend once signed in.

> **✅ FULLY LIVE & VERIFIED (2026-08-13). Nothing is pending on the backend.**
> - **`water_logs` migration applied** and PostgREST schema cache reloaded → water persists live (REST `GET /water_logs` → `200`). *(Gotcha: a freshly created table 404s with `PGRST205 "not found in the schema cache"` until the cache reloads — the symptom here was Fuel/Dashboard hanging. Fix: run `NOTIFY pgrst, 'reload schema';` in the SQL Editor, or restart the project. The app is now also resilient to this — see Runbook.)*
> - **Edge functions `coach` + `food-photo` deployed & verified** (both answer `401` to an anonymous probe = deployed and correctly auth-gated).
> - **Gemini key set** in the app's Settings (per-user, server-side). AI briefings/recaps + photo macro-scan are active; rule-based / manual fallbacks remain if the key is missing or quota runs out.
>
> The only work left is **Milestone 8** — an owner end-to-end pass on the *installed iPhone PWA* — plus the single parked nice-to-have (offline logging).

> **🔧 Gemini AI fully fixed (2026-08-13, app v0.5.1).** All Gemini features (coach, photo scan, Describe) had broken at once. Two stacked causes, both now resolved and redeployed:
> 1. **Retired model.** The three edge functions (`coach`, `food-photo`, `food-text`) were pinned to `gemini-1.5-flash-latest`, which Google **retired** → every call HTTP 404'd. Fixed by switching `GEMINI_MODEL` in all three to the **moving alias `gemini-flash-latest`** (tracks Google's current flash model, so a future retirement won't 404 us again).
> 2. **Thinking-model token starvation.** `gemini-flash-latest` now resolves to a **"thinking" model**, whose internal reasoning is drawn from `maxOutputTokens`. The old 160–200 caps were entirely consumed by reasoning, so Gemini returned **empty text** — surfaced as `error:"no json"`. Fixed by raising `maxOutputTokens` to **2048** on all three, and adding `responseMimeType:"application/json"` to the two that parse JSON (`food-text`, `food-photo`; `coach` returns prose so it has no mime type).
>
> Also fixed the **misleading error UX** that hid all this: `describeMeal`/`scanFoodPhoto` in `src/features/nutrition/api.ts` used to swallow every failure into the generic "needs the function deployed + a key" message. They now throw a specific hint (`aiErrorHint()` maps `gemini 400/403`→bad key, `429`→quota, `404`→stale model). If AI breaks again, the app will name the real cause — check the model alias / key / quota accordingly.
>
> **Decision — thinking stays ON for all three** (owner call, 2026-08-13). Rationale: at single-user scale the binding free-tier limit is **requests/day (~250 flash)**, not tokens, and thinking doesn't change request count — so thinking-on costs nothing on quota, only a few seconds of latency per call. To make Describe/Photo snappier later, add `thinkingConfig:{ thinkingBudget: 0 }` to their `generationConfig` (and you can then drop `maxOutputTokens` back down, since the reasoning headroom is no longer needed). Revisit token cost only if the app opens to multiple users on the paid tier.

> **🩹 First real-workout fixes (2026-08-14, app v0.6.0).** After the owner's first on-device session, four issues surfaced (three fixed here, one is the root cause of the others):
> 1. **Quota drain — the big one.** The **dashboard called the Gemini `coach` briefing on *every* load** (`getBriefing` in `DashboardPage`, `coach_enabled ?? true`), uncached — every app open / tab-back-to-Today / refresh burned one request. On the ~250/day flash free tier this exhausted quota before deliberate use, which is why the **food photo 429'd** and the **coach fell back to generic rule-based text**. **Fix (owner call): the coach is removed from the dashboard entirely** — no AI call and no "Coach:" line on load. AI now fires **only on deliberate triggers**: the post-workout **recap** (on Finish) and per-set reactions. This is the fix for the "AI didn't work / coach was generic" report.
> 2. **Coach congratulated an empty session.** The rule-based recap said *"That's how it's done: 0 working sets, 0 kg moved"* when nothing was logged. `buildRecap` (`src/features/coach/logic.ts`) now early-returns an honest line when `workingSets === 0 || totalVolumeKg === 0`, and `getRecap` (`src/features/coach/api.ts`) **skips the AI call** for empty sessions so Gemini can't celebrate zero either.
> 3. **Bottom nav bar detached mid-scroll on iOS** (overlapped content). Root cause: `position: fixed` + `backdrop-filter` on the `<nav>` — a known iOS Safari/PWA bug. `AppShell` is now a **full-height flex column** where only `<main>` scrolls (`flex-1 overflow-y-auto`) and the bar is an **in-flow `shrink-0` child** (no `fixed`). Verified: stays pinned to the true bottom while content scrolls.
> 4. **Couldn't type fine decimals** (e.g. `0.6 kg`). The `Stepper` was a *controlled numeric* input, so typing `0.` coerced back to `0` and ate the point. It now keeps a **draft string** while focused (partial entries like `0.` / `0.6` survive) and commits/normalizes on blur; the weight field allows **2 decimals** (`decimals={2}`). Verified live by typing `0.6`.
>
> All frontend-only — a push to `main` deploys via Vercel; the edge functions were **not** changed. Version marker bumped to **v0.6.0** (`SettingsPage`). Still parked: offline logging.

> **🥗 Nutrition Coach — "Plan the rest of my day" (2026-08-15, app v0.8.0).** New on-tap AI coach on the **Fuel** screen: given the day's **remaining macros**, what's already been logged, a **habit digest**, and the time of day, it plans the **meals still ahead** with budget-friendly **Tunisian** staples (halal), and you can **keep chatting** ("no chicken today"). Spec + all owner decisions: [`NUTRITION-COACH-SPEC.md`](./NUTRITION-COACH-SPEC.md).
> - **New edge function `nutrition-coach`** (`supabase/functions/nutrition-coach/`) — cloned from `coach`: reads the per-user Gemini key server-side, prose out, multi-turn via Gemini `contents` + a `systemInstruction` carrying the context. **⚠️ OWNER: deploy it** — `supabase functions deploy nutrition-coach` — or the live app shows the rule-based fallback + an error note on every tap. (Anon probe should then answer `401`.)
> - **On-tap only**, never on passive load — respects the v0.6.0 quota rule. Owner accepted **no conversation cap**, so cost is kept low per call instead: compact pre-aggregated context (no raw logs), prose model, `maxOutputTokens 2048`.
> - **Graceful fallback everywhere** (`src/features/nutrition/coachLogic.ts`, pure/testable): demo mode, no key, or a quota/AI error → a rule-based split of remaining macros across the meals still ahead, each with a cheap Tunisian staple. The AI error hint (bad key / 429) is surfaced under the transcript. Feature never dead-ends.
> - **Files:** `coachLogic.ts` (meal-by-time pattern `MEAL_PATTERN` + `fallbackPlan` + `goalLabel`), `PlanDaySheet.tsx` (transcript UI), and `api.ts` additions (`getHabitDigest`, `planRestOfDay`, `PlanContext`/`ChatTurn`/`HabitDigest`). Button gated on `hasGoals && isToday` in `NutritionPage`.
> - **Meal pattern is goal-dependent** (currently the owner's **bulk** pattern: breakfast <10, lunch 12–14, snack 16–17, dinner 19–21) and kept as ONE constant so it's a trivial change when the goal shifts (spec §11.2). The AI also cross-checks what's actually logged rather than assuming a meal happened.
> - **Supplements are NOT subtracted** from remaining (owner: their stack has no protein/calories — spec §5). Revisit if whey ever gets logged.
> - Verified in demo mode (rule-based path), zero console errors: set bulk goals → tapped **Plan the rest of my day** → got a 4-meal split (760 kcal / 40 g protein each) → sent a follow-up → transcript grew correctly. `npm run build` green.
>
> **📅 Backdated logging — "log the day after" (2026-08-15, app v0.7.0).** You can now log **food, water, and workouts for a past day** (e.g. entering yesterday's meals/session today). A shared **`DateNav`** control (‹ / › with a "Today / Yesterday / Wed, Aug 13" label, capped forward at today) sits at the top of the **Fuel** screen and the **Train → Plan** tab.
> - **Fuel** (`NutritionPage`): a `date` state drives every read (`listFoodLogs`, `getWaterMl`) and write (`logFood` via `AddFoodSheet`'s new `logDate` prop, `addWater`, `logMeal`) — so the whole screen reflects and edits the selected day. The 7-day trend chart stays anchored to today by design. Empty-state copy adapts ("Nothing logged **this day**…").
> - **Train** (`WorkoutsPage` Plan tab): the selected `date` flows into `startWorkout({ date })`. `startWorkout` (`workouts/api.ts`) now backdates `started_at` to that day **only when it isn't today**, keeping the current wall-clock time via the new `isoAtLocalDate` helper so intra-day ordering stays realistic; today's sessions keep exact `new Date()`. History groups by `started_at`, so a backdated session shows under the right day (verified: "Yesterday · 7:15 PM"). A hint ("Logging this session for Yesterday") shows whenever a past day is selected.
> - **Helpers added** to `src/lib/format.ts`: `shiftISODate`, `isoAtLocalDate`, `friendlyDate` (all local-time-safe, no UTC day-shift). `DateNav` lives in `src/components/ui.tsx`.
> - Verified in demo mode, zero console errors: logged a custom food on Yesterday → it appears only on Yesterday and is absent on Today; started a backdated empty workout with a set → History dates it to Yesterday. `npm run build` green.
>
> **➕ Empty-workout warning (2026-08-14, app v0.6.1).** Tapping **Finish workout** with **zero working sets** now shows a confirmation sheet ("No sets logged yet" → *Keep training* / *Finish anyway*) instead of silently finishing. `finishWorkout` in `WorkoutLogger` is now a lightweight guard (counts non-warmup sets; if 0, opens the `confirmEmpty` sheet); the real work moved to `runFinish`, which both the guard's happy path and "Finish anyway" call. Verified in demo mode: empty finish → warning (no false celebration) → "Finish anyway" → the honest zero-session recap. This clears the last open item from the v0.6.0 note.

### What M2–M7 added (all local-first: Supabase when signed in, localStorage in demo)
- **Data layer:** `src/lib/session.ts` (auth→data bridge), `src/lib/localDb.ts` (demo store, seeds exercises + default supplements + goals/profile), `src/lib/repo.ts` (generic backend↔demo CRUD), `src/lib/format.ts` (units/dates/uuid), `src/lib/useAsync.ts`, `src/lib/celebrate.ts` (confetti). Client seeds in `src/data/`.
- **Profile context:** `src/features/profile/` — loads profile + goals app-wide (units, coach settings, nutrition targets).
- **UI kit:** `src/components/ui.tsx` (Button, Sheet, Segmented, Stepper, EmptyState, Spinner…) + new icons.
- **M2 Workouts** (`src/features/workouts/`): program builder + templates, live logger with last-time + rule-based suggestions, PR detection (+confetti), history, per-exercise 1RM chart.
- **M3 Coach** (`src/features/coach/` + `supabase/functions/coach/`): rule-based briefing/recap/reactions + Gemini edge function (key stays server-side) + graceful fallback.
- **M4 Nutrition** (`src/features/nutrition/`): TDEE calculator + manual goals, Open Food Facts search + barcode-number lookup, custom foods, saved meals, water, macro rings.
- **M5 Supplements** (`src/features/supplements/`): stack management, daily checklist, macro contribution, adherence streak.
- **M6 Body** (`src/features/body/`): weigh-ins, smoothed trend chart, feeds TDEE, honest sync note.
- **M7 Dashboard** (`src/features/dashboard/`): live rings (food+supps), water, today's session, weekly strip, supplement checklist. *(The AI coach line was removed from the dashboard in v0.6.0 — see the 2026-08-14 note above.)*

**Verification (in-browser, demo mode, zero console errors):** built PPL from template → ran a Push session → PR detection fired weight+volume (not reps) with confetti → history/progress correct; TDEE math correct; OFF "banana" search→log updated rings exactly; ticking Whey added +120 kcal/+24 g protein; body weigh-in saved with snapshot; Settings units/coach/key render.

### Nice-to-haves — now built (2026-08-13)
- **Code-splitting**: main bundle 849 → ~130 kB; `recharts` (charts) and `@zxing/browser` (scanner) are separate chunks, loaded on demand (charts via `React.lazy`, scanner via dynamic `import()` on first camera use).
- **PWA install prompt** (`src/components/InstallPrompt.tsx`): native `beforeinstallprompt` where available + iOS "Add to Home Screen" steps; dismissible/remembered.
- **Charts**: volume-by-muscle (30 d) + calorie adherence (7 d), alongside the existing 1RM and bodyweight-trend charts.
- **Photo → AI macro scan**: `supabase/functions/food-photo/` (Gemini vision) + a Photo tab. **Deployed & live.**
- **Live camera barcode scanning**: `@zxing/browser` in the Barcode tab, with graceful fallback to manual entry when no camera/permission.

> **Still parked:** offline logging with background sync.

### Milestone 1 built (2026-08-13)
- **Full schema** in `supabase/migrations/` — 4 ordered SQL files covering all 18 tables (profiles, goals, programs/program_days/program_exercises, exercises, workouts/workout_sets, personal_records, foods, meals/meal_items, food_logs, supplement_templates/supplements, supplement_logs, body_metrics, coach_messages).
- **RLS on every table** — owner-only policies (generated in a DO-block loop); seeded `exercises` (user_id NULL) and `supplement_templates` are shared read-only reference data. A **new-user trigger** (`handle_new_user`) auto-creates the profile, an empty goals row, and copies the default supplement stack on first sign-in.
- **Seeds** — 45-move exercise library + 5 default supplements (whey/creatine/multivitamin/fish oil/pre-workout).
- **TypeScript types** — `src/types/database.ts` (Supabase-generated style: Row/Insert/Update per table) + convenience aliases in `src/types/index.ts`. The Supabase client is now typed with `<Database>`. `npm run build` stays green.
- **Apply guide** for the non-coder owner: `supabase/README.md` (SQL-Editor paste path + CLI path + verification steps).

**Applied & verified live (2026-08-13)** against project `yotsunlngoudmxowiviq` via the REST API with the anon key: all 18 tables present; `exercises` = 45 global rows (matches seed, no dupes); RLS enforced — anon reads on owner tables return 0 rows, anon INSERT is rejected `401 / 42501 "violates row-level security policy"`, and `supplement_templates` is hidden from anon (authenticated-only policy) despite being seeded.
- **Not yet exercised (fires on real use, verify then):** the `handle_new_user` trigger runs on the **first Google sign-in** — after signing in on the live site, check Table Editor: your `profiles` + `goals` rows exist and `supplements` holds the 5 defaults. Cross-user isolation can't be tested until a 2nd account exists, but the policies + the write-block above give high confidence.

### Built & verified
- **React + Vite + TypeScript + Tailwind v4** scaffold. `npm run build` passes clean.
- **Installable PWA** — `vite-plugin-pwa`, web manifest, generated icons (`public/icons/`: 192, 512, 512-maskable) + `public/apple-touch-icon.png` + `public/favicon.svg`. Apple home-screen meta tags in `index.html`.
- **Playful themed shell** — brand violet→indigo gradient, macro-ring colors (protein/carbs/fat/water/calories), cards, a mobile **bottom tab bar** (Today / Train / Fuel / Body / Settings) with iPhone safe-area insets, and a working **light/dark toggle** (Settings).
- **Auth** — `src/features/auth/AuthProvider.tsx`: Supabase Google OAuth flow, sign-out, and **graceful demo mode** when Supabase isn't configured. Protected app shell in `src/App.tsx`.
- **Today dashboard** (`src/features/dashboard/DashboardPage.tsx`) — greeting, weekly strip (streak/trained/macros), 4 macro rings, today's-workout card, water quick-add, supplement checklist, coach line. **Values are placeholders**, each labeled with the milestone that makes it live.
- **Placeholder pages** for Train/Fuel/Body (`ComingSoon` component) listing what each milestone delivers. **Settings** is real (account, theme toggle, live setup-status rows).

### Verification done
Browser check in-session: login → demo → dashboard renders, tab routing works, water/supplement taps respond, **zero console errors**. `npm run build` green (TS + PWA service worker generate).

### Key architecture decisions honored
- App display name lives in ONE place: `src/appConfig.ts` (`APP_NAME`), flowed into the PWA manifest via `vite.config.ts`. Rename = one line.
- Frontend holds **no secrets**. Supabase client reads public URL + anon key from env; missing = demo mode (`src/lib/supabase.ts`).
- `@/*` path alias → `src/` (set in both `vite.config.ts` and `tsconfig.app.json`).

---

## Environment gotcha
- The **`C:` drive was 100% full** (0 bytes), which blocked `npm install` until the owner freed space (~21 GB free now, 91% used). **Watch disk space** before installs/builds. `D:` (~253 GB free) and `E:` (~437 GB free) have room if needed (junction `node_modules`/npm cache there).

---

## Setup the owner is providing (accounts all ready: Supabase, GitHub, Vercel, Gemini)

### 1. Supabase → `.env.local` ✅ DONE & VERIFIED (2026-08-13)
`.env.local` is filled with the project URL (`https://yotsunlngoudmxowiviq.supabase.co`) and anon key.
Verified live: `auth/v1/health` → 200, anon JWT decodes valid (`role: anon`, matching ref, unexpired).
`isSupabaseConfigured` now flips true → real Google sign-in activates (once the Google provider is enabled, below).
> Note: the URL was initially pasted with a trailing `/rest/v1/` — corrected to the bare project origin (supabase-js appends paths itself).

**Google OAuth — ✅ DONE & VERIFIED (2026-08-13).** Google Cloud OAuth client created (client_id `376412115-q79f…apps.googleusercontent.com`), enabled in Supabase, callback `…supabase.co/auth/v1/callback`. Supabase URL Configuration set: Site URL = the Vercel domain; Redirect URLs include `https://fitnessapp-mauve-nine.vercel.app/**` and `http://localhost:5173/**`. Verified: authorize endpoint 302s to `accounts.google.com` with the right client_id/callback, and clicking "Continue with Google" on the live site reaches Google's sign-in screen. Consent screen is in **Testing** mode with the owner's Gmail as a test user (no Google verification needed for personal use). *If the deployed domain ever changes, add the new domain to Supabase Redirect URLs.*

**DB schema — ✅ APPLIED & VERIFIED (2026-08-13).** All **5** SQL files were run in the SQL Editor (the 4 M1 files + `20260813120400_add_water_logs.sql` added for M4 water tracking); live verification passed. Nothing pending here.

### 2. GitHub — ✅ DONE (2026-08-13)
- Repo: **https://github.com/TuniGenAI/fitnessapp** (private). Remote `origin` set; initial commit `1558f2f` pushed to `main`. Git identity: `TuniGenAI <benfrijaomar@gmail.com>`, credential helper = GCM (cached, no prompt on push).
- **Git is driven from the infra/setup conversation** to avoid clobbering the parallel dev conversation's working-tree edits. Subsequent commits/pushes auto-deploy to Vercel.

### 3. Vercel — ✅ DONE (2026-08-13)
- Live at **https://fitnessapp-mauve-nine.vercel.app** (framework preset Vite). Env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set in the project. Auto-deploys on every push to `main`. First deploy verified: renders, no demo button (Supabase detected), Google handshake works.
- iPhone: open the URL in Safari → Share → Add to Home Screen to install the PWA.

### 4. Gemini — ✅ DONE (2026-08-13)
- Key pasted into the app's **Settings** (stored in `profiles.gemini_api_key`, per-user, RLS-protected). The edge functions read it server-side with the caller's JWT — **it never touches the browser**. Do NOT paste it into chat, `.env.local`, or commit it.
- Both AI functions (`coach`, `food-photo`) are deployed and read this key. If quota is hit, the app falls back to rule-based coach text / manual food entry.
- The key that was briefly shared in chat during setup was **rotated** by the owner.

---

## Next up (post-M7) — only Milestone 8 remains
The entire Phase-1 feature set (M0–M7) is built, deployed, and live. What's left:
1. **Milestone 8 — owner ship & verify:** on the *installed iPhone PWA* (Safari → Share → Add to Home Screen) do one real end-to-end pass — sign in, run a workout with the coach, log food all four ways, tick supplements, add a weigh-in — and confirm it all syncs. Confirm everything is still on free tiers. *(A first real Google sign-in fires the `handle_new_user` trigger; glance at Table Editor to confirm your `profiles`/`goals`/5 default `supplements` seeded.)*
2. **Parked (only item left):** offline logging with background sync.

**Planned (agreed, not built) — Nutrition Coach:** an on-tap "Plan the rest of my day" button on the Fuel screen that asks Gemini for a full, budget-friendly Tunisian plan for the remaining meals (split by time of day), learns taste from the food log, and lets the owner keep chatting. Owner-approved decisions + full build plan (new `nutrition-coach` edge function, cloned from `coach`) are in [`NUTRITION-COACH-SPEC.md`](./NUTRITION-COACH-SPEC.md). Respects the v0.6.0 quota rule (fires on tap only, never on load) with a rule-based fallback.

Everything else in TASKS.md is checked off.

**Architecture note for the next builder:** feature code never talks to a backend directly — it calls each feature's `api.ts`, which uses `@/lib/repo` + `@/lib/session` to hit **Supabase when signed in** and the **local demo store** (`@/lib/localDb.ts`) otherwise. Keep new features on that pattern so demo mode keeps working (it's how the app stays verifiable without Google OAuth).

---

## Runbook (operations)

**Run / build**
```
npm install        # re-run if node_modules missing
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build + PWA — must stay green before committing
```

**Deploy** — push to `main`; Vercel auto-deploys the frontend. Git identity `TuniGenAI`, GCM cached (no prompt).

**Database migrations** (`supabase/migrations/`, 5 files) — apply new ones by pasting into the Supabase **SQL Editor** (see `supabase/README.md`). They're idempotent/safe to re-run.
> **Schema-cache gotcha (important):** after creating a table, PostgREST's REST API 404s it (`PGRST205`) until its cache reloads — which *looks* like an app bug (screens that query the new table hang/blank). Fix: run `NOTIFY pgrst, 'reload schema';` in the SQL Editor, or **Settings → General → Restart project**. Our migrations now end with that `NOTIFY`. The app is also defensive now (page loads use `Promise.allSettled` + a `finally`, and `getWaterMl` degrades to 0), so a single failing query can't blank a screen again.

**Edge functions** (`supabase/functions/{coach,food-photo,food-text,nutrition-coach}`) — deploy via the **Supabase Dashboard → Edge Functions → Deploy a new function → Via editor** (paste the file contents, name must match exactly), or CLI: `supabase functions deploy <name>`. Function names are called by the client verbatim (`coach`, `food-photo`, `food-text`, `nutrition-coach`) — don't rename. **`nutrition-coach` is new (2026-08-15) and still needs its first deploy.** They read the user's Gemini key from `profiles` server-side; `SUPABASE_URL`/`SUPABASE_ANON_KEY` are auto-injected by Supabase.

**Regenerate TS types after a schema change** (keeps `src/types/database.ts` honest):
```
supabase gen types typescript --linked > src/types/database.ts
```
If maintaining by hand, remember each table needs `Relationships: []` (and the schema needs `CompositeTypes`) or supabase-js typing degrades to `never` on inserts/updates.

**Live health probes** (anon key from `.env.local`):
```
curl "$URL/rest/v1/water_logs?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"   # 200 [] = OK
curl -X POST "$URL/functions/v1/coach" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"kind":"briefing"}'   # 401 = deployed
```

## Repo state
- Git repo initialized on `main`; remote `origin` → https://github.com/TuniGenAI/fitnessapp; initial commit pushed.
- `.env.local` present and filled (Supabase URL + anon key); git-ignored.
- Live deploy: https://fitnessapp-mauve-nine.vercel.app (auto-deploys on push to `main`).

## Milestone 0 — COMPLETE ✅ (2026-08-13)
Exit check met: app is live at a URL, Google sign-in reaches Google end-to-end, dashboard renders. Remaining owner step before real *data* flows: apply the Milestone 1 SQL (above).
