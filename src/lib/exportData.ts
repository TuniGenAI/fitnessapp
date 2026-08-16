/**
 * Full personal-data export (ROADMAP #14). Gathers every user-owned row into one
 * JSON object and hands it back for download. Works in both modes: `selectRows`
 * reads Supabase when signed in and the local demo store otherwise, so the export
 * is your data wherever it lives. No lock-in.
 */
import { getUserId } from "./session";
import { selectRows } from "./repo";
import { todayISO } from "./format";

/** User-owned tables scoped by `user_id`. `profiles` is keyed by `id` (handled below). */
const USER_TABLES = [
  "goals",
  "programs",
  "program_days",
  "program_exercises",
  "workouts",
  "workout_sets",
  "personal_records",
  "foods",
  "meals",
  "meal_items",
  "food_logs",
  "supplements",
  "supplement_logs",
  "body_metrics",
  "coach_messages",
  "water_logs",
  "progress_photos",
] as const;

export async function exportAllData(): Promise<Record<string, unknown>> {
  const uid = getUserId();
  if (!uid) throw new Error("Not signed in");

  const out: Record<string, unknown> = {
    app: "Fitness App",
    exportedAt: new Date().toISOString(),
    userId: uid,
  };

  const profile = await selectRows("profiles", { id: uid }).catch(() => []);
  // Never include the Gemini API key in an export.
  out.profile = (profile[0] as Record<string, unknown> | undefined)
    ? (({ gemini_api_key, ...rest }) => rest)(profile[0] as Record<string, unknown>)
    : null;

  for (const table of USER_TABLES) {
    out[table] = await selectRows(table, { user_id: uid }).catch(() => []);
  }
  return out;
}

/** Trigger a client-side download of `data` as a pretty-printed JSON file. */
export function downloadJson(data: unknown, filename?: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `fitnessapp-export-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
