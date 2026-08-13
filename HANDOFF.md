# HANDOFF — build context for the next conversation

> Read this first (after `CLAUDE.md` / `PRD.md` / `TASKS.md`) for full context. Last updated: **2026-08-13**.
>
> **TL;DR:** Phase-1 is **complete and live** — all features (M0–M7) built, deployed to Vercel, backend on Supabase, AI functions deployed, Gemini key set. `npm run build` green. Only Milestone 8 (owner's iPhone-PWA end-to-end pass) and one parked item (offline logging) remain. See the Runbook near the bottom for ops.

---

## Where we are

**Milestones 0–7 are code-complete.** M0 (foundations) + M1 (schema, applied live) were done earlier; **M2–M7 (workouts, AI coach, nutrition, supplements, body, dashboard) were built and verified in demo mode on 2026-08-13.** `npm run build` is green (TS + PWA). The app is fully usable end-to-end in **demo mode** (local-first store, no backend needed) and against the live Supabase backend once signed in.

> **✅ FULLY LIVE & VERIFIED (2026-08-13). Nothing is pending on the backend.**
> - **`water_logs` migration applied** and PostgREST schema cache reloaded → water persists live (REST `GET /water_logs` → `200`). *(Gotcha: a freshly created table 404s with `PGRST205 "not found in the schema cache"` until the cache reloads — the symptom here was Fuel/Dashboard hanging. Fix: run `NOTIFY pgrst, 'reload schema';` in the SQL Editor, or restart the project. The app is now also resilient to this — see Runbook.)*
> - **Edge functions `coach` + `food-photo` deployed & verified** (both answer `401` to an anonymous probe = deployed and correctly auth-gated).
> - **Gemini key set** in the app's Settings (per-user, server-side). AI briefings/recaps + photo macro-scan are active; rule-based / manual fallbacks remain if the key is missing or quota runs out.
>
> The only work left is **Milestone 8** — an owner end-to-end pass on the *installed iPhone PWA* — plus the single parked nice-to-have (offline logging).

> **🔧 Gemini model fix (2026-08-13).** All three edge functions (`coach`, `food-photo`, `food-text`) were pinned to `gemini-1.5-flash-latest`, which Google **retired** — every call returned HTTP 404, so *all* AI features (coach text, photo scan, Describe) silently fell back at once. The symptom looked like a "function not deployed / no key" problem because the client turns any `fallback:true`/error into that same message. Fixed by switching the `GEMINI_MODEL` constant in all three functions to the **moving alias `gemini-flash-latest`** (tracks Google's current flash model, so a future retirement won't 404 us again) and redeploying all three. If AI breaks again with a `gemini <status>` error, check the model alias here first.

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

**Edge functions** (`supabase/functions/coach`, `supabase/functions/food-photo`) — deploy via the **Supabase Dashboard → Edge Functions → Deploy a new function → Via editor** (paste the file contents, name must match exactly), or CLI: `supabase functions deploy <name>`. Function names are called by the client verbatim (`coach`, `food-photo`) — don't rename. They read the user's Gemini key from `profiles` server-side; `SUPABASE_URL`/`SUPABASE_ANON_KEY` are auto-injected by Supabase.

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
