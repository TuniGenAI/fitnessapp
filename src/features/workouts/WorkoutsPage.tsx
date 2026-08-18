import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { Exercise, Program, ProgramDay, Workout } from "@/types";
import { PageHeader, Button, Segmented, Spinner, EmptyState, DateNav } from "@/components/ui";
import { Photo } from "@/components/Photo";
import { heroImage } from "@/lib/images";
import { withTimeout } from "@/lib/async";
import { DumbbellIcon, ListIcon, PlusIcon } from "@/components/icons";
import { todayISO, friendlyDate } from "@/lib/format";
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

// Charts pull in recharts — load that chunk only when the Progress tab opens.
const ExerciseProgress = lazy(() =>
  import("./ExerciseProgress").then((m) => ({ default: m.ExerciseProgress })),
);

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
  const [date, setDate] = useState(todayISO());

  const load = useCallback(async () => {
    setLoading(true);
    // Safety net so a stalled/failed request can never hang the spinner.
    const safety = setTimeout(() => setLoading(false), 6000);
    try {
      const [act, prog, lib] = await Promise.all([
        withTimeout(getActiveWorkout()),
        withTimeout(getActiveProgram()),
        withTimeout(listExercises()),
      ]);
      const libMap = new Map(lib.map((e) => [e.id, e]));
      let summaries: DaySummary[] = [];
      if (prog) {
        const ds = await withTimeout(listDays(prog.id));
        summaries = await Promise.all(
          ds.map(async (day) => {
            const pex = await withTimeout(listProgramExercises(day.id));
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
    } catch {
      /* keep whatever loaded; the finally clears the spinner */
    } finally {
      clearTimeout(safety);
      setLoading(false);
    }
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
      const w = await startWorkout({ ...input, date });
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
          date={date}
          onDateChange={setDate}
          onBuild={() => setBuilding(true)}
          onStartDay={(d) => start({ program_day_id: d.id, name: d.name })}
          onQuickStart={() => start({ name: "Quick workout" })}
        />
      ) : tab === "history" ? (
        <WorkoutHistory />
      ) : (
        <Suspense fallback={<Spinner />}>
          <ExerciseProgress />
        </Suspense>
      )}
    </div>
  );
}

function PlanTab({
  program,
  days,
  starting,
  date,
  onDateChange,
  onBuild,
  onStartDay,
  onQuickStart,
}: {
  program: Program | null;
  days: DaySummary[];
  starting: boolean;
  date: string;
  onDateChange: (d: string) => void;
  onBuild: () => void;
  onStartDay: (day: ProgramDay) => void;
  onQuickStart: () => void;
}) {
  const isToday = date === todayISO();
  return (
    <div className="space-y-4">
      <DateNav date={date} onChange={onDateChange} />
      {!isToday && (
        <p
          className="rounded-xl px-3 py-2 text-center text-xs font-semibold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
        >
          Logging this session for {friendlyDate(date)}
        </p>
      )}
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
            <div key={day.id} className="card overflow-hidden">
              <div className="flex items-stretch gap-4">
                <Photo
                  src={heroImage(day.name, 300)}
                  alt=""
                  scrim="bottom"
                  className="w-24 shrink-0 self-stretch"
                />
                <div className="min-w-0 flex-1 py-4 pr-4">
                  <h3 className="font-display font-bold">{day.name}</h3>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {exerciseNames.length ? exerciseNames.join(" · ") : "No exercises"}
                  </p>
                  <Button
                    block
                    className="mt-3"
                    disabled={starting || exerciseNames.length === 0}
                    onClick={() => onStartDay(day)}
                  >
                    Start {day.name}
                  </Button>
                </div>
              </div>
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
