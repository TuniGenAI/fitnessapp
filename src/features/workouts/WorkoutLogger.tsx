import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Exercise,
  Workout,
  WorkoutSet,
  ProgramExercise,
  RecordType,
} from "@/types";
import { useProfile, useWeightUnit } from "@/features/profile/ProfileProvider";
import { Button, Stepper, Spinner, AddButton, Sheet } from "@/components/ui";
import { TrophyIcon, TrashIcon, CheckIcon, DumbbellIcon } from "@/components/icons";
import {
  toDisplayWeight,
  fromDisplayWeight,
  weightIncrementKg,
  formatWeight,
  trim,
} from "@/lib/format";
import { celebrate } from "@/lib/celebrate";
import {
  listExercises,
  listProgramExercises,
  listSets,
  getLastWorkoutSets,
  logSet,
  deleteSet,
  completeWorkout,
} from "./api";
import {
  bestSet,
  suggestNextTarget,
  workingSets,
  setVolume,
  estimatedOneRepMax,
  prTypeLabel,
  type TargetSuggestion,
} from "./logic";
import { ExercisePicker } from "./ExercisePicker";
import { getRecap, saveCoachMessage } from "@/features/coach/api";
import { reactionForSet } from "@/features/coach/logic";

interface Entry {
  exercise: Exercise;
  target?: ProgramExercise;
  sets: WorkoutSet[];
  last: WorkoutSet[];
  suggestion: TargetSuggestion | null;
}

export function WorkoutLogger({
  workout,
  onExit,
}: {
  workout: Workout;
  onExit: () => void;
}) {
  const unit = useWeightUnit();
  const { profile } = useProfile();
  const coachEnabled = profile?.coach_enabled ?? true;
  const reactionsMode = (profile?.coach_mode ?? "recap") === "reactions";
  const [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]); // ad-hoc added exercises
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recap, setRecap] = useState<{ text: string; ai: boolean } | null>(null);
  const [finishing, setFinishing] = useState(false);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    const lib = await listExercises();
    const libMap = new Map(lib.map((e) => [e.id, e]));

    const planned = workout.program_day_id
      ? await listProgramExercises(workout.program_day_id)
      : [];
    const sets = await listSets(workout.id);

    // Session exercise order: planned first, then ad-hoc extras, then any
    // logged-but-unplanned exercises.
    const order: { id: string; target?: ProgramExercise }[] = [];
    const seen = new Set<string>();
    for (const p of planned) {
      order.push({ id: p.exercise_id, target: p });
      seen.add(p.exercise_id);
    }
    for (const id of extraIds) {
      if (!seen.has(id)) {
        order.push({ id });
        seen.add(id);
      }
    }
    for (const s of sets) {
      if (!seen.has(s.exercise_id)) {
        order.push({ id: s.exercise_id });
        seen.add(s.exercise_id);
      }
    }

    const built = await Promise.all(
      order.map(async ({ id, target }) => {
        const exercise = libMap.get(id);
        if (!exercise) return null;
        const exSets = sets.filter((s) => s.exercise_id === id);
        const last = await getLastWorkoutSets(id, workout.id);
        const suggestion = suggestNextTarget(
          last,
          target?.target_reps_low ?? 8,
          target?.target_reps_high ?? 12,
          unit,
        );
        return { exercise, target, sets: exSets, last, suggestion } as Entry;
      }),
    );
    setLibrary(lib);
    setEntries(built.filter(Boolean) as Entry[]);
    setLoading(false);
  }, [workout, extraIds, unit]);

  useEffect(() => {
    load();
  }, [load]);

  async function onLog(entry: Entry, weightKg: number, reps: number, warmup: boolean) {
    const { celebrated } = await logSet({
      workout_id: workout.id,
      exercise_id: entry.exercise.id,
      weight_kg: weightKg,
      reps,
      is_warmup: warmup,
    });
    if (celebrated.length > 0) {
      celebrate();
      flashToast(celebrated.map((c: RecordType) => `🏆 ${prTypeLabel(c)} PR!`).join("  "));
    } else if (coachEnabled && reactionsMode && !warmup) {
      const prev = bestSet(entry.last);
      const beatLastTime = prev
        ? estimatedOneRepMax(weightKg, reps) > estimatedOneRepMax(prev.weight_kg, prev.reps)
        : false;
      flashToast(
        reactionForSet({
          isPr: false,
          beatLastTime,
          reps,
          targetHigh: entry.target?.target_reps_high,
        }),
      );
    }
    await load();
  }

  async function finishWorkout() {
    setFinishing(true);
    const allSets = entries.flatMap((e) => e.sets);
    const working = allSets.filter((s) => !s.is_warmup);
    const totalVolumeKg = working.reduce((v, s) => v + setVolume(s.weight_kg, s.reps), 0);
    const prCount = allSets.filter((s) => s.is_pr).length;
    let top: { name: string; best: string } | undefined;
    let topScore = 0;
    for (const e of entries) {
      const b = bestSet(e.sets);
      if (b && estimatedOneRepMax(b.weight_kg, b.reps) > topScore) {
        topScore = estimatedOneRepMax(b.weight_kg, b.reps);
        top = { name: e.exercise.name, best: `${formatWeight(b.weight_kg, unit)} × ${b.reps}` };
      }
    }
    const result = await getRecap(
      {
        dayName: workout.name ?? "Training",
        workingSets: working.length,
        totalVolumeKg,
        prCount,
        topExercise: top,
      },
      coachEnabled,
    );
    await saveCoachMessage("recap", result.text, workout.id);
    setRecap(result);
    setFinishing(false);
  }

  const totalSets = entries.reduce((n, e) => n + workingSets(e.sets).length, 0);

  return (
    <div className="space-y-4">
      <SessionHeader
        workout={workout}
        totalSets={totalSets}
        finishing={finishing}
        onFinish={finishWorkout}
      />

      {loading ? (
        <Spinner />
      ) : (
        <>
          {entries.map((e) => (
            <ExerciseLogCard
              key={e.exercise.id}
              entry={e}
              unit={unit}
              onLog={(w, r, warm) => onLog(e, w, r, warm)}
              onDeleteSet={async (id) => {
                await deleteSet(id);
                await load();
              }}
            />
          ))}

          <AddButton label="Add exercise" onClick={() => setPicking(true)} />
        </>
      )}

      {picking && (
        <ExercisePicker
          open
          exercises={library}
          onClose={() => setPicking(false)}
          onCreated={load}
          onPick={(ex) => {
            setPicking(false);
            setExtraIds((prev) => (prev.includes(ex.id) ? prev : [...prev, ex.id]));
          }}
        />
      )}

      {recap && (
        <Sheet
          open
          onClose={async () => {
            await completeWorkout(workout.id);
            onExit();
          }}
          title="Workout complete 🎉"
        >
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ background: "var(--color-surface-2)" }}
          >
            <TrophyIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--color-accent)" }} />
            <p className="text-sm leading-relaxed">
              <span className="font-bold" style={{ color: "var(--color-brand-soft)" }}>
                Coach{recap.ai ? "" : " (rule-based)"}:
              </span>{" "}
              {recap.text}
            </p>
          </div>
          <Button
            block
            className="mt-4"
            onClick={async () => {
              await completeWorkout(workout.id);
              onExit();
            }}
          >
            Done
          </Button>
        </Sheet>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div
            className="rounded-full px-5 py-3 text-sm font-bold shadow-lg"
            style={{ background: "var(--color-accent)", color: "#0b0f1a" }}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionHeader({
  workout,
  totalSets,
  finishing,
  onFinish,
}: {
  workout: Workout;
  totalSets: number;
  finishing: boolean;
  onFinish: () => void;
}) {
  const elapsed = useElapsed(workout.started_at);
  return (
    <div
      className="rounded-[var(--radius-card)] p-4 text-white"
      style={{
        background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Workout in progress
          </p>
          <h1 className="mt-0.5 text-xl font-bold">{workout.name ?? "Training"}</h1>
          <p className="mt-1 text-sm opacity-90">
            {elapsed} · {totalSets} working {totalSets === 1 ? "set" : "sets"}
          </p>
        </div>
        <DumbbellIcon className="h-7 w-7 opacity-90" />
      </div>
      <button
        onClick={onFinish}
        disabled={finishing}
        className="mt-3 w-full rounded-xl bg-white/95 py-2.5 font-bold text-[color:var(--color-brand-strong)] transition active:scale-[0.98] disabled:opacity-70"
      >
        {finishing ? "Wrapping up…" : "Finish workout"}
      </button>
    </div>
  );
}

function ExerciseLogCard({
  entry,
  unit,
  onLog,
  onDeleteSet,
}: {
  entry: Entry;
  unit: "kg" | "lb";
  onLog: (weightKg: number, reps: number, warmup: boolean) => void;
  onDeleteSet: (id: string) => void;
}) {
  const { exercise, target, sets, last, suggestion } = entry;
  const inc = weightIncrementKg(unit);

  // Draft prefilled from suggestion → last best → target midpoint.
  const initial = useMemo(() => {
    if (suggestion) {
      return { weight: toDisplayWeight(suggestion.weightKg, unit), reps: suggestion.reps };
    }
    const b = bestSet(last);
    if (b) return { weight: toDisplayWeight(b.weight_kg, unit), reps: b.reps };
    const midReps = target
      ? Math.round((target.target_reps_low + target.target_reps_high) / 2)
      : 10;
    return { weight: unit === "lb" ? 45 : 20, reps: midReps };
  }, [suggestion, last, target, unit]);

  const [weight, setWeight] = useState(initial.weight);
  const [reps, setReps] = useState(initial.reps);
  const [warmup, setWarmup] = useState(false);

  const lastBest = bestSet(last);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold">{exercise.name}</h3>
          {target && (
            <p className="text-xs text-muted">
              Target {target.target_sets} × {target.target_reps_low}–
              {target.target_reps_high}
            </p>
          )}
        </div>
        {lastBest && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted">Last time</p>
            <p className="text-sm font-semibold">
              {formatWeight(lastBest.weight_kg, unit)} × {lastBest.reps}
            </p>
          </div>
        )}
      </div>

      {suggestion && (
        <div
          className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "var(--color-surface-2)" }}
        >
          <TrophyIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
          <span>
            <span className="font-bold" style={{ color: "var(--color-brand-soft)" }}>
              Suggested: {formatWeight(suggestion.weightKg, unit)} × {suggestion.reps}
            </span>{" "}
            — {suggestion.reason}
          </span>
        </div>
      )}

      {/* Logged sets */}
      {sets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {sets.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--color-surface-2)" }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: s.is_warmup ? "var(--color-line)" : "var(--color-brand)",
                    color: "#fff",
                  }}
                >
                  {s.is_warmup ? "W" : i + 1}
                </span>
                <span className="font-medium">
                  {formatWeight(s.weight_kg, unit)} × {s.reps}
                </span>
                {s.is_pr && (
                  <TrophyIcon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                )}
              </span>
              <button
                onClick={() => onDeleteSet(s.id)}
                className="text-muted"
                aria-label="Delete set"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Input row */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Weight ({unit})</p>
          <Stepper
            value={weight}
            onChange={setWeight}
            step={toDisplayWeight(inc, unit)}
            min={0}
            decimals={2}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Reps</p>
          <Stepper value={reps} onChange={setReps} step={1} min={0} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setWarmup((w) => !w)}
          className="rounded-lg px-3 py-2 text-xs font-semibold"
          style={{
            background: warmup ? "var(--color-brand)" : "var(--color-surface-2)",
            color: warmup ? "#fff" : "var(--color-muted)",
          }}
        >
          Warm-up
        </button>
        <Button
          block
          variant="accent"
          onClick={() => onLog(fromDisplayWeight(weight, unit), reps, warmup)}
        >
          <CheckIcon className="h-4 w-4" /> Log set {trim(weight)}
          {unit} × {reps}
        </Button>
      </div>
    </div>
  );
}

function useElapsed(startISO: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(startISO).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
