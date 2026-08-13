/**
 * Workouts data access — programs, the live logger, history, and PRs.
 * Thin orchestration over `@/lib/repo` (backend ↔ demo), plus the pure math in
 * `logic.ts`. Feature components call these and never touch a backend directly.
 */
import { supabase } from "@/lib/supabase";
import { getUserId, usingBackend } from "@/lib/session";
import { localDb } from "@/lib/localDb";
import {
  selectRows,
  insertRow,
  insertRows,
  updateRow,
  deleteWhere,
} from "@/lib/repo";
import type {
  Exercise,
  ExerciseType,
  Program,
  ProgramDay,
  ProgramExercise,
  Workout,
  WorkoutSet,
  PersonalRecord,
  CoachMode,
  RecordType,
} from "@/types";
import { checkPrsForSet } from "./logic";
import type { ProgramTemplate } from "./templates";

function requireUid(): string {
  const uid = getUserId();
  if (!uid) throw new Error("Not signed in");
  return uid;
}

// ---- Exercises --------------------------------------------------------------
export async function listExercises(): Promise<Exercise[]> {
  const uid = requireUid();
  let rows: Exercise[];
  if (usingBackend()) {
    const { data, error } = await supabase!
      .from("exercises")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${uid}`);
    if (error) throw error;
    rows = (data ?? []) as Exercise[];
  } else {
    rows = localDb
      .select<Exercise>("exercises")
      .filter((x) => x.user_id === null || x.user_id === uid);
  }
  return rows.sort(
    (a, b) =>
      a.muscle_group.localeCompare(b.muscle_group) || a.name.localeCompare(b.name),
  );
}

export async function createExercise(input: {
  name: string;
  type: ExerciseType;
  muscle_group: string;
  secondary_muscles?: string[];
}): Promise<Exercise> {
  const uid = requireUid();
  return insertRow<Exercise>("exercises", {
    user_id: uid,
    name: input.name.trim(),
    type: input.type,
    muscle_group: input.muscle_group,
    secondary_muscles: input.secondary_muscles ?? [],
  });
}

// ---- Programs ---------------------------------------------------------------
export async function listPrograms(): Promise<Program[]> {
  return selectRows<Program>("programs", { user_id: requireUid() }, {
    column: "created_at",
    ascending: true,
  });
}

export async function getActiveProgram(): Promise<Program | null> {
  const programs = await listPrograms();
  return programs.find((p) => p.is_active) ?? programs[0] ?? null;
}

export async function createProgram(
  name: string,
  description?: string,
): Promise<Program> {
  const uid = requireUid();
  const existing = await listPrograms();
  return insertRow<Program>("programs", {
    user_id: uid,
    name: name.trim(),
    description: description?.trim() || null,
    is_active: existing.length === 0, // first program is active by default
  });
}

export async function updateProgram(
  id: string,
  patch: { name?: string; description?: string | null; is_active?: boolean },
): Promise<Program> {
  return updateRow<Program>("programs", id, patch);
}

export async function setActiveProgram(id: string): Promise<void> {
  const programs = await listPrograms();
  await Promise.all(
    programs.map((p) =>
      p.is_active === (p.id === id)
        ? Promise.resolve()
        : updateRow("programs", p.id, { is_active: p.id === id }),
    ),
  );
}

export async function deleteProgram(id: string): Promise<void> {
  // In demo we cascade manually; the backend has ON DELETE CASCADE.
  if (!usingBackend()) {
    const days = await listDays(id);
    for (const d of days) await deleteWhere("program_exercises", { program_day_id: d.id });
    await deleteWhere("program_days", { program_id: id });
  }
  await deleteWhere("programs", { id });
}

// ---- Program days -----------------------------------------------------------
export async function listDays(programId: string): Promise<ProgramDay[]> {
  return selectRows<ProgramDay>("program_days", { program_id: programId }, {
    column: "day_order",
    ascending: true,
  });
}

export async function addDay(programId: string, name: string): Promise<ProgramDay> {
  const uid = requireUid();
  const days = await listDays(programId);
  const order = days.reduce((m, d) => Math.max(m, d.day_order), -1) + 1;
  return insertRow<ProgramDay>("program_days", {
    program_id: programId,
    user_id: uid,
    name: name.trim(),
    day_order: order,
  });
}

export async function updateDay(id: string, patch: { name?: string; day_order?: number }) {
  return updateRow<ProgramDay>("program_days", id, patch);
}

export async function deleteDay(id: string): Promise<void> {
  if (!usingBackend()) await deleteWhere("program_exercises", { program_day_id: id });
  await deleteWhere("program_days", { id });
}

// ---- Program exercises ------------------------------------------------------
export async function listProgramExercises(dayId: string): Promise<ProgramExercise[]> {
  return selectRows<ProgramExercise>(
    "program_exercises",
    { program_day_id: dayId },
    { column: "order_index", ascending: true },
  );
}

export async function addProgramExercise(
  dayId: string,
  exerciseId: string,
  targets: { sets: number; repLow: number; repHigh: number; notes?: string },
): Promise<ProgramExercise> {
  const uid = requireUid();
  const existing = await listProgramExercises(dayId);
  const order = existing.reduce((m, x) => Math.max(m, x.order_index), -1) + 1;
  return insertRow<ProgramExercise>("program_exercises", {
    program_day_id: dayId,
    user_id: uid,
    exercise_id: exerciseId,
    target_sets: targets.sets,
    target_reps_low: targets.repLow,
    target_reps_high: targets.repHigh,
    order_index: order,
    notes: targets.notes ?? null,
  });
}

export async function updateProgramExercise(
  id: string,
  patch: {
    target_sets?: number;
    target_reps_low?: number;
    target_reps_high?: number;
    order_index?: number;
    notes?: string | null;
  },
) {
  return updateRow<ProgramExercise>("program_exercises", id, patch);
}

export async function deleteProgramExercise(id: string): Promise<void> {
  await deleteWhere("program_exercises", { id });
}

export async function createProgramFromTemplate(
  template: ProgramTemplate,
): Promise<Program> {
  const uid = requireUid();
  const exercises = await listExercises();
  const byName = new Map(exercises.map((x) => [x.name.toLowerCase(), x]));

  const program = await createProgram(template.name, template.description);

  for (let di = 0; di < template.days.length; di++) {
    const td = template.days[di];
    const day = await insertRow<ProgramDay>("program_days", {
      program_id: program.id,
      user_id: uid,
      name: td.name,
      day_order: di,
    });
    const rows = td.exercises
      .map((te, i) => {
        const ex = byName.get(te.exercise.toLowerCase());
        if (!ex) return null;
        return {
          program_day_id: day.id,
          user_id: uid,
          exercise_id: ex.id,
          target_sets: te.sets,
          target_reps_low: te.repLow,
          target_reps_high: te.repHigh,
          order_index: i,
          notes: null,
        };
      })
      .filter(Boolean);
    await insertRows<ProgramExercise>("program_exercises", rows as unknown[]);
  }
  return program;
}

// ---- Workouts (the live session) -------------------------------------------
export async function listWorkouts(limit = 50): Promise<Workout[]> {
  const rows = await selectRows<Workout>("workouts", { user_id: requireUid() }, {
    column: "started_at",
    ascending: false,
  });
  return rows.slice(0, limit);
}

export async function getActiveWorkout(): Promise<Workout | null> {
  const rows = await listWorkouts();
  return rows.find((w) => !w.completed_at) ?? null;
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const rows = await selectRows<Workout>("workouts", { id });
  return rows[0] ?? null;
}

export async function startWorkout(input: {
  program_day_id?: string | null;
  name?: string | null;
  coach_mode?: CoachMode | null;
}): Promise<Workout> {
  const uid = requireUid();
  return insertRow<Workout>("workouts", {
    user_id: uid,
    program_day_id: input.program_day_id ?? null,
    name: input.name ?? null,
    coach_mode: input.coach_mode ?? null,
    started_at: new Date().toISOString(),
    completed_at: null,
    notes: null,
  });
}

export async function completeWorkout(id: string, notes?: string): Promise<Workout> {
  return updateRow<Workout>("workouts", id, {
    completed_at: new Date().toISOString(),
    ...(notes !== undefined ? { notes } : {}),
  });
}

export async function deleteWorkout(id: string): Promise<void> {
  if (!usingBackend()) await deleteWhere("workout_sets", { workout_id: id });
  await deleteWhere("workouts", { id });
}

// ---- Sets -------------------------------------------------------------------
export async function listSets(workoutId: string): Promise<WorkoutSet[]> {
  return selectRows<WorkoutSet>("workout_sets", { workout_id: workoutId }, {
    column: "logged_at",
    ascending: true,
  });
}

/** Log a set and detect PRs. Returns the set plus any celebrated PR types. */
export async function logSet(input: {
  workout_id: string;
  exercise_id: string;
  weight_kg: number;
  reps: number;
  is_warmup?: boolean;
}): Promise<{ set: WorkoutSet; celebrated: RecordType[] }> {
  const uid = requireUid();
  const existingSets = await listSets(input.workout_id);
  const sameExercise = existingSets.filter((s) => s.exercise_id === input.exercise_id);
  const setNumber = sameExercise.length + 1;

  let set = await insertRow<WorkoutSet>("workout_sets", {
    workout_id: input.workout_id,
    user_id: uid,
    exercise_id: input.exercise_id,
    set_number: setNumber,
    weight_kg: input.weight_kg,
    reps: input.reps,
    is_warmup: input.is_warmup ?? false,
    is_pr: false,
    logged_at: new Date().toISOString(),
  });

  let celebrated: RecordType[] = [];
  if (!set.is_warmup) {
    const existingPrs = await listPRs(input.exercise_id);
    const { toRecord, celebrated: won } = checkPrsForSet(
      input.weight_kg,
      input.reps,
      existingPrs,
    );
    for (const c of toRecord) {
      await insertRow<PersonalRecord>("personal_records", {
        user_id: uid,
        exercise_id: input.exercise_id,
        record_type: c.record_type,
        value: c.value,
        weight_kg: c.weight_kg,
        reps: c.reps,
        workout_set_id: set.id,
        achieved_at: new Date().toISOString(),
      });
    }
    celebrated = won;
    if (won.length > 0) {
      set = await updateRow<WorkoutSet>("workout_sets", set.id, { is_pr: true });
    }
  }

  return { set, celebrated };
}

export async function updateSet(
  id: string,
  patch: { weight_kg?: number; reps?: number; is_warmup?: boolean },
) {
  return updateRow<WorkoutSet>("workout_sets", id, patch);
}

export async function deleteSet(id: string): Promise<void> {
  await deleteWhere("workout_sets", { id });
}

// ---- "Last time" + history --------------------------------------------------
/** Sets from the most recent OTHER workout that trained this exercise. */
export async function getLastWorkoutSets(
  exerciseId: string,
  excludeWorkoutId?: string,
): Promise<WorkoutSet[]> {
  const uid = requireUid();
  const sets = await selectRows<WorkoutSet>("workout_sets", {
    user_id: uid,
    exercise_id: exerciseId,
  });
  const workouts = await listWorkouts(500);
  const startedAt = new Map(workouts.map((w) => [w.id, w.started_at]));

  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (s.workout_id === excludeWorkoutId) continue;
    const arr = byWorkout.get(s.workout_id) ?? [];
    arr.push(s);
    byWorkout.set(s.workout_id, arr);
  }
  let bestId: string | null = null;
  let bestTime = "";
  for (const wid of byWorkout.keys()) {
    const t = startedAt.get(wid) ?? "";
    if (t > bestTime) {
      bestTime = t;
      bestId = wid;
    }
  }
  return bestId ? (byWorkout.get(bestId) ?? []) : [];
}

export interface ExerciseHistoryPoint {
  workoutId: string;
  date: string;
  sets: WorkoutSet[];
}

/** Per-workout grouping of an exercise's sets, oldest→newest (for charts/history). */
export async function getExerciseHistory(
  exerciseId: string,
): Promise<ExerciseHistoryPoint[]> {
  const uid = requireUid();
  const sets = await selectRows<WorkoutSet>("workout_sets", {
    user_id: uid,
    exercise_id: exerciseId,
  });
  const workouts = await listWorkouts(500);
  const startedAt = new Map(workouts.map((w) => [w.id, w.started_at]));

  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = byWorkout.get(s.workout_id) ?? [];
    arr.push(s);
    byWorkout.set(s.workout_id, arr);
  }
  return [...byWorkout.entries()]
    .map(([workoutId, ws]) => ({
      workoutId,
      date: startedAt.get(workoutId) ?? ws[0]?.logged_at ?? "",
      sets: ws.sort((a, b) => a.set_number - b.set_number),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Personal records -------------------------------------------------------
export async function listPRs(exerciseId?: string): Promise<PersonalRecord[]> {
  const filter: Record<string, unknown> = { user_id: requireUid() };
  if (exerciseId) filter.exercise_id = exerciseId;
  return selectRows<PersonalRecord>("personal_records", filter, {
    column: "achieved_at",
    ascending: false,
  });
}

/** Best (latest, highest) PR per exercise+type — for a PR showcase. */
export async function getBestPRs(): Promise<PersonalRecord[]> {
  const all = await listPRs();
  const best = new Map<string, PersonalRecord>();
  for (const pr of all) {
    const key = `${pr.exercise_id}:${pr.record_type}`;
    const cur = best.get(key);
    if (!cur || pr.value > cur.value) best.set(key, pr);
  }
  return [...best.values()];
}
