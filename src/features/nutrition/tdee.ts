/**
 * TDEE + macro target math (pure). Mifflin-St Jeor BMR × activity factor,
 * adjusted for the cut/bulk/maintain goal, then split into macros.
 */
import type { GoalType } from "@/types";

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Light (1–3 workouts/week)",
  moderate: "Moderate (3–5 workouts/week)",
  active: "Active (6–7 workouts/week)",
  very_active: "Very active (hard training / physical job)",
};

/** Goal → daily calorie delta from maintenance. */
const GOAL_DELTA: Record<GoalType, number> = {
  cut: -500,
  maintain: 0,
  bulk: 300,
};

export interface TdeeInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: GoalType;
}

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  maintenance: number; // TDEE before the goal adjustment
}

export function mifflinBmr(input: Omit<TdeeInput, "activity" | "goal">): number {
  const { sex, age, heightCm, weightKg } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

/**
 * Compute calorie + macro targets. Protein anchored at 2 g/kg bodyweight, fat at
 * ~25% of calories, carbs fill the remainder (evidence-based, athlete-friendly).
 */
export function computeTargets(input: TdeeInput): MacroTargets {
  const bmr = mifflinBmr(input);
  const maintenance = Math.round(bmr * ACTIVITY_FACTORS[input.activity]);
  const calories = Math.max(1200, Math.round(maintenance + GOAL_DELTA[input.goal]));

  const protein_g = Math.round(input.weightKg * 2);
  const fat_g = Math.round((calories * 0.25) / 9);
  const carbCalories = Math.max(0, calories - protein_g * 4 - fat_g * 9);
  const carbs_g = Math.round(carbCalories / 4);

  return { calories, protein_g, carbs_g, fat_g, maintenance };
}

/** Kcal implied by a macro split — used to sanity-check manual overrides. */
export function caloriesFromMacros(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9);
}
