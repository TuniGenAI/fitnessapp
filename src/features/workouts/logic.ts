/**
 * Pure workout math — no I/O, easy to reason about and test.
 * Progressive-overload suggestions, PR detection, and set summaries.
 */
import type { WorkoutSet, PersonalRecord, RecordType, WeightUnit } from "@/types";
import { roundTo, weightIncrementKg, toDisplayWeight, trim } from "@/lib/format";

/** Epley estimated 1-rep max. Handy for comparing sets across rep ranges. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function setVolume(weightKg: number, reps: number): number {
  return weightKg * reps;
}

/** Working sets only (drop warmups). */
export function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => !s.is_warmup);
}

/** The best working set by estimated 1RM (used for "last time" headline). */
export function bestSet(sets: WorkoutSet[]): WorkoutSet | null {
  const working = workingSets(sets);
  if (working.length === 0) return null;
  return working.reduce((best, s) =>
    estimatedOneRepMax(s.weight_kg, s.reps) > estimatedOneRepMax(best.weight_kg, best.reps)
      ? s
      : best,
  );
}

export interface TargetSuggestion {
  weightKg: number;
  reps: number;
  reason: string;
}

/**
 * Rule-based next-target suggester (works with no AI — CLAUDE.md §7 fallback).
 *
 * Looks at last session's top working weight:
 *   • hit the top of the rep range → add the smallest load increment, reset to
 *     the bottom of the range;
 *   • otherwise → keep the weight and chase one more rep.
 */
export function suggestNextTarget(
  lastSets: WorkoutSet[],
  repLow: number,
  repHigh: number,
  unit: WeightUnit,
): TargetSuggestion | null {
  const working = workingSets(lastSets);
  if (working.length === 0) return null;

  const topWeight = Math.max(...working.map((s) => s.weight_kg));
  const setsAtTop = working.filter((s) => s.weight_kg === topWeight);
  const worstReps = Math.min(...setsAtTop.map((s) => s.reps));

  if (worstReps >= repHigh) {
    const inc = weightIncrementKg(unit);
    const weightKg = roundTo(topWeight + inc, inc);
    const added = trim(toDisplayWeight(inc, unit));
    return {
      weightKg,
      reps: repLow,
      reason: `Hit ${repHigh} reps last time — add ${added} ${unit}`,
    };
  }

  const reps = Math.min(worstReps + 1, repHigh);
  return {
    weightKg: topWeight,
    reps,
    reason: `Chase ${reps} reps at the same weight`,
  };
}

// ---- Personal records -------------------------------------------------------
export interface PrCandidate {
  record_type: RecordType;
  value: number;
  weight_kg: number;
  reps: number;
}

/** The metric value a set scores for each PR type. */
export function prValue(type: RecordType, weightKg: number, reps: number): number {
  switch (type) {
    case "weight":
      return weightKg;
    case "reps":
      return reps;
    case "volume":
      return setVolume(weightKg, reps);
  }
}

const PR_TYPES: RecordType[] = ["weight", "volume", "reps"];

export interface PrCheck {
  /** New records to persist (includes silent baselines). */
  toRecord: PrCandidate[];
  /** Types genuinely beaten (worth celebrating). */
  celebrated: RecordType[];
}

/**
 * Compare a freshly logged working set against the user's existing PRs for that
 * exercise. Beating a value is celebrated; the very first value of each type is
 * stored as a silent baseline (no confetti for simply existing).
 */
export function checkPrsForSet(
  weightKg: number,
  reps: number,
  existing: PersonalRecord[],
): PrCheck {
  const toRecord: PrCandidate[] = [];
  const celebrated: RecordType[] = [];
  if (reps <= 0) return { toRecord, celebrated };

  for (const type of PR_TYPES) {
    const value = prValue(type, weightKg, reps);
    if (value <= 0) continue;
    const best = existing
      .filter((r) => r.record_type === type)
      .reduce<number | null>((m, r) => (m == null ? r.value : Math.max(m, r.value)), null);

    if (best == null) {
      toRecord.push({ record_type: type, value, weight_kg: weightKg, reps }); // baseline
    } else if (value > best + 1e-6) {
      toRecord.push({ record_type: type, value, weight_kg: weightKg, reps });
      celebrated.push(type);
    }
  }
  return { toRecord, celebrated };
}

export function prTypeLabel(type: RecordType): string {
  switch (type) {
    case "weight":
      return "Heaviest weight";
    case "reps":
      return "Most reps";
    case "volume":
      return "Best set volume";
  }
}
