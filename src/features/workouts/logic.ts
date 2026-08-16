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
 *   • hit the top of the rep range → add a load increment (a double jump when the
 *     set was genuinely easy — RPE ≤ 6), reset to the bottom of the range;
 *   • otherwise → keep the weight and chase one more rep.
 *
 * RPE (when logged) sharpens the call: it tells an easy top set from a grind, so
 * the suggestion can push harder when there's clearly gas left, or hold when the
 * last set was already near failure. RPE stays optional — the logic degrades to
 * the plain double-progression above when it's absent.
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
  // Hardest effort recorded at the top weight (highest RPE), if any set was rated.
  const rpes = setsAtTop.map((s) => s.rpe).filter((r): r is number => r != null);
  const topRpe = rpes.length ? Math.max(...rpes) : null;
  const rpeNote = topRpe != null ? ` @RPE ${trim(topRpe)}` : "";

  if (worstReps >= repHigh) {
    const inc = weightIncrementKg(unit);
    // Genuinely easy at the top of the range → jump two increments.
    const steps = topRpe != null && topRpe <= 6 ? 2 : 1;
    const weightKg = roundTo(topWeight + inc * steps, inc);
    const added = trim(toDisplayWeight(inc * steps, unit));
    const easy = steps === 2 ? " — that was easy, bigger jump" : "";
    return {
      weightKg,
      reps: repLow,
      reason: `Hit ${repHigh} reps${rpeNote} last time — add ${added} ${unit}${easy}`,
    };
  }

  // Didn't finish the range. If the last set was already near failure, holding
  // the weight to consolidate is the honest call; otherwise chase a rep.
  const reps = Math.min(worstReps + 1, repHigh);
  if (topRpe != null && topRpe >= 9.5) {
    return {
      weightKg: topWeight,
      reps,
      reason: `Near failure${rpeNote} last time — hold and own this weight for ${reps}`,
    };
  }
  return {
    weightKg: topWeight,
    reps,
    reason: `Chase ${reps} reps at the same weight${rpeNote}`,
  };
}

// ---- Stall detection → deload ----------------------------------------------
/** A session's best working set scored by estimated 1RM (0 if none logged). */
export function sessionBestE1RM(sets: WorkoutSet[]): number {
  const b = bestSet(sets);
  return b ? estimatedOneRepMax(b.weight_kg, b.reps) : 0;
}

/**
 * Stalled = three recent sessions with no upward progress. Given each session's
 * best estimated-1RM newest-first, returns true when the newest hasn't beaten the
 * session two back — a flat/declining top end that a plain "+2.5 kg" won't fix.
 */
export function detectStall(recentBestE1RMs: number[]): boolean {
  const s = recentBestE1RMs.filter((x) => x > 0);
  if (s.length < 3) return false;
  const newest = s[0];
  const thirdBack = s[2];
  return newest <= thirdBack + 1e-6;
}

/** Deload: back off ~10% from the top weight to rebuild with clean reps. */
export function deloadTarget(
  topWeightKg: number,
  repHigh: number,
  unit: WeightUnit,
): TargetSuggestion {
  const inc = weightIncrementKg(unit);
  const weightKg = Math.max(inc, roundTo(topWeightKg * 0.9, inc));
  const off = trim(toDisplayWeight(Math.max(0, topWeightKg - weightKg), unit));
  return {
    weightKg,
    reps: repHigh,
    reason: `Stalled 3 sessions — deload ${off} ${unit} and rebuild with clean reps`,
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
