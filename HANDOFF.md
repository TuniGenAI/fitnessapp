# HANDOFF — build context for the next conversation

> Read this first (after `CLAUDE.md` / `PRD.md` / `TASKS.md`) to continue the build with full context. Last updated: **2026-08-13**.

---

## Where we are

**Milestone 0 (Foundations) is code-complete and verified running.** **Milestone 1 (Data foundation) is written and build-verified** — only applying the SQL to the live Supabase project remains (a **(you)** step). The app builds with no type errors, runs locally, and is fully clickable in **demo mode** (no backend needed yet).

### Milestone 1 built (2026-08-13)
- **Full schema** in `supabase/migrations/` — 4 ordered SQL files covering all 18 tables (profiles, goals, programs/program_days/program_exercises, exercises, workouts/workout_sets, personal_records, foods, meals/meal_items, food_logs, supplement_templates/supplements, supplement_logs, body_metrics, coach_messages).
- **RLS on every table** — owner-only policies (generated in a DO-block loop); seeded `exercises` (user_id NULL) and `supplement_templates` are shared read-only reference data. A **new-user trigger** (`handle_new_user`) auto-creates the profile, an empty goals row, and copies the default supplement stack on first sign-in.
- **Seeds** — ~44-move exercise library + 5 default supplements (whey/creatine/multivitamin/fish oil/pre-workout).
- **TypeScript types** — `src/types/database.ts` (Supabase-generated style: Row/Insert/Update per table) + convenience aliases in `src/types/index.ts`. The Supabase client is now typed with `<Database>`. `npm run build` stays green.
- **Apply guide** for the non-coder owner: `supabase/README.md` (SQL-Editor paste path + CLI path + verification steps).

**Milestone 1's one remaining (you) step:** paste the 4 SQL files into Supabase → SQL Editor (order + steps in `supabase/README.md`). Needs the Supabase URL + anon key in `.env.local` first.

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

**Still pending (guide next time):**
- **Google OAuth** — Authentication → Providers → Google. Needs a Google Cloud OAuth client (Client ID + Secret pasted into Supabase; Supabase's callback URL pasted into Google Cloud). ~5 min, walk through step-by-step.
- **Apply the DB schema** — next conversation generates SQL migration files in `supabase/migrations/`. Default apply path for a non-coder: **paste the SQL into Supabase → SQL Editor → Run** (Claude will give the exact snippet). Optional power path: owner shares a Supabase **access token** + DB password so the Supabase CLI can push automatically.

### 2. GitHub (owner)
- Create a new **empty** repo (private is fine, no README/.gitignore — repo already has one). Have the URL ready (e.g. `https://github.com/<you>/fitness-app`).
- Next conversation: `git init` → commit → push. Push auth via `gh auth login` (interactive) or a Personal Access Token — sorted live.

### 3. Vercel (owner, after repo is pushed)
- New Project → import the GitHub repo → framework preset **Vite**.
- Add the same two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel's project settings.
- Deploy → get the URL → on iPhone Safari: Share → Add to Home Screen.

### 4. Gemini (owner — keep the key OUT of chat and the repo)
- The key is **used server-side** (Supabase Edge Function) and/or stored per-user in the app's Settings. **Do NOT paste it into chat, `.env.local`, or commit it.**
- When Milestone 3 (AI coach) is built, it goes into **Supabase Edge Function secrets** or the in-app Settings screen — owner pastes it there directly.

---

## Next up: Milestone 2 — Workouts + progressive overload (Goal #1 core)
With the schema in place, build the workout flow against the typed Supabase client (`src/lib/supabase.ts` → `supabase` typed with `<Database>`; row/insert types in `src/types`):
- **Program builder** (`src/features/workouts/`): create days (Push/Pull/Legs), add exercises with target sets/reps, offer templates (PPL, Upper/Lower, Full Body). Read the exercise library from the seeded `exercises` table.
- **Workout logger:** start today's session (`workouts`), log weight×reps per set (`workout_sets`), one-handed friendly.
- **"Last time" numbers** inline per exercise (query recent `workout_sets`).
- **Rule-based next-target suggester** (works with no AI): hit all target reps last time → +2.5 kg or +1 rep.
- **Workout history** + per-exercise view; **PR detection** writing to `personal_records`.

Everything works in demo mode without a backend, but real persistence needs the migrations applied (below) + Supabase keys in `.env.local`.

### Blocking (you) step carried over from Milestone 1
Apply the schema: paste the 4 SQL files in `supabase/migrations/` into Supabase → SQL Editor, in order (full steps in `supabase/README.md`). Requires the Supabase URL + anon key in `.env.local`.

---

## How to run
```
npm install       # already done; re-run if node_modules missing
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build (must stay green)
```

## Repo state
- Not yet a git repository (`git init` pending — see GitHub step).
- `.env.local` present with blank placeholders (git-ignored).
