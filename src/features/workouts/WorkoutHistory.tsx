import { useEffect, useState } from "react";
import type { Exercise, Workout, WorkoutSet } from "@/types";
import { useWeightUnit } from "@/features/profile/ProfileProvider";
import { EmptyState, Spinner } from "@/components/ui";
import {
  ChevronRightIcon,
  TrashIcon,
  TrophyIcon,
  DumbbellIcon,
} from "@/components/icons";
import { formatWeight, relativeDay } from "@/lib/format";
import { listWorkouts, listSets, listExercises, deleteWorkout } from "./api";
import { bestSet, setVolume, workingSets } from "./logic";

export function WorkoutHistory() {
  const unit = useWeightUnit();
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exMap, setExMap] = useState<Map<string, Exercise>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const [ws, lib] = await Promise.all([listWorkouts(100), listExercises()]);
    setWorkouts(ws.filter((w) => w.completed_at));
    setExMap(new Map(lib.map((e) => [e.id, e])));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner />;
  if (workouts.length === 0) {
    return (
      <EmptyState
        Icon={DumbbellIcon}
        title="No completed workouts yet"
        hint="Finish a session and it will show up here with your sets and PRs."
      />
    );
  }

  return (
    <div className="space-y-2">
      {workouts.map((w) => (
        <div key={w.id} className="card overflow-hidden">
          <button
            onClick={() => setOpenId((id) => (id === w.id ? null : w.id))}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div>
              <p className="font-bold">{w.name ?? "Training"}</p>
              <p className="text-xs text-muted">
                {relativeDay(w.started_at)} · {new Date(w.started_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <ChevronRightIcon
              className="h-5 w-5 text-muted transition-transform"
              style={{ transform: openId === w.id ? "rotate(90deg)" : "none" }}
            />
          </button>
          {openId === w.id && (
            <WorkoutDetail
              workout={w}
              unit={unit}
              exMap={exMap}
              onDeleted={async () => {
                setOpenId(null);
                await load();
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function WorkoutDetail({
  workout,
  unit,
  exMap,
  onDeleted,
}: {
  workout: Workout;
  unit: "kg" | "lb";
  exMap: Map<string, Exercise>;
  onDeleted: () => void;
}) {
  const [sets, setSets] = useState<WorkoutSet[] | null>(null);

  useEffect(() => {
    listSets(workout.id).then(setSets);
  }, [workout.id]);

  if (!sets) return <Spinner />;

  const byExercise = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = byExercise.get(s.exercise_id) ?? [];
    arr.push(s);
    byExercise.set(s.exercise_id, arr);
  }
  const totalVolume = sets.reduce((v, s) => v + setVolume(s.weight_kg, s.reps), 0);

  return (
    <div
      className="space-y-3 border-t p-4"
      style={{ borderColor: "var(--color-line)" }}
    >
      <p className="text-xs text-muted">
        {workingSets(sets).length} working sets · {Math.round(totalVolume).toLocaleString()}{" "}
        {unit} total volume
      </p>
      {[...byExercise.entries()].map(([exId, exSets]) => {
        const best = bestSet(exSets);
        return (
          <div key={exId}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{exMap.get(exId)?.name ?? "Exercise"}</p>
              {best && (
                <p className="text-xs text-muted">
                  best {formatWeight(best.weight_kg, unit)} × {best.reps}
                </p>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {exSets.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                  style={{
                    background: "var(--color-surface-2)",
                    opacity: s.is_warmup ? 0.6 : 1,
                  }}
                >
                  {formatWeight(s.weight_kg, unit)} × {s.reps}
                  {s.is_pr && (
                    <TrophyIcon className="h-3 w-3" style={{ color: "var(--color-accent)" }} />
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <button
        onClick={async () => {
          if (!confirm("Delete this workout and its sets?")) return;
          await deleteWorkout(workout.id);
          onDeleted();
        }}
        className="flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: "var(--color-danger-text)" }}
      >
        <TrashIcon className="h-3.5 w-3.5" /> Delete workout
      </button>
    </div>
  );
}
