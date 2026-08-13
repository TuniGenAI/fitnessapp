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

/** Map of supplement_id → taken? for a date. */
export async function getTakenMap(date = todayISO()): Promise<Record<string, boolean>> {
  const logs = await listLogs(date);
  const map: Record<string, boolean> = {};
  for (const l of logs) map[l.supplement_id] = l.taken;
  return map;
}

/** Toggle a supplement's taken state for a date (upsert the log row). */
export async function toggleTaken(
  supplementId: string,
  date = todayISO(),
  taken?: boolean,
): Promise<boolean> {
  const uid = requireUid();
  const logs = await listLogs(date);
  const existing = logs.find((l) => l.supplement_id === supplementId);
  const next = taken ?? !(existing?.taken ?? false);
  if (existing) {
    await updateRow("supplement_logs", existing.id, { taken: next });
  } else {
    await insertRow("supplement_logs", {
      user_id: uid,
      supplement_id: supplementId,
      log_date: date,
      taken: next,
    });
  }
  return next;
}

/** Macros contributed by supplements marked taken on a date. */
export async function getSupplementMacros(date = todayISO()): Promise<Macros> {
  const [supps, taken] = await Promise.all([listSupplements(true), getTakenMap(date)]);
  return supps.reduce<Macros>(
    (t, s) =>
      taken[s.id]
        ? {
            calories: t.calories + s.calories,
            protein_g: t.protein_g + s.protein_g,
            carbs_g: t.carbs_g + s.carbs_g,
            fat_g: t.fat_g + s.fat_g,
          }
        : t,
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
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
