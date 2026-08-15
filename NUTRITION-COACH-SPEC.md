# SPEC — Nutrition Coach ("Finish my day")

> Status: **BUILT (2026-08-15, app v0.8.0)** — frontend + edge function done, verified in demo mode. **One owner step remains: deploy the edge function** (`supabase functions deploy nutrition-coach`) so the live app gets AI plans instead of the rule-based fallback. Owner-approved decisions captured below.
> Companion: [`PRD.md`](./PRD.md) (why), [`CLAUDE.md`](./CLAUDE.md) (how), [`HANDOFF.md`](./HANDOFF.md) (state).

## 1. One-line goal
On the nutrition screen, a button that asks the AI: *"Given what I've eaten today and my goals, how do I finish the rest of my day?"* — and gets back a concrete, budget-friendly Tunisian plan for the remaining meals, then lets me keep chatting about it.

## 2. Why
Logging tells the owner *where they are*; it doesn't tell them *what to do next*. Hitting a protein/calorie target at 3pm with 60 g protein left is a planning problem the app currently leaves to the user. This closes the loop: log → see the gap → get an actionable, affordable, on-plan way to fill it.

## 3. Agreed decisions (from discovery, 2026-08-14)
| Question | Decision |
|---|---|
| **Output** | **Full plan for the rest of the day**, split across the meals still to come. |
| **Meal structure** | Inferred **by time of day** from a default Tunisian meal pattern — no user setup. |
| **Local / budget knowledge** | **Gemini general knowledge** of cheap Tunisian staples. "Budget-friendly" = humble local foods (eggs, tuna, lbenna/yogurt, bread, couscous, seasonal produce, legumes), **not** verified current prices. *(Prices in Tunisia drift with inflation/season; we explicitly do not claim price accuracy.)* |
| **Past habits** | AI **learns taste from the owner's log but may suggest new foods.** History is sent as a **compact pre-aggregated summary**, not raw logs. |
| **Interaction** | **Conversational, no hard cap** (owner accepted the quota tradeoff). Mitigated by cheap-by-design prompts + graceful 429 fallback (§7). |
| **Dietary limits** | None beyond **halal** (no pork/alcohol) — stated in the system prompt. |
| **Trigger** | **On-tap only.** Never fires on passive screen load (respects the v0.6.0 quota rule — see HANDOFF 2026-08-14). |

## 4. Placement & UX
- A button on **`NutritionPage`** — e.g. **"Plan the rest of my day"** — near the macro rings, visible once some food is logged (also usable at 0 logged: it just plans the whole day).
- Tap → opens a **Sheet** (same `Sheet` component as Add Food) showing:
  1. A one-line **gap summary** rendered client-side, no AI: *"Left today: 900 kcal · 60 g protein · 80 g carbs · 20 g fat."*
  2. The **AI plan** (prose, meal-by-meal for the remaining meals).
  3. A **text box** to reply ("no chicken today", "make it cheaper", "I'm eating out") → appends to the conversation.
- Each AI turn is a fresh call; the sheet holds the running transcript in local component state (not persisted for v1).
- **Optional later:** a "Log this" affordance that parses a suggested item into `logFood`. **Out of scope for v1** — v1 is advice only; the owner logs normally.

## 5. Inputs (all cheap, mostly already computed)
Built client-side and sent to the edge function:
- **Remaining macros** = goals (from `ProfileProvider` nutrition targets) − **`getFoodTotals()` only**. **Supplements are NOT subtracted** (owner decision, 2026-08-14: their stack carries no meaningful protein/calories). *Caveat for a future builder: if the owner ever logs a protein supplement like whey (+~24 g protein in the default stack), remaining protein would read high by that amount — revisit the exclusion then.*
- **Time of day** = client local `HH:mm` (so the function can reason about which meals remain without a timezone round-trip).
- **What's eaten today** = a short list of today's logged food names (from `listFoodLogs()`), so it doesn't re-suggest the same lunch.
- **Habit summary** = `getDailyHistory(14)` folded into a tiny digest: avg daily calories/protein + the owner's most-logged foods (top ~8 names by frequency). This is the "learns your taste" signal — compact, no raw log dump.
- **Goal label** = e.g. "cut / maintain / bulk" from goals, plus bodyweight (for protein sanity).
- **Conversation** = prior turns (for follow-up messages).

## 6. Output
Short prose (no markdown lists required, but a light structure is fine), e.g.:
> "You've got ~900 kcal and 60 g protein left. **Afternoon snack:** a lbenna + a boiled egg (~15 g protein, cheap). **Dinner:** grilled tuna (1 can) with a big tomato-and-onion salad and a small bread — ~40 g protein, keeps you under budget. That lands you right on target for protein without going over calories."

Constraints baked into the prompt: halal; lean toward affordable Tunisian staples; hit remaining protein first, then fit calories; don't blow past the calorie ceiling; keep it to the meals that realistically remain given the time.

## 7. Quota posture (owner chose *no cap* — mitigate, don't block)
The v0.6.0 lesson: uncached Gemini calls drain the ~250/day flash free tier and cause 429s elsewhere (food photo, recaps). Because the owner wants unlimited chat, we lower the *cost per call* instead of limiting calls:
- **On-tap only**, never on load.
- **Compact context** — pre-aggregated history digest, not raw logs; short food-name lists only.
- **Prose model call** like `coach` (no `responseMimeType`); reuse `maxOutputTokens: 2048`, `gemini-flash-latest`.
- **Graceful degradation:** on `fallback`/`429`/no key, show a **rule-based mini-plan** built client-side (distribute remaining macros across remaining meals with a couple of generic Tunisian staple suggestions) + the honest note "AI is out of quota, here's a simple split." The feature is never dead.
- Consider (optional) a tiny client-side "AI calls today" counter surfaced only if it climbs unusually high — informational, not a hard block.

## 8. Backend — new edge function `nutrition-coach`
Clone `supabase/functions/coach/index.ts` (same auth, same per-user key read, same CORS, same fallback contract). Differences:
- **Request body:** `{ remaining: Macros, eatenToday: string[], timeHHmm: string, habit: {avgCalories, avgProtein, topFoods: string[]}, goalLabel: string, bodyweightKg?: number, history: {role:'user'|'model', text:string}[] }`.
- **Prompt:** system role = "concise nutrition coach for a user in Tunisia; halal only; suggest affordable local staples; plan the remaining meals by time of day; hit remaining protein first, stay under the calorie ceiling; ~4–6 sentences." Then feed `history` as Gemini multi-turn `contents`, with the newest user message last.
- **Response:** `{ text, fallback, error }` — identical shape to `coach`, so the client wrapper mirrors `describeMeal`.
- **Deploy:** `supabase functions deploy nutrition-coach` (name is called verbatim by the client — don't rename).

## 9. Frontend work
- `src/features/nutrition/api.ts`: add `planRestOfDay(input, history)` → `supabase.functions.invoke('nutrition-coach', …)`, same null/fallback handling and `aiErrorHint()` reuse as `describeMeal`.
- Helper to build the habit digest from `getDailyHistory` + a frequency count over `food_logs` names.
- Helper to compute remaining macros incl. supplement contribution.
- New component `PlanDaySheet.tsx` (transcript + input), opened from a button on `NutritionPage`.
- Rule-based fallback planner (pure function, testable) for the no-AI path — mirrors the coach's rule-based fallback philosophy.
- **Demo mode:** the AI call returns null in demo (no backend), so demo always shows the **rule-based** plan. Keep it working (verifiability without OAuth — HANDOFF architecture note).

## 10. Explicitly out of scope for v1
- One-tap "log this suggestion" (parsing prose → food log).
- Real Tunisian **price data** / cost estimates in dinar.
- Persisting the conversation across sessions.
- User-defined meal times / dietary profiles (time-of-day inference is enough for now).

## 11. Resolved (owner, 2026-08-14)
1. **Supplements in "remaining"? → NO.** Remaining = goals − food logs only (§5). The owner's stack has no meaningful protein/calories.
2. **Default meal pattern → 3 meals + afternoon snack** (breakfast <10:00, lunch ~12–14, snack ~16–17, dinner ~19–21). **Goal-dependent:** this is the owner's current **bulk** target; when the goal shifts (cut/maintain) the pattern should change. Build the default as the bulk pattern but keep it a **single easy-to-change constant** (ideally selectable by goal label later). The AI must also **cross-check against what's actually logged** — the owner is *trying to* follow this pattern but may deviate, so don't assume a meal happened just because its time has passed; infer from `eatenToday` + time together.
3. **Button label & spot → confirmed:** "Plan the rest of my day" on the Fuel screen, under the rings.
