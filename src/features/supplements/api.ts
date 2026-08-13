/**
 * Supplements data access — the once-a-day stack, per-day check-off logs,
 * macro contribution, and adherence. Backend ↔ demo via `@/lib/repo`.
 */
import { getUserId } from "@/lib/session";
import { selectRows, insertRow, updateRow, deleteWhere } from "@/lib/repo";
import { todayISO, isoDaysAgo } from "@/lib/format";
import type { Supplement, SupplementLog } from "@/types";
import type { Macros } from "@/features/nutrition/api";

function requireUid(): string {
  const uid = getUserId();
  if (!uid) throw new Error("Not signed in");
  return uid;
}

export async function listSupplements(includeInactive = false): Promise<Supplement[]> {
  const rows = await selectRows<Supplement>("supplements", { user_id: requireUid() });
  return rows
    .filter((s) => includeInactive || s.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export async function createSupplement(input: {
  name: string;
  serving_label?: string | null;
  category?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}): Promise<Supplement> {
  const existing = await listSupplements(true);
  const sort = existing.reduce((m, s) => Math.max(m, s.sort_order), 0) + 10;
  return insertRow<Supplement>("supplements", {
    user_id: requireUid(),
    name: input.name.trim(),
    serving_label: input.serving_label ?? null,
    category: input.category ?? "general",
    calories: input.calories ?? 0,
    protein_g: input.protein_g ?? 0,
    carbs_g: input.carbs_g ?? 0,
    fat_g: input.fat_g ?? 0,
    is_active: true,
    sort_order: sort,
  });
}

export async function updateSupplement(
  id: string,
  patch: Partial<Pick<Supplement,
    "name" | "serving_label" | "category" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "is_active" | "sort_order"
  >>,
): Promise<Supplement> {
  return updateRow<Supplement>("supplements", id, patch);
}

export async function deleteSupplement(id: string): Promise<void> {
  await deleteWhere("supplement_logs", { supplement_id: id });
  await deleteWhere("supplements", { id });
}

// ---- Daily check-off --------------------------------------------------------
export async function listLogs(date = todayISO()): Promise<SupplementLog[]> {
  return selectRows<SupplementLog>("supplement_logs", {
    user_id: requireUid(),
    log_date: date,
  });
}

/** Effective servings taken for a log row (a not-taken row counts as 0). */
function effectiveCount(l: SupplementLog): number {
  return l.taken ? Math.max(0, l.count ?? 1) : 0;
}

/** Map of supplement_id → taken? for a date. */
export async function getTakenMap(date = todayISO()): Promise<Record<string, boolean>> {
  const logs = await listLogs(date);
  const map: Record<string, boolean> = {};
  for (const l of logs) map[l.supplement_id] = l.taken;
  return map;
}

/** Map of supplement_id → servings taken for a date (0 when not taken). */
export async function getCountMap(date = todayISO()): Promise<Record<string, number>> {
  const logs = await listLogs(date);
  const map: Record<string, number> = {};
  for (const l of logs) map[l.supplement_id] = effectiveCount(l);
  return map;
}

/**
 * Set how many servings of a supplement were taken on a date (upsert the row).
 * `count` is clamped to >= 0; `taken` mirrors count > 0 so adherence stays valid.
 * Returns the stored count.
 */
export async function setCount(
  supplementId: string,
  count: number,
  date = todayISO(),
): Promise<number> {
  const uid = requireUid();
  const next = Math.max(0, Math.round(count));
  const logs = await listLogs(date);
  const existing = logs.find((l) => l.supplement_id === supplementId);
  const patch = { taken: next > 0, count: next };
  if (existing) {
    await updateRow("supplement_logs", existing.id, patch);
  } else {
    await insertRow("supplement_logs", {
      user_id: uid,
      supplement_id: supplementId,
      log_date: date,
      ...patch,
    });
  }
  return next;
}

/** Toggle a supplement between 0 and 1 serving for a date. */
export async function toggleTaken(
  supplementId: string,
  date = todayISO(),
  taken?: boolean,
): Promise<boolean> {
  const logs = await listLogs(date);
  const existing = logs.find((l) => l.supplement_id === supplementId);
  const next = taken ?? !(existing?.taken ?? false);
  await setCount(supplementId, next ? 1 : 0, date);
  return next;
}

/** Macros contributed by supplements taken on a date, scaled by servings. */
export async function getSupplementMacros(date = todayISO()): Promise<Macros> {
  const [supps, counts] = await Promise.all([listSupplements(true), getCountMap(date)]);
  return supps.reduce<Macros>((t, s) => {
    const n = counts[s.id] ?? 0;
    if (n <= 0) return t;
    return {
      calories: t.calories + s.calories * n,
      protein_g: t.protein_g + s.protein_g * n,
      carbs_g: t.carbs_g + s.carbs_g * n,
      fat_g: t.fat_g + s.fat_g * n,
    };
  }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
}

// ---- Adherence --------------------------------------------------------------
export interface Adherence {
  streak: number; // consecutive days (ending today) with all active supps taken
  last7: { date: string; ratio: number }[]; // 0..1 per day, oldest→newest
}

export async function getAdherence(): Promise<Adherence> {
  const uid = requireUid();
  const active = (await listSupplements(false)).map((s) => s.id);
  const activeCount = active.length;

  // Pull the last 14 days of logs in one query, bucket by date.
  const since = isoDaysAgo(13);
  const all = await selectRows<SupplementLog>("supplement_logs", { user_id: uid });
  const recent = all.filter((l) => l.log_date >= since);
  const takenByDate = new Map<string, Set<string>>();
  for (const l of recent) {
    if (!l.taken) continue;
    const set = takenByDate.get(l.log_date) ?? new Set<string>();
    set.add(l.supplement_id);
    takenByDate.set(l.log_date, set);
  }

  const ratioFor = (date: string): number => {
    if (activeCount === 0) return 0;
    const set = takenByDate.get(date);
    if (!set) return 0;
    const hit = active.filter((id) => set.has(id)).length;
    return hit / activeCount;
  };

  const last7: { date: string; ratio: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = isoDaysAgo(i);
    last7.push({ date: d, ratio: ratioFor(d) });
  }

  // Streak: walk back from today while the day is fully adherent.
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    if (ratioFor(isoDaysAgo(i)) >= 1 && activeCount > 0) streak++;
    else break;
  }

  return { streak, last7 };
}
