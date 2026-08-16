/**
 * Adaptive TDEE engine (pure, testable — no I/O).
 *
 * The MacroFactor-style insight the static Mifflin formula in `tdee.ts` cannot
 * give: your *actual* energy expenditure, back-calculated from what you logged
 * eating and how your (smoothed) bodyweight actually moved.
 *
 * The physics: over a window of `days`, the energy you stored or released equals
 * your weight change times the energy density of body mass (~7700 kcal/kg). So
 *
 *     expenditure ≈ average_daily_intake − (Δ trend-weight × 7700) / days
 *
 * i.e. if your smoothed weight fell while you ate 2,400 kcal/day, you were
 * expending *more* than 2,400. Targets are then derived from a desired weekly
 * rate of change and refreshed as new data arrives — instead of trusting a
 * one-time formula that goes stale the moment metabolism or adherence drifts.
 *
 * Everything here degrades gracefully: with too little data `estimateExpenditure`
 * returns null and the caller falls back to `computeTargets` (the Mifflin path).
 */
import type { GoalType } from "@/types";

/** Energy density of body-mass change. ~1 kg of body mass ≈ 7700 kcal. */
export const KCAL_PER_KG = 7700;

export interface DayIntake {
  /** `YYYY-MM-DD` local date. */
  date: string;
  calories: number;
}

export interface WeightPoint {
  /** `YYYY-MM-DD` local date. */
  date: string;
  weightKg: number;
}

export type Confidence = "low" | "medium" | "high";

export interface ExpenditureEstimate {
  /** Estimated maintenance calories per day (rounded). */
  expenditure: number;
  /** Calendar days spanned between the first and last weigh-in used. */
  daysCovered: number;
  /** Number of days in that span that actually had food logged. */
  intakeDays: number;
  /** Smoothed weight change across the span (end − start), kg. */
  weightChangeKg: number;
  /** How much to trust this over the formula. */
  confidence: Confidence;
}

export interface EstimateOptions {
  /** Only consider data from the last `windowDays` days. */
  windowDays?: number;
  /** Minimum logged-food days in the span before we'll return an estimate. */
  minIntakeDays?: number;
  /** Minimum calendar span (days) between first and last weigh-in. */
  minSpanDays?: number;
  /** EMA smoothing factor for the weight trend (matches body/api.ts). */
  alpha?: number;
}

/** Exponential moving average over a date-sorted weight series → trend values. */
function trendSeries(points: WeightPoint[], alpha: number): WeightPoint[] {
  let ema: number | null = null;
  return points.map((p) => {
    ema = ema == null ? p.weightKg : alpha * p.weightKg + (1 - alpha) * ema;
    return { date: p.date, weightKg: ema };
  });
}

/** Days between two `YYYY-MM-DD` dates (b − a), local-time-safe. */
function daysBetween(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00`).getTime();
  const tb = new Date(`${b}T00:00:00`).getTime();
  return Math.round((tb - ta) / 86400000);
}

/**
 * Back-calculate maintenance calories from logged intake + weigh-ins.
 * Returns null when there isn't enough data to beat the formula.
 */
export function estimateExpenditure(
  intake: DayIntake[],
  weights: WeightPoint[],
  options: EstimateOptions = {},
): ExpenditureEstimate | null {
  const {
    windowDays = 21,
    minIntakeDays = 10,
    minSpanDays = 10,
    alpha = 0.25,
  } = options;

  // Newest weigh-in is our reference "today"; window back from there so the
  // estimate reflects a coherent recent period even if the last log is old.
  const sortedW = [...weights]
    .filter((w) => Number.isFinite(w.weightKg) && w.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sortedW.length < 2) return null;

  const refDate = sortedW[sortedW.length - 1].date;
  const startBound = addDays(refDate, -(windowDays - 1));

  const wWindow = sortedW.filter((w) => w.date >= startBound);
  if (wWindow.length < 2) return null;

  const trend = trendSeries(wWindow, alpha);
  const first = trend[0];
  const last = trend[trend.length - 1];
  const daysCovered = daysBetween(first.date, last.date);
  if (daysCovered < minSpanDays) return null;

  // Average intake over logged days within the same span.
  const inSpan = intake.filter(
    (d) => d.date >= first.date && d.date <= last.date && Number.isFinite(d.calories) && d.calories > 0,
  );
  const intakeDays = inSpan.length;
  if (intakeDays < minIntakeDays) return null;

  const avgIntake = inSpan.reduce((s, d) => s + d.calories, 0) / intakeDays;
  const weightChangeKg = last.weightKg - first.weightKg;
  const dailyBalance = (weightChangeKg * KCAL_PER_KG) / daysCovered; // + = surplus
  const expenditure = Math.round(avgIntake - dailyBalance);

  // Sanity: a physically implausible number means the data is too noisy/sparse.
  if (expenditure < 1000 || expenditure > 6000) return null;

  const confidence: Confidence =
    intakeDays >= 14 && daysCovered >= 14
      ? "high"
      : intakeDays >= 12 && daysCovered >= 12
        ? "medium"
        : "low";

  return {
    expenditure,
    daysCovered,
    intakeDays,
    weightChangeKg: Math.round(weightChangeKg * 100) / 100,
    confidence,
  };
}

/** Add `delta` days to a `YYYY-MM-DD` date, returning `YYYY-MM-DD` (local). */
function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export interface RateTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  goal_type: GoalType;
}

/**
 * Derive calorie + macro targets from an expenditure estimate and a desired
 * weekly weight-change rate (negative = lose, positive = gain). Same macro split
 * philosophy as `computeTargets`: protein 2 g/kg, fat ~25%, carbs fill the rest.
 */
export function targetsFromRate(
  expenditureKcal: number,
  ratePerWeekKg: number,
  weightKg: number,
  proteinPerKg = 2,
): RateTargets {
  const deltaPerDay = (ratePerWeekKg * KCAL_PER_KG) / 7;
  const calories = Math.max(1200, Math.round(expenditureKcal + deltaPerDay));
  const protein_g = Math.round(weightKg * proteinPerKg);
  const fat_g = Math.round((calories * 0.25) / 9);
  const carbCalories = Math.max(0, calories - protein_g * 4 - fat_g * 9);
  const carbs_g = Math.round(carbCalories / 4);

  const goal_type: GoalType =
    ratePerWeekKg <= -0.05 ? "cut" : ratePerWeekKg >= 0.05 ? "bulk" : "maintain";

  return { calories, protein_g, carbs_g, fat_g, goal_type };
}

/** Human label for a weekly rate, e.g. "−0.5 kg/week (losing)". */
export function rateLabel(ratePerWeekKg: number): string {
  if (Math.abs(ratePerWeekKg) < 0.05) return "hold weight (maintain)";
  const sign = ratePerWeekKg < 0 ? "−" : "+";
  const dir = ratePerWeekKg < 0 ? "losing" : "gaining";
  return `${sign}${Math.abs(ratePerWeekKg).toFixed(2)} kg/week (${dir})`;
}
