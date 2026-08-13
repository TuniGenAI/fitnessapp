/**
 * Local, no-backend table store used in DEMO mode.
 *
 * It mimics just enough of Supabase's table semantics (insert / update / delete
 * / filtered select) for the feature apis to share one code shape. Each "table"
 * is a JSON array in localStorage under `fitnessapp.db.<table>`.
 *
 * Seeding mirrors the server's new-user behavior: the global exercise library is
 * always available, and a demo user's supplements / goals / profile are created
 * on first read — the same rows the DB's `handle_new_user` trigger would make.
 */
import { SEED_EXERCISES } from "@/data/seedExercises";
import { SEED_SUPPLEMENTS } from "@/data/seedSupplements";
import { DEMO_USER_ID } from "./session";
import { uuid } from "./format";

type Row = Record<string, unknown> & { id: string };

const PREFIX = "fitnessapp.db.";

function keyFor(table: string): string {
  return PREFIX + table;
}

function readTable<T extends Row>(table: string): T[] {
  try {
    const raw = localStorage.getItem(keyFor(table));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeTable<T extends Row>(table: string, rows: T[]): void {
  localStorage.setItem(keyFor(table), JSON.stringify(rows));
}

// ---- One-time seeding -------------------------------------------------------
const SEEDED_FLAG = "fitnessapp.db.__seeded";

function ensureSeeded(): void {
  if (localStorage.getItem(SEEDED_FLAG) === "1") return;

  // Global exercise library.
  writeTable("exercises", SEED_EXERCISES as unknown as Row[]);

  // Demo user's personal supplement stack (what the new-user trigger copies).
  const now = new Date().toISOString();
  const supps = SEED_SUPPLEMENTS.map((s) => ({
    id: uuid(),
    user_id: DEMO_USER_ID,
    name: s.name,
    serving_label: s.serving_label,
    category: s.category,
    calories: s.calories,
    protein_g: s.protein_g,
    carbs_g: s.carbs_g,
    fat_g: s.fat_g,
    is_active: true,
    sort_order: s.sort_order,
    created_at: now,
  }));
  writeTable("supplements", supps as unknown as Row[]);

  // Empty goals row with sensible water default (mirrors the trigger).
  writeTable("goals", [
    {
      id: uuid(),
      user_id: DEMO_USER_ID,
      goal_type: null,
      source: "manual",
      calorie_target: null,
      protein_target_g: null,
      carbs_target_g: null,
      fat_target_g: null,
      water_target_ml: 3000,
      calorie_target_rest: null,
      protein_target_rest_g: null,
      carbs_target_rest_g: null,
      fat_target_rest_g: null,
      created_at: now,
      updated_at: now,
    },
  ] as unknown as Row[]);

  writeTable("profiles", [
    {
      id: DEMO_USER_ID,
      display_name: "Demo athlete",
      avatar_url: null,
      weight_unit: "kg",
      volume_unit: "ml",
      coach_mode: "recap",
      coach_enabled: true,
      gemini_api_key: null,
      onboarded: false,
      created_at: now,
      updated_at: now,
    },
  ] as unknown as Row[]);

  localStorage.setItem(SEEDED_FLAG, "1");
}

/** Wipe all demo data (used by "Exit demo" / a reset). */
export function resetLocalDb(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
  }
  localStorage.removeItem(SEEDED_FLAG);
}

type Filter = Record<string, unknown>;

function matches(row: Row, filter?: Filter): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) => row[k] === v);
}

export const localDb = {
  /** All rows in a table matching an optional equality filter. */
  select<T extends Row>(table: string, filter?: Filter): T[] {
    ensureSeeded();
    return readTable<T>(table).filter((r) => matches(r, filter));
  },

  /** First matching row, or null. */
  first<T extends Row>(table: string, filter?: Filter): T | null {
    return this.select<T>(table, filter)[0] ?? null;
  },

  /** Insert a row; fills in id + created_at/updated_at if the columns are absent. */
  insert<T extends Row>(table: string, row: Partial<T>): T {
    ensureSeeded();
    const rows = readTable<T>(table);
    const now = new Date().toISOString();
    const complete = {
      id: (row.id as string | undefined) ?? uuid(),
      ...("created_at" in row ? {} : { created_at: now }),
      ...row,
    } as T;
    rows.push(complete);
    writeTable(table, rows);
    return complete;
  },

  /** Patch a row by id and return the updated row (or null if missing). */
  update<T extends Row>(table: string, id: string, patch: Partial<T>): T | null {
    ensureSeeded();
    const rows = readTable<T>(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
    writeTable(table, rows);
    return rows[idx];
  },

  /** Delete rows matching a filter; returns the count removed. */
  delete(table: string, filter: Filter): number {
    ensureSeeded();
    const rows = readTable<Row>(table);
    const keep = rows.filter((r) => !matches(r, filter));
    writeTable(table, keep);
    return rows.length - keep.length;
  },
};
