/**
 * Client-side mirror of the seeded global exercise library
 * (`supabase/migrations/…_seed_exercises.sql`).
 *
 * Used ONLY in demo mode, where there's no backend to read the library from.
 * When signed in, the app reads these same rows from the `exercises` table.
 * Ids are stable (derived from the name) so program references survive reloads.
 */
import type { Exercise, ExerciseType } from "@/types";

/** Deterministic id for a seed exercise, e.g. "seed-ex-barbell-bench-press". */
export function seedExerciseId(name: string): string {
  return "seed-ex-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type SeedRow = [name: string, type: ExerciseType, muscle: string, secondary: string[]];

const ROWS: SeedRow[] = [
  // Chest
  ["Barbell Bench Press", "free_weight", "chest", ["triceps", "shoulders"]],
  ["Incline Barbell Bench Press", "free_weight", "chest", ["shoulders", "triceps"]],
  ["Dumbbell Bench Press", "free_weight", "chest", ["triceps", "shoulders"]],
  ["Incline Dumbbell Press", "free_weight", "chest", ["shoulders", "triceps"]],
  ["Machine Chest Press", "machine", "chest", ["triceps", "shoulders"]],
  ["Pec Deck Fly", "machine", "chest", []],
  ["Cable Fly", "cable", "chest", ["shoulders"]],
  ["Push-Up", "bodyweight", "chest", ["triceps", "shoulders"]],
  ["Dip", "bodyweight", "chest", ["triceps", "shoulders"]],
  // Back
  ["Deadlift", "free_weight", "back", ["glutes", "hamstrings", "forearms"]],
  ["Barbell Row", "free_weight", "back", ["biceps", "rear_delts"]],
  ["Dumbbell Row", "free_weight", "back", ["biceps", "rear_delts"]],
  ["Lat Pulldown", "cable", "back", ["biceps"]],
  ["Seated Cable Row", "cable", "back", ["biceps", "rear_delts"]],
  ["Machine Row", "machine", "back", ["biceps"]],
  ["Pull-Up", "bodyweight", "back", ["biceps"]],
  ["Chin-Up", "bodyweight", "back", ["biceps"]],
  ["Face Pull", "cable", "back", ["rear_delts"]],
  // Shoulders
  ["Overhead Press", "free_weight", "shoulders", ["triceps"]],
  ["Dumbbell Shoulder Press", "free_weight", "shoulders", ["triceps"]],
  ["Lateral Raise", "free_weight", "shoulders", []],
  ["Cable Lateral Raise", "cable", "shoulders", []],
  ["Rear Delt Fly", "machine", "shoulders", ["back"]],
  // Legs
  ["Barbell Back Squat", "free_weight", "legs", ["glutes", "hamstrings"]],
  ["Front Squat", "free_weight", "legs", ["glutes"]],
  ["Romanian Deadlift", "free_weight", "legs", ["hamstrings", "glutes"]],
  ["Leg Press", "machine", "legs", ["glutes"]],
  ["Leg Extension", "machine", "legs", []],
  ["Leg Curl", "machine", "legs", ["hamstrings"]],
  ["Bulgarian Split Squat", "free_weight", "legs", ["glutes"]],
  ["Walking Lunge", "free_weight", "legs", ["glutes"]],
  ["Standing Calf Raise", "machine", "legs", ["calves"]],
  ["Hip Thrust", "free_weight", "glutes", ["hamstrings"]],
  // Arms
  ["Barbell Curl", "free_weight", "biceps", ["forearms"]],
  ["Dumbbell Curl", "free_weight", "biceps", ["forearms"]],
  ["Hammer Curl", "free_weight", "biceps", ["forearms"]],
  ["Cable Curl", "cable", "biceps", ["forearms"]],
  ["Triceps Pushdown", "cable", "triceps", []],
  ["Overhead Triceps Extension", "cable", "triceps", []],
  ["Skullcrusher", "free_weight", "triceps", []],
  ["Close-Grip Bench Press", "free_weight", "triceps", ["chest", "shoulders"]],
  // Core
  ["Plank", "bodyweight", "core", []],
  ["Hanging Leg Raise", "bodyweight", "core", []],
  ["Cable Crunch", "cable", "core", []],
  ["Ab Wheel Rollout", "bodyweight", "core", []],
];

export const SEED_EXERCISES: Exercise[] = ROWS.map(([name, type, muscle, secondary]) => ({
  id: seedExerciseId(name),
  user_id: null,
  name,
  type,
  muscle_group: muscle,
  secondary_muscles: secondary,
  created_at: "2026-08-13T12:00:00.000Z",
}));
