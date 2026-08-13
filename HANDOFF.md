# HANDOFF — build context for the next conversation

> Read this first (after `CLAUDE.md` / `PRD.md` / `TASKS.md`) to continue the build with full context. Last updated: **2026-08-13**.

---

## Where we are

**Milestones 0–7 are code-complete.** M0 (foundations) + M1 (schema, applied live) were done earlier; **M2–M7 (workouts, AI coach, nutrition, supplements, body, dashboard) were built and verified in demo mode on 2026-08-13.** `npm run build` is green (TS + PWA). The app is fully usable end-to-end in **demo mode** (local-first store, no backend needed) and against the live Supabase backend once signed in.

> **Two owner steps remain before the live (signed-in) site has full parity:**
> 1. **Apply the new `water_logs` migration** — `supabase/migrations/20260813120400_add_water_logs.sql` (paste into the Supabase SQL Editor, same as the M1 files). Without it, water quick-add errors on the *live* site (demo mode is unaffected).
> 2. **(Optional) AI coach** — deploy the edge function (`supabase functions deploy coach`) and paste a Gemini key in Settings. Until then the coach uses its rule-based fallback (fully functional).

### What M2–M7 added (all local-first: Supabase when signed in, localStorage in demo)
- **Data layer:** `src/lib/session.ts` (auth→data bridge), `src/lib/localDb.ts` (demo store, seeds exercises + default supplements + goals/profile), `src/lib/repo.ts` (generic backend↔demo CRUD), `src/lib/format.ts` (units/dates/uuid), `src/lib/useAsync.ts`, `src/lib/celebrate.ts` (confetti). Client seeds in `src/data/`.
- **Profile context:** `src/features/profile/` — loads profile + goals app-wide (units, coach settings, nutrition targets).
- **UI kit:** `src/components/ui.tsx` (Button, Sheet, Segmented, Stepper, EmptyState, Spinner…) + new icons.
- **M2 Workouts** (`src/features/workouts/`): program builder + templates, live logger with last-time + rule-based suggestions, PR detection (+confetti), history, per-exercise 1RM chart.
- **M3 Coach** (`src/features/coach/` + `supabase/functions/coach/`): rule-based briefing/recap/reactions + Gemini edge function (key stays server-side) + graceful fallback.
- **M4 Nutrition** (`src/features/nutrition/`): TDEE calculator + manual goals, Open Food Facts search + barcode-number lookup, custom foods, saved meals, water, macro rings.
- **M5 Supplements** (`src/features/supplements/`): stack management, daily checklist, macro contribution, adherence streak.
- **M6 Body** (`src/features/body/`): weigh-ins, smoothed trend chart, feeds TDEE, honest sync note.
- **M7 Dashboard** (`src/features/dashboard/`): live rings (food+supps), water, today's session, coach line, weekly strip, supplement checklist.

**Verification (in-browser, demo mode, zero console errors):** built PPL from template → ran a Push session → PR detection fired weight+volume (not reps) with confetti → history/progress correct; TDEE math correct; OFF "banana" search→log updated rings exactly; ticking Whey added +120 kcal/+24 g protein; body weigh-in saved with snapshot; Settings units/coach/key render.

> **Parked (see TASKS.md):** photo→AI macro scan, live camera barcode scanning (needs `@zxing/browser`), muscle-group/adherence-over-time charts, PWA install prompt, recharts code-splitting (bundle ~850 kB).

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

**DB schema — ✅ APPLIED & VERIFIED (2026-08-13).** The 4 SQL files were run in the SQL Editor; live verification passed (see "Applied & verified live" under *Milestone 1 built* above). Nothing pending here.

### 2. GitHub — ✅ DONE (2026-08-13)
- Repo: **https://github.com/TuniGenAI/fitnessapp** (private). Remote `origin` set; initial commit `1558f2f` pushed to `main`. Git identity: `TuniGenAI <benfrijaomar@gmail.com>`, credential helper = GCM (cached, no prompt on push).
- **Git is driven from the infra/setup conversation** to avoid clobbering the parallel dev conversation's working-tree edits. Subsequent commits/pushes auto-deploy to Vercel.

### 3. Vercel — ✅ DONE (2026-08-13)
- Live at **https://fitnessapp-mauve-nine.vercel.app** (framework preset Vite). Env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set in the project. Auto-deploys on every push to `main`. First deploy verified: renders, no demo button (Supabase detected), Google handshake works.
- iPhone: open the URL in Safari → Share → Add to Home Screen to install the PWA.

### 4. Gemini (owner — keep the key OUT of chat and the repo)
- The key is **used server-side** (Supabase Edge Function) and/or stored per-user in the app's Settings. **Do NOT paste it into chat, `.env.local`, or commit it.**
- When Milestone 3 (AI coach) is built, it goes into **Supabase Edge Function secrets** or the in-app Settings screen — owner pastes it there directly.

---

## Next up (post-M7)
The Phase-1 feature set is built. Remaining work is **owner verification on the live signed-in site** + the parked polish items:
1. Apply `water_logs` migration (above); sign in on the deployed site and confirm the `handle_new_user` trigger seeded your profile/goals/5 default supplements (Table Editor).
2. Run one real session signed in (start a workout, log sets, finish) and confirm rows land in `workouts`/`workout_sets`/`personal_records`; log a food + water; tick a supplement; add a weigh-in.
3. (Optional) Deploy the `coach` edge function + add a Gemini key to light up AI briefings/recaps.
4. Then Milestone 8 (ship & verify on installed iPhone PWA) + parked items in TASKS.md.

**Architecture note for the next builder:** feature code never talks to a backend directly — it calls each feature's `api.ts`, which uses `@/lib/repo` + `@/lib/session` to hit **Supabase when signed in** and the **local demo store** otherwise. Keep new features on that pattern so demo mode keeps working (it's how the app is verifiable without Google OAuth).

---

## How to run
```
npm install       # already done; re-run if node_modules missing
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build (must stay green)
```

## Repo state
- Git repo initialized on `main`; remote `origin` → https://github.com/TuniGenAI/fitnessapp; initial commit pushed.
- `.env.local` present and filled (Supabase URL + anon key); git-ignored.
- Live deploy: https://fitnessapp-mauve-nine.vercel.app (auto-deploys on push to `main`).

## Milestone 0 — COMPLETE ✅ (2026-08-13)
Exit check met: app is live at a URL, Google sign-in reaches Google end-to-end, dashboard renders. Remaining owner step before real *data* flows: apply the Milestone 1 SQL (above).
