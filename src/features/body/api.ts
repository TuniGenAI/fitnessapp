/**
 * Body-metrics data access — manual weigh-ins + trend. Backend ↔ demo.
 */
import { getUserId } from "@/lib/session";
import { selectRows, insertRow, deleteWhere } from "@/lib/repo";
import type { BodyMetric } from "@/types";

function requireUid(): string {
  const uid = getUserId();
  if (!uid) throw new Error("Not signed in");
  return uid;
}

export async function listMetrics(): Promise<BodyMetric[]> {
  const rows = await selectRows<BodyMetric>("body_metrics", { user_id: requireUid() });
  return rows.sort((a, b) => a.measured_at.localeCompare(b.measured_at));
}

export async function addMetric(input: {
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  muscle_pct?: number | null;
  water_pct?: number | null;
  note?: string | null;
  measured_at?: string;
}): Promise<BodyMetric> {
  return insertRow<BodyMetric>("body_metrics", {
    user_id: requireUid(),
    measured_at: input.measured_at ?? new Date().toISOString(),
    weight_kg: input.weight_kg ?? null,
    body_fat_pct: input.body_fat_pct ?? null,
    muscle_pct: input.muscle_pct ?? null,
    water_pct: input.water_pct ?? null,
    note: input.note ?? null,
  });
}

export async function deleteMetric(id: string): Promise<void> {
  await deleteWhere("body_metrics", { id });
}

export async function getLatest(): Promise<BodyMetric | null> {
  const rows = await listMetrics();
  return rows.length ? rows[rows.length - 1] : null;
}

/** Latest recorded bodyweight in kg (for the TDEE calculator), or null. */
export async function getLatestWeightKg(): Promise<number | null> {
  const rows = await listMetrics();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].weight_kg != null) return rows[i].weight_kg;
  }
  return null;
}

/**
 * Exponential moving average of a weight series — the smoothed "trend weight"
 * that matters more than daily scale noise (PRD Body section).
 */
export function smoothWeights(
  points: { date: string; weight: number }[],
  alpha = 0.25,
): { date: string; weight: number; trend: number }[] {
  let ema: number | null = null;
  return points.map((p) => {
    ema = ema == null ? p.weight : alpha * p.weight + (1 - alpha) * ema;
    return { date: p.date, weight: p.weight, trend: Math.round(ema * 10) / 10 };
  });
}
