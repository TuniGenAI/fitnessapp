# ROADMAP — post-Phase-1 improvements

> ## ✅ CLOSED — all 14 items shipped & deployed (2026-08-16, v0.9.0 → v0.12.0)
> This roadmap is **complete and live**. The competitive-audit backlog was built, verified, and deployed
> in one session: frontend on `main` → Vercel, all migrations applied (REST-verified), `coach` edge fn at
> v4. Nothing outstanding. Kept as the record of the audit + what shipped; a **future** improvement backlog
> would start a new "Round 2" section below or a fresh doc.
>
> Born from the competitive audit (2026-08-16) benchmarking the app against **MacroFactor**
> (adaptive nutrition), **MyFitnessPal** (logging breadth), and **Strong/Hevy** (training).
> Companion docs: [`PRD.md`](./PRD.md) (what/why) · [`CLAUDE.md`](./CLAUDE.md) (how) · [`HANDOFF.md`](./HANDOFF.md) (state).

## Where the app stands (audit summary)

**Strengths:** clean local-first + API-first architecture with RLS; both training *and* nutrition
loops in one app; five nutrition input methods (photo-AI, text-AI, OFF search, barcode, saved
meals); EMA weight-trend smoothing; a culturally-aware "plan the rest of my day" nutrition coach;
$0 cost, installable PWA, honest about platform limits.

**The gap that matters most:** the app computes a **static** TDEE (Mifflin-St Jeor, set once) and
uses fixed calorie deltas. MacroFactor's whole value is an **adaptive** engine that back-calculates
real expenditure from logged intake + weight trend and refreshes targets over time. We already store
every input needed (`food_logs` + `body_metrics`) — we just never closed the loop. That's item #1.

---

## Tier 1 — differentiator + table stakes

- [x] **1. Adaptive TDEE engine.** ✅ Shipped in **v0.9.0**. Back-calculates real expenditure from
  intake + smoothed weight trend over a rolling window; falls back to the Mifflin formula until
  there's ~2 weeks of data. Engine: [`adaptiveTdee.ts`](./src/features/nutrition/adaptiveTdee.ts);
  data wrapper `getExpenditureEstimate()` in `nutrition/api.ts`; "Adaptive" tab in the Goals editor.
- [x] **2. Rate-based goals.** ✅ Shipped with #1 — the Adaptive tab sets calories from a weekly
  weight-change slider (−1.0 … +0.5 kg/week) via `targetsFromRate`. *(Still uses the fixed
  cut/maintain/bulk buckets in the Formula tab; the rate control is adaptive-only for now.)*
- [x] **3. Rest timer.** ✅ Shipped in **v0.10.0**. Auto-starts a countdown after each working set;
  floating bar with −15/+15/Skip and a haptic+beep cue at zero. On/off + default duration in Settings
  (device-local, `src/features/workouts/restTimer.ts`). *(Per-exercise defaults deferred — global for now.)*
- [x] **4. Optional RPE / RIR per set.** ✅ Shipped in **v0.10.0**. Optional 6–10 chip row in the logger
  (tap to set/clear, never blocks logging); stored on `workout_sets.rpe` (migration `20260813120600`,
  **needs applying**). The rule-based suggester now uses it — double jump when a top set was RPE ≤ 6,
  "hold" advice when the last set was ≥ 9.5. *(Feeding RPE into the Gemini coach prompt is a later step.)*

## Tier 2 — real friction, medium effort

- [x] **5. Recents / Frequent quick-add** ✅ Shipped in **v0.11.0**. New "Recent" tab (default) in the
  add-food sheet lists distinct recently-logged foods newest-first; tap the row to adjust servings/meal,
  or the "＋" to re-log instantly with the same servings. `listRecentFoods()` in `nutrition/api.ts`.
- [x] **6. Meal-time buckets** ✅ **Already shipped** (found during the audit — the original claim was
  wrong). `guessMeal()` auto-defaults by time, `ServingStep` has a meal picker, and `FoodLogList` groups
  the day's log into Breakfast / Lunch / Dinner / Snack sections. No further work needed.
- [x] **7. Keep fiber** ✅ Shipped in **v0.11.0**. Captured from Open Food Facts (`off.ts`), stored on
  `foods.fiber_g` + `food_logs.fiber_g` (migration `20260813120700`, **needs applying**), enterable in the
  Custom-food form, and surfaced as a daily total + per-row "· Fib N". *(Sugar/other micros deferred.)*
- [x] **8. Stall detection → deload** ✅ Shipped in **v0.12.0**. `detectStall` + `deloadTarget` in
  `workouts/logic.ts` (3 sessions with no top-end progress → suggest backing off ~10%); the logger fetches
  recent per-session best e1RMs (`getRecentSessionBestE1RMs`) and overrides the suggestion when stalled.
- [x] **9. Custom-food coverage aid** ✅ Shipped in **v0.12.0**. When Open Food Facts search returns
  nothing, an "✨ Estimate with AI" button runs the text-AI on the query and routes to save-as-food.

## Tier 3 — motivation, retention, polish

- [x] **10. Coach cross-session memory** ✅ Shipped in **v0.12.0**. Recap now carries `trainedThisWeek`
  (rule-based continuity line) + a digest of recent recaps to the `coach` edge function (**redeploy needed**)
  so the AI can reference the trend, not just today.
- [x] **11. Progress photos** ✅ Shipped in **v0.12.0**. Add/view/delete on the Body screen; images are
  client-downscaled to ~720px JPEG and stored as a data URL in the new `progress_photos` table
  (**migration**), which keeps it free-tier with no Storage bucket. *(Storage-bucket upgrade is the future path.)*
- [x] **12. Body-tape measurements** ✅ Shipped in **v0.12.0**. Optional waist/chest/arms/thighs/hips in the
  weigh-in sheet (new `body_metrics` columns, **migration**), shown as a "Measurements (cm)" panel.
- [x] **13. In-app nudges** ✅ Shipped in **v0.12.0**. A single dismissible, data-driven dashboard nudge
  (resume workout / no food logged / behind on protein / session ready), dismissed per-day.
- [x] **14. Data export / backup** ✅ Shipped in **v0.12.0**. Settings → "Export my data (JSON)" gathers every
  user-owned table (Gemini key excluded) and downloads it; works in demo + backend (`src/lib/exportData.ts`).

---

## 🎉 Roadmap complete (2026-08-16)
All 14 audit items are shipped (v0.9.0 → v0.12.0). Remaining follow-ups are **deploy steps**, not code:
apply the four pending migrations, redeploy the `coach` edge function (now sends history), and deploy the
still-pending `nutrition-coach` function. See HANDOFF.md's deploy queue.

---

## Build notes

### Item 1 — Adaptive TDEE (design)

The physics: over a window, `expenditure ≈ average_daily_intake − (Δ trend-weight × 7700 kcal/kg) / days`.
If your smoothed weight fell while you ate 2,400 kcal/day, you were expending *more* than 2,400.

- **Pure engine:** [`src/features/nutrition/adaptiveTdee.ts`](./src/features/nutrition/adaptiveTdee.ts)
  — `estimateExpenditure(intake, weights)` and `targetsFromRate(expenditure, ratePerWeek, weightKg)`.
  No I/O, testable, sits beside the existing static [`tdee.ts`](./src/features/nutrition/tdee.ts).
- **Data wrapper:** `getExpenditureEstimate()` in `nutrition/api.ts` reads `food_logs` + `body_metrics`.
- **UI:** a third "Adaptive" mode in the Goals editor showing the estimated expenditure + a
  weekly-rate control, with a graceful "not enough data yet, using the formula" state.
- **Confidence gating:** needs ~2 weeks of logged intake and weigh-ins spanning the window before it
  trusts data over the formula. Never dead-ends — degrades to the Mifflin path.
