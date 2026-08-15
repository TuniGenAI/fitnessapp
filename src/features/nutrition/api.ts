/**
 * Nutrition data access — saved/custom foods, food logging, saved meals, water,
 * and daily roll-ups. Backend ↔ demo via `@/lib/repo`.
 */
import { supabase } from "@/lib/supabase";
import { getUserId, usingBackend } from "@/lib/session";
import {
  selectRows,
  insertRow,
  insertRows,
  deleteWhere,
} from "@/lib/repo";
import { todayISO, isoDaysAgo } from "@/lib/format";
import type {
  Food,
  FoodLog,
  Meal,
  MealItem,
  MealType,
  WaterLog,
} from "@/types";
import type { OffFood } from "./off";

function requireUid(): string {
  const uid = getUserId();
  if (!uid) throw new Error("Not signed in");
  return uid;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const ZERO: Macros = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
  };
}

// ---- Saved / custom foods ---------------------------------------------------
export async function listFoods(): Promise<Food[]> {
  const rows = await selectRows<Food>("foods", { user_id: requireUid() });
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFood(input: {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  source?: "custom" | "open_food_facts";
  off_id?: string | null;
  serving_label?: string | null;
  serving_size_g?: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}): Promise<Food> {
  return insertRow<Food>("foods", {
    user_id: requireUid(),
    name: input.name.trim(),
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    source: input.source ?? "custom",
    off_id: input.off_id ?? null,
    serving_label: input.serving_label ?? null,
    serving_size_g: input.serving_size_g ?? null,
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
  });
}

export async function saveOffFood(off: OffFood): Promise<Food> {
  return createFood({
    name: off.name,
    brand: off.brand,
    barcode: off.barcode,
    source: "open_food_facts",
    off_id: off.off_id,
    serving_label: off.serving_label,
    serving_size_g: off.serving_size_g,
    calories: off.calories,
    protein_g: off.protein_g,
    carbs_g: off.carbs_g,
    fat_g: off.fat_g,
  });
}

export async function deleteFood(id: string): Promise<void> {
  await deleteWhere("foods", { id });
}

// ---- Food logs --------------------------------------------------------------
export async function listFoodLogs(date = todayISO()): Promise<FoodLog[]> {
  const rows = await selectRows<FoodLog>("food_logs", {
    user_id: requireUid(),
    log_date: date,
  });
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Log a food. `perServing` macros × `servings` are stored denormalized so the
 *  entry survives edits/deletes of the source food. */
export async function logFood(input: {
  name: string;
  perServing: Macros;
  servings: number;
  meal_type?: MealType | null;
  food_id?: string | null;
  log_date?: string;
}): Promise<FoodLog> {
  const s = input.servings;
  return insertRow<FoodLog>("food_logs", {
    user_id: requireUid(),
    food_id: input.food_id ?? null,
    log_date: input.log_date ?? todayISO(),
    meal_type: input.meal_type ?? null,
    servings: s,
    name: input.name,
    calories: Math.round(input.perServing.calories * s),
    protein_g: Math.round(input.perServing.protein_g * s * 10) / 10,
    carbs_g: Math.round(input.perServing.carbs_g * s * 10) / 10,
    fat_g: Math.round(input.perServing.fat_g * s * 10) / 10,
  });
}

export async function deleteFoodLog(id: string): Promise<void> {
  await deleteWhere("food_logs", { id });
}

export function sumFoodLogs(logs: FoodLog[]): Macros {
  return logs.reduce<Macros>(
    (t, l) => addMacros(t, {
      calories: l.calories,
      protein_g: l.protein_g,
      carbs_g: l.carbs_g,
      fat_g: l.fat_g,
    }),
    ZERO,
  );
}

export async function getFoodTotals(date = todayISO()): Promise<Macros> {
  return sumFoodLogs(await listFoodLogs(date));
}

/** Per-day calorie + protein totals over the last `days` days (oldest→newest). */
export async function getDailyHistory(
  days = 7,
): Promise<{ date: string; calories: number; protein_g: number }[]> {
  const rows = await selectRows<FoodLog>("food_logs", { user_id: requireUid() });
  const cal = new Map<string, number>();
  const pro = new Map<string, number>();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = isoDaysAgo(i);
    dates.push(d);
    cal.set(d, 0);
    pro.set(d, 0);
  }
  for (const r of rows) {
    if (cal.has(r.log_date)) {
      cal.set(r.log_date, (cal.get(r.log_date) ?? 0) + r.calories);
      pro.set(r.log_date, (pro.get(r.log_date) ?? 0) + r.protein_g);
    }
  }
  return dates.map((date) => ({
    date,
    calories: Math.round(cal.get(date) ?? 0),
    protein_g: Math.round(pro.get(date) ?? 0),
  }));
}

// ---- Saved meals ------------------------------------------------------------
export interface MealWithItems {
  meal: Meal;
  items: (MealItem & { food: Food | null })[];
  totals: Macros;
}

export async function listMeals(): Promise<MealWithItems[]> {
  const uid = requireUid();
  const [meals, items, foods] = await Promise.all([
    selectRows<Meal>("meals", { user_id: uid }),
    selectRows<MealItem>("meal_items", { user_id: uid }),
    listFoods(),
  ]);
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  return meals
    .map((meal) => {
      const mine = items
        .filter((it) => it.meal_id === meal.id)
        .map((it) => ({ ...it, food: foodMap.get(it.food_id) ?? null }));
      const totals = mine.reduce<Macros>((t, it) => {
        if (!it.food) return t;
        return addMacros(t, {
          calories: it.food.calories * it.servings,
          protein_g: it.food.protein_g * it.servings,
          carbs_g: it.food.carbs_g * it.servings,
          fat_g: it.food.fat_g * it.servings,
        });
      }, ZERO);
      return { meal, items: mine, totals };
    })
    .sort((a, b) => a.meal.name.localeCompare(b.meal.name));
}

export async function createMeal(
  name: string,
  items: { food_id: string; servings: number }[],
): Promise<Meal> {
  const uid = requireUid();
  const meal = await insertRow<Meal>("meals", { user_id: uid, name: name.trim() });
  await insertRows<MealItem>(
    "meal_items",
    items.map((it) => ({
      meal_id: meal.id,
      user_id: uid,
      food_id: it.food_id,
      servings: it.servings,
    })),
  );
  return meal;
}

export async function deleteMeal(id: string): Promise<void> {
  await deleteWhere("meal_items", { meal_id: id });
  await deleteWhere("meals", { id });
}

/** One-tap: log every item of a saved meal for the given date. */
export async function logMeal(mealId: string, date = todayISO()): Promise<void> {
  const meals = await listMeals();
  const target = meals.find((m) => m.meal.id === mealId);
  if (!target) return;
  for (const it of target.items) {
    if (!it.food) continue;
    await logFood({
      name: it.food.name,
      perServing: {
        calories: it.food.calories,
        protein_g: it.food.protein_g,
        carbs_g: it.food.carbs_g,
        fat_g: it.food.fat_g,
      },
      servings: it.servings,
      food_id: it.food.id,
      log_date: date,
    });
  }
}

// ---- Photo → AI macro estimate ---------------------------------------------
export interface PhotoFood {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Estimate macros from a food photo via the `food-photo` edge function (Gemini
 * vision). Returns null when unavailable (demo mode, no key, function not
 * deployed, or an error) so the UI can fall back to manual entry.
 */
export async function scanFoodPhoto(
  imageBase64: string,
  mimeType: string,
): Promise<PhotoFood | null> {
  if (!usingBackend() || !supabase) return null;
  const { data, error } = await supabase.functions.invoke<{
    food?: PhotoFood;
    fallback?: boolean;
    error?: string;
  }>("food-photo", { body: { imageBase64, mimeType } });
  if (error) throw new Error(`Couldn't reach the food-photo function (${error.message}).`);
  if (data?.food) return data.food;
  // The function ran but Gemini rejected the request — surface the real reason
  // instead of silently falling back (this is what a bad key / quota / retired
  // model looks like; a missing key returns fallback with no error → null).
  if (data?.error) throw new Error(aiErrorHint(data.error));
  return null;
}

/**
 * Estimate a meal's total macros from a free-text description via the `food-text`
 * edge function (Gemini). Returns null when unavailable (demo mode, no key,
 * function not deployed, or the text isn't food) so the UI can fall back to
 * manual entry — same contract as `scanFoodPhoto`.
 */
export async function describeMeal(text: string): Promise<PhotoFood | null> {
  if (!usingBackend() || !supabase) return null;
  const { data, error } = await supabase.functions.invoke<{
    food?: PhotoFood;
    fallback?: boolean;
    error?: string;
  }>("food-text", { body: { text } });
  if (error) throw new Error(`Couldn't reach the food-text function (${error.message}).`);
  if (data?.food) return data.food;
  if (data?.error) throw new Error(aiErrorHint(data.error));
  return null;
}

// ---- Nutrition coach ("plan the rest of my day") ---------------------------
export interface HabitDigest {
  avgCalories: number;
  avgProtein: number;
  topFoods: string[];
}

/** Compact "past habits" signal for the coach: average daily calories/protein
 *  over recent days actually logged, plus the most frequently logged foods.
 *  One read, pre-aggregated — cheap to send to the AI (spec §5). */
export async function getHabitDigest(days = 14, topN = 8): Promise<HabitDigest> {
  const rows = await selectRows<FoodLog>("food_logs", { user_id: requireUid() });
  const cutoff = isoDaysAgo(days - 1);
  const recent = rows.filter((r) => r.log_date >= cutoff);
  const loggedDays = new Set(recent.map((r) => r.log_date)).size || 1;
  let cal = 0;
  let pro = 0;
  const freq = new Map<string, number>();
  for (const r of recent) {
    cal += r.calories;
    pro += r.protein_g;
    const name = r.name.trim();
    if (name) freq.set(name, (freq.get(name) ?? 0) + 1);
  }
  const topFoods = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
  return {
    avgCalories: Math.round(cal / loggedDays),
    avgProtein: Math.round(pro / loggedDays),
    topFoods,
  };
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface PlanContext {
  timeHHmm: string;
  goalLabel: string;
  remaining: Macros;
  targets: Macros;
  eatenToday: string[];
  habit: HabitDigest;
}

/**
 * Ask the `nutrition-coach` edge function (Gemini) for a plan for the rest of the
 * day, given the running conversation. Returns the coach's text, or null when the
 * AI is unavailable (demo mode, no key) so the UI can fall back to the rule-based
 * plan. A real Gemini error (bad key / quota) throws with a specific hint — same
 * contract as `describeMeal`.
 */
export async function planRestOfDay(
  context: PlanContext,
  messages: ChatTurn[],
): Promise<string | null> {
  if (!usingBackend() || !supabase) return null;
  const { data, error } = await supabase.functions.invoke<{
    text?: string | null;
    fallback?: boolean;
    error?: string;
  }>("nutrition-coach", { body: { context, messages } });
  if (error) throw new Error(`Couldn't reach the nutrition-coach function (${error.message}).`);
  if (data?.text) return data.text;
  if (data?.error) throw new Error(aiErrorHint(data.error));
  return null; // no key → graceful fallback
}

/** Turn the edge function's raw `gemini <status>` / error string into a hint
 *  that points at the real cause. Keeps the actual code visible for debugging. */
function aiErrorHint(err: string): string {
  const m = err.match(/gemini (\d+)/);
  const status = m ? Number(m[1]) : null;
  if (status === 400 || status === 403)
    return `AI rejected the request (${err}). Your Gemini API key is likely invalid or missing the Generative Language API — re-paste a fresh key in Settings.`;
  if (status === 429)
    return `AI is rate-limited / out of quota (${err}). Wait a bit or use a key with quota left.`;
  if (status === 404)
    return `AI model not found (${err}). The model name is out of date — this needs a code fix.`;
  return `AI couldn't process this (${err}). Try again, or log it manually.`;
}

// ---- Water ------------------------------------------------------------------
export async function getWaterMl(date = todayISO()): Promise<number> {
  try {
    const rows = await selectRows<WaterLog>("water_logs", {
      user_id: requireUid(),
      log_date: date,
    });
    return rows.reduce((sum, r) => sum + r.ml, 0);
  } catch {
    // e.g. water_logs migration not applied / PostgREST schema cache stale.
    // Water is non-critical — degrade to 0 rather than blanking the page.
    return 0;
  }
}

export async function addWater(ml: number, date = todayISO()): Promise<void> {
  await insertRow<WaterLog>("water_logs", {
    user_id: requireUid(),
    log_date: date,
    ml,
  });
}
