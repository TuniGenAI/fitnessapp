# CLAUDE.md — Project Guide

This file is the home base for building and maintaining the Fitness App. It's written so that **someone who doesn't code** can still follow what's going on, and so that **Claude** (the AI assistant doing the building) always knows the plan, the conventions, and the setup steps.

> **Companion docs:** [`PRD.md`](./PRD.md) = *what* we're building and why. [`TASKS.md`](./TASKS.md) = the ordered checklist for the first build. **This file** = *how* it's built and set up.

---

## 0. START HERE (for a fresh conversation)

> **⚡ CURRENT STATUS (2026-08-13): Phase 1 is COMPLETE and LIVE.** All features (M0–M7) are built and deployed; backend, edge functions (`coach`, `food-photo`, `food-text`), and the Gemini key are live; `npm run build` is green. Only **Milestone 8** (the owner's on-device iPhone-PWA pass) and one parked item (offline logging) remain. **Read [`HANDOFF.md`](./HANDOFF.md) for the exact current state + a Runbook (deploy, migrations, the PostgREST schema-cache gotcha, type regen).** The steps below describe the original cold-start build order and are kept for history.
>
> **Post-Phase-1 changes (2026-08-13, app v0.5.0):** custom exercises are **editable/deletable** from the picker (owner-created only; seeded library is read-only); dashboard water supports a **clamped −250 ml reduce**; supplements can be logged **multiple times/day** (a `count` column on `supplement_logs`, migration `20260813120500`, macros scale by count); nutrition **Add food → Describe** tab estimates a whole meal's macros from free text via the new `food-text` edge function (rename + save-for-future + confirm, same graceful fallback as photo). A **profile/goals persistence bug** ("saved but empty on refresh") was fixed at the root — see the auth/session note under *Architecture that matters when editing*. A small `APP_NAME · vX.Y.Z` marker in Settings (bump it on deploys) lets the owner confirm the live build past the PWA cache.

**If you're an AI assistant opening this project cold, do this in order:**
1. Read **this file** (stack, architecture, conventions, setup).
2. Read [`PRD.md`](./PRD.md) (requirements — the source of truth for *what* to build).
3. Read [`TASKS.md`](./TASKS.md) for the milestone checklist (now mostly ✅) and [`HANDOFF.md`](./HANDOFF.md) for where things actually stand — **pick up from what's unchecked**, don't restart at Milestone 0.
4. Steps marked **(you)** in TASKS.md need the owner to create a free account or paste a key — pause and guide them in plain language when you hit one.

These files contain the complete plan and current state. No prior conversation is needed to continue.

**App name:** intentionally **undecided** for now — placeholder is *"Fitness App"*. This does **not** block the build. When scaffolding, put the display name in **one central place** (the PWA manifest `name`/`short_name` in `vite.config.ts` and a single `APP_NAME` constant) so renaming later is a one-line change. Don't scatter the name through the code.

---

## 1. What this project is

A personal fitness **PWA** (a website that installs onto your iPhone home screen like an app) that:
1. Tracks workouts and pushes progressive overload with an **AI coach**.
2. Tracks nutrition — calories, macros, water, and supplements.

It's for one user (you) now, built so it can open to others later. It runs entirely on **free tiers ($0/month)**.

---

## 2. The stack, in plain English

Think of the app as three parts: the thing you look at (frontend), the thing that remembers your data (backend), and the smart helper (AI). Here's each piece and *why* it was chosen.

| Piece | Product | What it actually does | Why this one |
|---|---|---|---|
| **Frontend** | **React + Vite + TypeScript** | The screens you tap on — dashboard, workout logger, food logger. "React" builds the interface; "Vite" runs/bundles it fast; "TypeScript" catches mistakes early. | Industry standard, huge community, easy for AI to build reliably, one codebase for web + phone. |
| **Styling** | **Tailwind CSS** | How it looks — colors, spacing, the playful rings and cards. | Fast to build a polished, consistent look without fighting CSS. |
| **App-on-phone** | **PWA** (`vite-plugin-pwa`) | Makes the website installable to your iPhone home screen and gives it an app-like feel. | No App Store needed; one build works everywhere. |
| **Charts** | **Recharts** | Draws your progress graphs and macro rings. | Simple, looks good, works in React. |
| **Celebrations** | a confetti library | The PR party moment. | Tiny, fun, motivating. |
| **Barcode** | a camera scanner lib (e.g. `@zxing/browser`) | Reads food barcodes with your phone camera. | Works in iPhone Safari over HTTPS. |
| **Backend** | **Supabase** | Remembers everything: your account, workouts, food, supplements, photos — and syncs across devices. It's a database + login system + file storage + small server functions, all in one. | Generous free tier, built-in Google login, secure per-user data, and "edge functions" to safely call the AI. This is also the **API-first backbone** a future native app could reuse. |
| **Login** | **Supabase Auth (Google)** | "Sign in with Google." | One tap, no passwords to manage. |
| **AI coach + food photos** | **Gemini** (Google) free tier | Writes your workout briefings/recaps and reads food photos to estimate macros. | Genuinely free within limits; the user already used it successfully. |
| **Food database** | **Open Food Facts** | The library we search for foods and barcodes. | Free, open, huge, no API key needed. |
| **Hosting** | **Vercel** (frontend) + Supabase (backend) | Puts the app on the internet at a URL. | Free tier, connects to the code, auto-deploys. |

**Total cost for one user: $0/month.**

---

## 3. How the parts talk to each other

```
   ┌─────────────────────────────┐
   │   Your iPhone / Browser     │
   │   (React PWA, installed)    │
   └───────────────┬─────────────┘
                   │  reads/writes your data (securely, per-user)
                   ▼
   ┌─────────────────────────────┐        ┌──────────────────────────┐
   │        Supabase             │        │   Open Food Facts        │
   │  • Postgres database        │◄──────►│   (food search + barcode)│
   │  • Google auth              │        └──────────────────────────┘
   │  • File storage (photos)    │
   │  • Edge Functions ──────────┼──────► ┌──────────────────────────┐
   │       (call the AI safely)  │        │   Gemini API (free)      │
   └─────────────────────────────┘        │   coach text + photo→macros
                                          └──────────────────────────┘
```

**Key rule — API-first:** the frontend never holds secrets and never talks to Gemini directly. It calls Supabase; a Supabase **edge function** holds the logic and talks to Gemini. This keeps the API key off the phone and means a future **native iOS app** can call the exact same backend.

---

## 4. Repo structure (planned)

```
Fitness App/
├── PRD.md                  # what & why
├── CLAUDE.md               # this file — how & setup
├── TASKS.md                # ordered build checklist
├── .env.local              # your secret keys (never committed) — see §6
├── index.html
├── package.json
├── vite.config.ts
├── supabase/
│   ├── migrations/         # database schema (tables, security rules)
│   └── functions/          # edge functions (e.g. coach, food-photo)
└── src/
    ├── main.tsx            # app entry
    ├── App.tsx             # routes
    ├── lib/                # supabase client, gemini calls, helpers
    ├── features/
    │   ├── workouts/       # program builder, logger, history, PRs
    │   ├── coach/          # AI briefing/recap/reactions
    │   ├── nutrition/      # food search, barcode, photo, meals, water
    │   ├── supplements/    # stack + daily checklist
    │   ├── body/           # weigh-ins + trend
    │   └── dashboard/      # Today view, weekly strip, charts, celebrations
    ├── components/         # shared UI (buttons, rings, cards)
    └── types/              # shared TypeScript types
```

---

## 5. Conventions

- **TypeScript everywhere**; shared types in `src/types`.
- **Feature folders** — code grouped by feature (above), not by file type.
- **Units:** store canonical (kg, ml, grams) in the database; convert for display per user setting.
- **Dates:** store as ISO in UTC; display in the user's local time.
- **Security:** every table has **row-level security** so a user only ever sees their own rows. No secret keys in frontend code — ever.
- **Graceful AI degradation:** every AI feature has a non-AI fallback (e.g. rule-based target suggestion) so the app is fully usable without a Gemini key.
- **Keep the core loop fast:** logging a set or a meal should be 1–2 taps. Guard this in every UI decision.
- **Docs stay current:** when a feature ships or a decision changes, update PRD.md / this file / TASKS.md in the same change.

---

## 6. First-time setup (step by step, no experience assumed)

Do these once. Each creates a free account or key. Claude will run the code commands; you do the account clicks.

### 6.1 Install the tools on your computer
- Install **Node.js** (LTS version) from nodejs.org — this lets the app run.
- (Optional) Install **Git** if you want version history.

### 6.2 Create the backend (Supabase)
1. Go to **supabase.com** → sign up (free) → **New project**. Pick a name and a strong database password (save it).
2. In the project, open **Project Settings → API**. Copy the **Project URL** and the **anon public key** — you'll paste these into `.env.local` (step 6.5).
3. Open **Authentication → Providers → Google** and enable it (Supabase shows the exact steps; it involves creating a free Google OAuth credential — Claude will guide you when we reach that task).

### 6.3 Get a free Gemini key
1. Go to **Google AI Studio** (aistudio.google.com) → **Get API key** → create one (free).
2. Keep it handy. In the app you'll paste it into **Settings** (it's stored per-user and used server-side). For local testing it can also go in `.env.local`.

### 6.4 Get the code running
From the project folder, Claude will run:
```bash
npm install
npm run dev
```
Then open the URL it prints (usually `http://localhost:5173`).

### 6.5 Secret keys file (`.env.local`)
Create a file named `.env.local` in the project root (Claude will scaffold it). It holds:
```
VITE_SUPABASE_URL=...        # from step 6.2
VITE_SUPABASE_ANON_KEY=...   # from step 6.2
```
**Never share or commit this file.** The Gemini key lives in the app's Settings (per-user), not here, in normal use.

### 6.6 Put it online (Vercel)
1. Go to **vercel.com** → sign up (free) → import the project.
2. Add the same environment variables from `.env.local` in Vercel's settings.
3. Deploy. Vercel gives you a URL. Open it on your iPhone in Safari → **Share → Add to Home Screen** to "install" the app.

---

## 7. How the AI coach is wired

- **Where it runs:** a **Supabase edge function** (server-side). The frontend sends it "here's today's plan + recent relevant sets," the function builds a prompt, calls **Gemini**, and returns text. The **API key never touches the browser.**
- **What it sees (token-frugal):** only the last few sessions for *today's* exercises, plus goals and current bodyweight — not the whole history. This keeps it fast and well within the free tier.
- **Two moments:**
  - **Pre-workout:** returns (a) target weight×reps per exercise to pre-fill the logger, and (b) a short motivational briefing.
  - **In-workout:** based on the user's per-session choice — either a quick **reaction after each set**, or a single **end-of-workout recap**.
- **Fallback:** if no key/quota, a **rule-based suggester** still provides targets ("hit all target reps last time → +2.5kg or +1 rep"). The app never blocks on the AI.
- **Supplements:** the coach sees them only through the macro totals + adherence; it gives gentle nudges, not timing instructions.

---

## 8. How Claude should work in this repo

- **Follow the build order in [`TASKS.md`](./TASKS.md).** It's sequenced so the app is runnable early and each step builds on a working base.
- **Explain as you go.** The owner doesn't code — when you make a meaningful choice or ask them to click something (create an account, paste a key), say what and why in plain language.
- **Verify before claiming done.** Run the app (`npm run dev`), click the actual feature, and confirm it works. If something fails, say so with the error — don't paper over it.
- **Keep secrets safe.** Never put the Gemini key or Supabase service key in frontend code or commit `.env.local`.
- **Protect the core loop.** If a change would add taps to logging a set or meal, flag it.
- **Update docs in the same change** when features land or decisions shift.
- **Respect the constraints in PRD §9.** Don't promise auto scale-sync on iPhone/PWA; use manual entry + the documented future paths.

---

## 9. Quick reference

- **Product spec / requirements:** [`PRD.md`](./PRD.md)
- **Build checklist:** [`TASKS.md`](./TASKS.md) · **Current state + Runbook:** [`HANDOFF.md`](./HANDOFF.md)
- **Run locally:** `npm run dev` · **Build (must stay green):** `npm run build`
- **Live app:** https://fitnessapp-mauve-nine.vercel.app (auto-deploys on push to `main`)
- **Supabase project:** `yotsunlngoudmxowiviq` · **Edge functions:** `coach`, `food-photo`, `food-text` (deployed; read the per-user Gemini key server-side). **The CLI isn't installed locally** — deploy functions with `npx supabase functions deploy <name>` (after `npx supabase login` + `npx supabase link --project-ref yotsunlngoudmxowiviq`) or paste the code in the Supabase dashboard → Edge Functions.
- **Free accounts needed:** Supabase, Google (OAuth + Gemini key), Vercel
- **Monthly cost (1 user):** $0

### Design system — "Calm Athletic" (2026-08-13)
- **One source of truth:** all colors, radii, glass, and fonts are CSS tokens in [`src/index.css`](./src/index.css) `@theme` (dark-first) with `:root.light` overrides. Change the look there — components consume tokens via Tailwind utilities (`bg-brand`, `text-accent`) and the `.card` / `.card-2` glass classes. **Don't hardcode hex in components.**
- **Identity:** calm sky/teal **brand** (`--color-brand #22b6d6`), bright-green **energy accent** (`--color-accent #4fe08a` = go/success/PR), violet kept only as the calories ring. Surfaces are **glass** (translucent + `backdrop-blur` + gradient sheen) over a fixed radial-glow body background. Big numerals/headings use the **display font** (Space Grotesk via the `.font-display` utility); body is Inter. Fonts load from Google Fonts in `index.html` (graceful system fallback offline).
- **True dual theme:** `src/lib/theme.ts` is tri-state `system | light | dark`, **defaults to `system`**, and re-applies live on OS change. A pre-paint script in `index.html` sets the class before first paint (no flash). Settings → Appearance is a 3-way segmented control.

### Architecture that matters when editing
- **Local-first data layer:** feature UI → each feature's `api.ts` → `@/lib/repo` + `@/lib/session`, which hit **Supabase when signed in** and the **localStorage demo store** (`@/lib/localDb.ts`) otherwise. This keeps the app fully clickable/verifiable in *demo mode* without Google OAuth. Keep new features on this pattern.
- **Charts + scanner are code-split** — `recharts` loads via `React.lazy` when a chart mounts; `@zxing/browser` via dynamic `import()` on first camera use. Keep chart code behind lazy boundaries so the main bundle stays ~130 kB.
- **Migrations gotcha:** a newly created table 404s over REST (`PGRST205`) until PostgREST's schema cache reloads — run `NOTIFY pgrst, 'reload schema';` or restart the project. Page loads are defensive (`Promise.allSettled` + `finally`) so one failing query can't blank a screen.
- **Auth session must be registered DURING RENDER, not in an effect** (`src/features/auth/AuthProvider.tsx` calls `setSessionState(session, demo)` in the render body). React runs **child effects before parent effects**, so if this were a `useEffect`, `ProfileProvider` (a child) would load profile/goals *before* the session id reached `@/lib/session`, `usingBackend()` would be `false`, and the read would return nothing — making saved data look lost on **every reload** (backend only; demo is synchronous so it hides the bug). Don't move this back into an effect. Root cause of the long "saves but empty on refresh" hunt.
- **Profile/goals writes are resilient** (`src/features/profile/api.ts`): read-then-`UPDATE`-by-id / `INSERT`-if-missing (no reliance on `onConflict`), and a write that touches **0 rows is a hard error** surfaced in the UI, never a silent no-op. `ProfileProvider` loads profile and goals **independently** (`Promise.allSettled`) so one failing read can't discard the other. Keep both patterns.

### Biggest known product limits (per PRD §9)
- iPhone+PWA can't auto-read the Xiaomi scale → **manual weigh-in entry** for v1. (The explanatory note was removed from the Body screen at the owner's request on 2026-08-13; the limitation itself still stands — see PRD §9.)
- A personal AI subscription can't power the app → **Gemini free key** instead, called from an edge function; every AI feature has a non-AI fallback.
