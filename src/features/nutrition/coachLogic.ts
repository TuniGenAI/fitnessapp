/**
 * Nutrition-coach logic — pure, testable, no I/O.
 *
 * Holds the meal-by-time-of-day model and the rule-based fallback plan used when
 * the AI is unavailable (demo mode, no Gemini key, or quota exhausted). The AI
 * path (edge function `nutrition-coach`) is richer; this guarantees the feature
 * still does something useful without it.
 */
import type { Macros } from "./api";
import type { GoalType } from "@/types";

export interface PlannedMeal {
  key: "breakfast" | "lunch" | "snack" | "dinner" | "evening";
  label: string;
  /** By this hour (local, 0–24) the meal is normally over. */
  endHour: number;
}

/**
 * The owner's current (bulk-phase) meal pattern. Kept as ONE constant on purpose:
 * when the goal shifts (cut/maintain) this is the single place to adjust, and it
 * could later be selected by goal (see NUTRITION-COACH-SPEC.md §11.2).
 */
export const MEAL_PATTERN: PlannedMeal[] = [
  { key: "breakfast", label: "Breakfast", endHour: 10 },
  { key: "lunch", label: "Lunch", endHour: 14 },
  { key: "snack", label: "Afternoon snack", endHour: 17 },
  { key: "dinner", label: "Dinner", endHour: 21 },
];

/** "HH:mm" → decimal hour (14:30 → 14.5). Bad input → 12. */
export function parseHour(timeHHmm: string): number {
  const [h, m] = timeHHmm.split(":").map(Number);
  if (Number.isNaN(h)) return 12;
  return h + (Number.isNaN(m) ? 0 : m / 60);
}

/** Meals still realistically ahead given the time; after dinner → a light snack. */
export function remainingMeals(timeHHmm: string): PlannedMeal[] {
  const h = parseHour(timeHHmm);
  const left = MEAL_PATTERN.filter((m) => h < m.endHour);
  if (left.length) return left;
  return [{ key: "evening", label: "A light evening snack", endHour: 24 }];
}

export function goalLabel(goal: GoalType | null | undefined): string {
  switch (goal) {
    case "bulk":
      return "building muscle (bulk)";
    case "cut":
      return "losing fat (cut)";
    case "maintain":
      return "maintaining weight";
    default:
      return "general fitness";
  }
}

const STAPLES: Record<PlannedMeal["key"], string> = {
  breakfast: "eggs with bread and a little olive oil, or lbenna with oats",
  lunch: "chicken or tuna with couscous and a vegetable salad",
  snack: "lbenna/yogurt, a boiled egg, or a handful of chickpeas",
  dinner: "grilled tuna or chicken with a tomato-onion salad and some bread",
  evening: "lbenna or a boiled egg",
};

/**
 * Rule-based plan for the meals still ahead: split remaining calories/protein
 * evenly and attach a cheap Tunisian staple per meal. Used verbatim in demo mode
 * and as the graceful fallback when the AI can't answer.
 */
export function fallbackPlan(remaining: Macros, timeHHmm: string): string {
  const cal = Math.max(0, Math.round(remaining.calories));
  const pro = Math.max(0, Math.round(remaining.protein_g));
  if (cal <= 50 && pro <= 5) {
    return "You've basically hit your targets for today. Nice work. If you're still hungry, keep it light: water, a piece of fruit, or some lbenna.";
  }
  const meals = remainingMeals(timeHHmm);
  const perCal = Math.round(cal / meals.length);
  const perPro = Math.round(pro / meals.length);
  const lines = meals.map(
    (m) => `${m.label}: ~${perCal} kcal / ~${perPro} g protein, ${STAPLES[m.key]}.`,
  );
  return (
    `You've got about ${cal} kcal and ${pro} g protein left. Here's a simple split for what's ahead:\n` +
    lines.join("\n")
  );
}
