/**
 * Units, dates, and small math helpers.
 *
 * Convention (CLAUDE.md §5): the database stores canonical units — weight in KG,
 * volume in ML, macros in GRAMS. We convert only for display, based on the
 * user's profile preference.
 */
import type { WeightUnit, VolumeUnit } from "@/types";

const LB_PER_KG = 2.2046226218;
const OZ_PER_ML = 0.033814;

// ---- Weight -----------------------------------------------------------------
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Convert a canonical kg value into the user's unit for display. */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kgToLb(kg) : kg;
}
/** Convert a user-entered display value back to canonical kg for storage. */
export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === "lb" ? lbToKg(value) : value;
}

/** Format a canonical kg weight for display, e.g. "60 kg" / "132.5 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = toDisplayWeight(kg, unit);
  return `${trim(v)} ${unit}`;
}

/** Smallest sensible plate/dumbbell increment in the user's unit, in kg. */
export function weightIncrementKg(unit: WeightUnit): number {
  return unit === "lb" ? lbToKg(5) : 2.5;
}

// ---- Volume (water) ---------------------------------------------------------
export function mlToOz(ml: number): number {
  return ml * OZ_PER_ML;
}
export function toDisplayVolume(ml: number, unit: VolumeUnit): number {
  return unit === "oz" ? mlToOz(ml) : ml;
}

// ---- Numbers ----------------------------------------------------------------
/** Round to the nearest `step` (e.g. 2.5 kg). */
export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Drop trailing ".0" — 60 → "60", 62.5 → "62.5". */
export function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---- Dates ------------------------------------------------------------------
/** Local calendar date as `YYYY-MM-DD` (not UTC — matters near midnight). */
export function todayISO(d: Date = new Date()): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` for `daysAgo` days before today (local). */
export function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return todayISO(d);
}

/** Short human date, e.g. "Aug 13". */
export function shortDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Relative label for a past ISO datetime: "Today", "Yesterday", "3 days ago". */
export function relativeDay(iso: string): string {
  const then = todayISO(new Date(iso));
  const t = todayISO();
  if (then === t) return "Today";
  if (then === isoDaysAgo(1)) return "Yesterday";
  const diff = Math.round(
    (new Date(`${t}T00:00:00`).getTime() - new Date(`${then}T00:00:00`).getTime()) /
      86400000,
  );
  if (diff > 0 && diff < 7) return `${diff} days ago`;
  return shortDate(then);
}

/** A fresh UUID (crypto in browsers; falls back for older runtimes). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
