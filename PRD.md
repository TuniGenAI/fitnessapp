# Product Requirements Document — Fitness App

> **Working title:** (to be named — placeholder: *"Fitness App"*)
> **Author:** Ben (product owner) with Claude
> **Status:** Approved for Phase 1 build
> **Last updated:** 2026-08-13
> **Audience of this doc:** Anyone building or reviewing the app — written in plain language, no coding knowledge assumed.

---

## 1. Vision

A **personal fitness app** that lives on the web and on your iPhone (as an installable app), keeping all your data in sync between them. It exists to do two things extremely well:

1. **Track your workouts and push you to progressively overload** — always know what you did last time, get a concrete target to beat, and be motivated by an AI coach plus visible progress (PRs, streaks, charts).
2. **Track your nutrition** — calories, macros (protein / carbs / fat), water, and supplements — and help you hit daily goals with fast logging (photo, barcode, search, saved meals).

It starts as a tool for **one person (you)**, but is built so it could open up to **other users later** without a rebuild.

### The one-sentence pitch
> "Open the app, see exactly what to lift and eat today, log it in seconds from my phone, and watch my numbers go up."

---

## 2. Target user & guiding principles

**Primary user:** You — a lifter following a structured program, eating toward a macro goal, training primarily by feel-plus-numbers, using an iPhone at the gym and a browser at home.

**Guiding principles (in priority order):**
1. **Fast logging beats rich logging.** The core loop — log a set, log a meal — must be effortless one-handed on a phone. Depth is optional, never in the way.
2. **Motivation is a feature, not decoration.** Progressive overload only works if you keep showing up and pushing. PRs, streaks, coach encouragement, and "beat last time" prompts are first-class.
3. **Honesty over hype.** Where a platform limit exists (see §9), the app states it plainly and offers the realistic path instead of pretending.
4. **$0 to run.** Everything stays on free tiers for a single user.
5. **Build for one, ready for many.** Personal now; multi-user and a possible native iOS app later, without throwing away work.

---

## 3. Usage scenarios

**A. Gym session (phone, possibly weak signal)**
1. Open app → **Today dashboard** shows today's planned workout.
2. Tap **Start Workout**. The **AI coach** briefs you ("Today: bench — you hit 57.5kg×8 last week, let's aim for 60×6") and pre-fills target weight×reps per exercise.
3. For each set, the last-time numbers are shown; you log what you actually did in a tap or two.
4. You chose at the start whether the coach **reacts live** after each set or gives an **end-of-workout recap**.
5. If you beat a record, a **PR celebration** fires. Finish → coach recap + notes for next time.

**B. Meal logging (phone, throughout the day)**
1. Tap **Log Food**. Choose: **snap a photo** (AI estimates macros), **search** the food database, **scan a barcode**, or pick a **saved meal**.
2. Confirm/adjust the serving; it adds to today's totals.
3. **Macro rings** on the dashboard update. Tick off any **supplements** taken (protein powder adds to your protein total automatically).
4. Log **water** with quick +250ml taps.

**C. Weekly check-in (web or phone)**
1. Glance at the **weekly strip**: streak, days trained, macro adherence.
2. Log a **weigh-in** (weight + body-fat/muscle/water, typed from your Xiaomi scale readout) and watch the **trend line**.
3. Review **progress charts** per exercise and muscle group.

---

## 4. Feature requirements

Legend: **[MVP]** = Phase 1 (build now) · **[P2]** = Phase 2 · **[P3]** = Phase 3.

### 4.1 Workouts
- **[MVP]** Log sets as **weight × reps** (lean by design; no RPE/tempo in v1).
- **[MVP]** Support **free weights, machines/cables, and bodyweight** exercises. (No cardio in v1.)
- **[MVP]** **Program/split builder**: create training days (e.g. Push / Pull / Legs), add exercises with target sets/reps. Start from **templates** (PPL, Upper/Lower, Full Body) *and* fully customize.
- **[MVP]** **"Last time" always visible** for each exercise while logging.
- **[MVP]** **Rule-based next-target suggestion** (e.g. hit all target reps → suggest +2.5kg or +1 rep) as a reliable fallback that works even without the AI.
- **[MVP]** **Workout history** with per-exercise view.
- **[P2]** Supersets, rest timers, RPE/RIR, set types (warmup/drop/failure).

### 4.2 Progressive-overload AI coach *(the defining feature)*
- **[MVP]** **Pre-workout:** reads recent relevant sessions + goals, produces **pre-filled targets** in the logger **and** a short **conversational briefing**.
- **[MVP]** **In-workout mode is user's choice per session:** **live per-set reactions** *or* a single **end-of-workout recap**.
- **[MVP]** **Token-frugal context:** the coach only sees the last few sessions for *today's* exercises plus goals/bodyweight — not the entire history.
- **[MVP]** Powered by **Gemini free tier**; the API key is stored per-user in settings and calls run **server-side** (never exposed in the browser).
- **[MVP]** Graceful degradation: if no key is set or the AI is unavailable, the rule-based suggester still gives targets.
- **[P2]** Coach persona/tone selection (hype / calm-technical / drill-sergeant); deeper per-set live coaching polish.

### 4.3 Nutrition
- **[MVP]** Track **calories, protein, carbs, fat, and water** against daily goals.
- **[MVP]** Log food via **four methods**: (a) **photo → AI scan** (Gemini vision), (b) **Open Food Facts search**, (c) **barcode scan** (iPhone camera), (d) **saved custom foods & meals** for one-tap logging.
- **[MVP]** **Goal setting both ways:** a **TDEE calculator** (body stats + cut/bulk/maintain → suggested calories & macros) **and** manual override of any number.
- **[MVP]** **Water** quick-add.
- **[P2]** Different calorie/protein targets on **training vs rest days** (data model supports it now; UI later). Micros/fiber/sugar.

### 4.4 Supplements
- **[MVP]** **Daily adherence checklist** — define your stack (seeded defaults: protein powder, creatine, vitamins/fish oil, pre-workout/caffeine); tick each off per day (**simple once-a-day**).
- **[MVP]** **Macro contribution** — protein/calorie-bearing supplements carry serving macros and **count toward daily totals** when checked. Non-macro supps (creatine, vitamins) are pure adherence.
- **[MVP]** **Adherence streak/consistency** view alongside workouts.
- **[MVP]** **Coach is lightly aware** (via macro totals + adherence); gentle nudges only, **no timing micro-management**.

### 4.5 Body metrics
- **[MVP]** **Manual entry** of **weight, body-fat %, muscle, and water** (all fields the Xiaomi scale gives), logged **whenever**.
- **[MVP]** **Smoothed trend line** (daily weight is noisy; the trend is what matters).
- **[MVP]** Body stats feed the **TDEE calculator**.
- **[P2]** **Apple Shortcuts → backend bridge** to auto-forward weight + body-fat from Apple Health.
- **[P3]** **Native iOS app** with HealthKit for fuller auto-sync (see §9).

### 4.6 Dashboard & motivation
- **[MVP]** **Hybrid Today dashboard**: macro rings, water, today's workout (or "Start Workout"), a coach line, supplement checklist.
- **[MVP]** **Weekly strip** on top: current streak, days trained this week, macro adherence.
- **[MVP]** **PR celebrations** (confetti) for heaviest weight / best volume / most reps.
- **[MVP]** **Progress charts** (per exercise, muscle group, bodyweight, macro adherence over time).
- **[MVP]** **Streaks & consistency** and **beat-last-time prompts**.
- **[MVP]** **Playful, motivating** visual style — filling rings, streak flames, celebrations. Installable PWA feel.

### 4.7 Accounts & settings
- **[MVP]** **Google sign-in.** One account (you) now; multi-user-ready data isolation from day one.
- **[MVP]** **Settings:** Gemini API key entry, nutrition goals, program management, supplement stack, units (kg/lb, ml/oz), coach mode defaults.
- **[MVP]** **Sync across devices** (log on phone, see it on web instantly).
- **[MVP]** Start **fresh** — no import of old Gemini chat logs.

---

## 5. Non-goals / explicit v1 exclusions

To keep the MVP shippable, these are **intentionally out** for now (most are Phase 2/3):
- Cardio/conditioning tracking (time/distance/pace).
- Offline logging (nice-to-have; not required for v1).
- Push notifications / reminders (PWA push on iOS is limited).
- **Automatic** scale sync (see §9 — not possible on iPhone+PWA).
- A native mobile app.
- Importing historical workout data.
- Social features, sharing, or public accounts (kept *possible* by the data model, not built).

---

## 6. Success criteria (MVP is "done" when…)

1. You can **sign in with Google** on both your iPhone (installed PWA) and a browser, and data syncs.
2. You can **build a program**, **run a workout** end-to-end with last-time numbers, targets, and a coach briefing + recap.
3. A **PR triggers a celebration**; charts and streaks reflect real logged data.
4. You can **log food all four ways** (photo, search, barcode, saved meal), plus **water**, and see macro rings update against your goals.
5. You can **manage a supplement stack**, tick it off daily, and **protein powder shows up in your protein total**.
6. You can **log a weigh-in** with all composition fields and see a trend line.
7. It runs at **$0/month** for you as a single user.
8. Every constraint in §9 is represented honestly in-app (e.g. the scale section explains manual entry and the future path).

---

## 7. Data model (overview)

High-level tables (details finalized in build). All rows are scoped to a user via row-level security so multi-user is safe later.

- **users / profiles** — identity (Google), units, coach defaults, Gemini key (stored securely).
- **goals** — calorie & macro targets (calculated and/or manual), optional train/rest-day variants.
- **programs** → **program_days** → **program_exercises** — the plan/split.
- **exercises** — library (name, type: free-weight/machine/bodyweight, muscle group).
- **workouts** → **workout_sets** — actual logged sessions (weight, reps, per set).
- **personal_records** — derived PRs per exercise (weight / volume / reps).
- **foods** — custom + cached Open Food Facts items (macros per serving, barcode).
- **meals** — saved reusable meals (a bundle of foods).
- **food_logs** — dated entries counting toward daily totals.
- **supplements** — stack items (name, serving, optional macros, active flag).
- **supplement_logs** — dated taken/not-taken; protein-bearing ones surface in the macro rollup.
- **body_metrics** — dated weight, body-fat %, muscle, water.
- **coach_messages** — briefings/recaps/reactions (for history and context).

---

## 8. Roadmap

**Phase 1 — MVP (build now):** everything marked **[MVP]** above — both goals fully usable, on free tiers, installable on iPhone.

**Phase 2 — Polish & power:**
- Live per-set coaching polish + coach persona/tone.
- **Apple Shortcuts → backend bridge** for weight/body-fat auto-forward.
- Offline logging with sync.
- Train-day vs rest-day macro periodization in the UI.
- Rest timers, supersets, RPE, richer analytics.

**Phase 3 — Beyond personal:**
- Open to **multi-user** (invite/sign-up flows, per-user billing for AI if needed).
- **Native iOS app** reusing the same backend, with **HealthKit** for real scale/body-composition sync.

---

## 9. Constraints & honest tradeoffs

These were surfaced during planning and must not be glossed over in the product or docs.

### 9.1 A personal AI subscription cannot power an app
A Claude/ChatGPT-style **subscription only covers using those apps directly**. Any AI feature *inside this app* must call a **separate, billed API**. **Decision:** use the **Gemini free tier** (a free key from Google AI Studio), stored per-user and called server-side. This keeps the app at $0 and is what the user already used successfully.

### 9.2 The Xiaomi Body Composition Scale 2 cannot auto-sync on iPhone + PWA
Three hard walls, all real:
- **iOS Safari has no Web Bluetooth** → a web app can't read the scale over Bluetooth.
- **PWAs cannot read Apple Health (HealthKit)** → even though Zepp Life can push weight/body-fat into Apple Health, a web app can't pull it out. Only native iOS apps can.
- **Zepp Life has no public API** for third parties.

**Decision:** v1 uses **fast manual entry** of all composition fields. The backend is built **API-first** so that later either:
- an **Apple Shortcuts bridge** can read weight + body-fat from Apple Health and POST it to the backend (Phase 2), or
- a **native iOS app** with HealthKit can sync fuller data (Phase 3).

Muscle/water often don't cross into Apple Health from Zepp anyway, so those may remain manual even with a bridge. This is stated honestly rather than promised.

### 9.3 iPhone PWA capabilities
Barcode scanning works via the camera in iOS Safari (requires HTTPS — provided by hosting). Push notifications and background sync are limited on iOS, which is why notifications are a non-goal for v1.

---

## 10. Tech stack (approved, all free tiers)

See **CLAUDE.md** for the plain-English "what each piece does & why." In brief:
- **Frontend:** React + Vite + TypeScript + Tailwind, as an installable **PWA**; charts via Recharts; barcode via a camera scanner library; confetti for PRs.
- **Backend:** **Supabase** (Postgres database, Google auth, row-level security, file storage, edge functions).
- **AI:** **Gemini** free tier (text + vision) via a Supabase edge function.
- **Food data:** **Open Food Facts** (free open database, search + barcode).
- **Hosting:** **Vercel** (frontend) + Supabase + Gemini — **$0/month** for a single user.
