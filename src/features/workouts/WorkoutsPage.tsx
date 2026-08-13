import { useCallback, useEffect, useState } from "react";
import type { Exercise, Program, ProgramDay, Workout } from "@/types";
import { PageHeader, Button, Segmented, Spinner, EmptyState } from "@/components/ui";
import { DumbbellIcon, ListIcon, PlusIcon } from "@/components/icons";
import {
  getActiveWorkout,
  getActiveProgram,
  listDays,
  listProgramExercises,
  listExercises,
  startWorkout,
} from "./api";
import { ProgramBuilder } from "./ProgramBuilder";
import { WorkoutLogger } from "./WorkoutLogger";
import { WorkoutHistory } from "./WorkoutHistory";
import { ExerciseProgress } from "./ExerciseProgress";

type Tab = "plan" | "history" | "progress";

interface DaySummary {
  day: ProgramDay;
  exerciseNames: string[];
}

export function WorkoutsPage() {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Workout | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [tab, setTab] = useState<Tab>("plan");
  const [building, setBuilding] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [act, prog, lib] = await Promise.all([
      getActiveWorkout(),
      getActiveProgram(),
      listExercises(),
    ]);
    const libMap = new Map(lib.map((e) => [e.id, e]));
    let summaries: DaySummary[] = [];
    if (prog) {
      const ds = await listDays(prog.id);
      summaries = await Promise.all(
        ds.map(async (day) => {
          const pex = await listProgramExercises(day.id);
          return {
            day,
            exerciseNames: pex
              .map((p) => libMap.get(p.exercise_id)?.name)
              .filter(Boolean) as string[],
          };
        }),
      );
    }
    setActive(act);
    setProgram(prog);
    setDays(summaries);
    setLibrary(lib);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- Live workout takes over the whole screen ---
  if (active) {
    return <WorkoutLogger workout={active} onExit={load} />;
  }

  if (building) {
    return (
      <ProgramBuilder
        exercises={library}
        onLibraryChange={load}
        onBack={async () => {
          setBuilding(false);
          await load();
        }}
      />
    );
  }

  async function start(input: { program_day_id?: string; name: string }) {
    setStarting(true);
    try {
      const w = await startWorkout(input);
      setActive(w);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Train"
        Icon={DumbbellIcon}
        action={
          <button
            onClick={() => setBuilding(true)}
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
            style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
          >
            <ListIcon className="h-4 w-4" /> Programs
          </button>
        }
      />

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "plan", label: "Plan" },
          { value: "history", label: "History" },
          { value: "progress", label: "Progress" },
        ]}
      />

      {loading ? (
        <Spinner />
      ) : tab === "plan" ? (
        <PlanTab
          program={program}
          days={days}
          starting={starting}
          onBuild={() => setBuilding(true)}
          onStartDay={(d) => start({ program_day_id: d.id, name: d.name })}
          onQuickStart={() => start({ name: "Quick workout" })}
        />
      ) : tab === "history" ? (
        <WorkoutHistory />
      ) : (
        <ExerciseProgress />
      )}
    </div>
  );
}

function PlanTab({
  program,
  days,
  starting,
  onBuild,
  onStartDay,
  onQuickStart,
}: {
  program: Program | null;
  days: DaySummary[];
  starting: boolean;
  onBuild: () => void;
  onStartDay: (day: ProgramDay) => void;
  onQuickStart: () => void;
}) {
  return (
    <div className="space-y-4">
      {!program || days.length === 0 ? (
        <EmptyState
          Icon={DumbbellIcon}
          title={program ? "This program has no days yet" : "No program yet"}
          hint="Pick a template (Push/Pull/Legs, Upper/Lower, Full Body) or build your own."
          action={
            <Button onClick={onBuild}>
              <PlusIcon className="h-4 w-4" /> Build a program
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            Program: <span className="font-semibold text-[color:var(--color-brand-soft)]">{program.name}</span>
          </p>
          {days.map(({ day, exerciseNames }) => (
            <div key={day.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold">{day.name}</h3>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {exerciseNames.length ? exerciseNames.join(" · ") : "No exercises"}
                  </p>
                </div>
              </div>
              <Button
                block
                className="mt-3"
                disabled={starting || exerciseNames.length === 0}
                onClick={() => onStartDay(day)}
              >
                Start {day.name}
              </Button>
            </div>
          ))}
        </>
      )}

      <Button variant="subtle" block disabled={starting} onClick={onQuickStart}>
        <PlusIcon className="h-4 w-4" /> Start an empty workout
      </Button>
    </div>
  );
}
