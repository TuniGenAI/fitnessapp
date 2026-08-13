import { useEffect, useMemo, useState } from "react";
import type { Exercise, Program, ProgramDay, ProgramExercise } from "@/types";
import {
  Button,
  Sheet,
  Stepper,
  EmptyState,
  Spinner,
  AddButton,
} from "@/components/ui";
import {
  BackIcon,
  TrashIcon,
  DumbbellIcon,
  PlusIcon,
  CheckIcon,
} from "@/components/icons";
import { PROGRAM_TEMPLATES, type ProgramTemplate } from "./templates";
import {
  listPrograms,
  listDays,
  listProgramExercises,
  createProgram,
  createProgramFromTemplate,
  setActiveProgram,
  deleteProgram,
  addDay,
  deleteDay,
  addProgramExercise,
  updateProgramExercise,
  deleteProgramExercise,
} from "./api";
import { ExercisePicker } from "./ExercisePicker";

interface DayData {
  day: ProgramDay;
  exercises: ProgramExercise[];
}

export function ProgramBuilder({
  exercises,
  onLibraryChange,
  onBack,
}: {
  exercises: Exercise[];
  onLibraryChange: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [days, setDays] = useState<DayData[]>([]);
  const [busy, setBusy] = useState(false);

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const active = programs.find((p) => p.id === activeId) ?? null;

  async function loadProgramList(selectId?: string) {
    const list = await listPrograms();
    setPrograms(list);
    const pick = selectId ?? activeId ?? list.find((p) => p.is_active)?.id ?? list[0]?.id ?? null;
    setActiveId(pick);
    return pick;
  }

  async function loadDays(programId: string | null) {
    if (!programId) {
      setDays([]);
      return;
    }
    const ds = await listDays(programId);
    const withEx = await Promise.all(
      ds.map(async (day) => ({ day, exercises: await listProgramExercises(day.id) })),
    );
    setDays(withEx);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const pick = await loadProgramList();
      await loadDays(pick);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDays(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Exercise-target editor state
  const [picker, setPicker] = useState<{ dayId: string } | null>(null);
  const [target, setTarget] = useState<{
    dayId: string;
    exercise: Exercise;
    editing?: ProgramExercise;
  } | null>(null);

  if (loading) return <Spinner />;

  // ---- No programs yet: template gallery ------------------------------------
  if (programs.length === 0) {
    return (
      <div className="space-y-4">
        <TopBar title="Build a program" onBack={onBack} />
        <p className="text-sm text-muted">
          Start from a proven split (you can customize everything after), or build your
          own from scratch.
        </p>
        {PROGRAM_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.key}
            template={t}
            busy={busy}
            onPick={async () => {
              setBusy(true);
              try {
                const p = await createProgramFromTemplate(t);
                await loadProgramList(p.id);
              } finally {
                setBusy(false);
              }
            }}
          />
        ))}
        <Button
          variant="subtle"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const p = await createProgram("My Program");
              await loadProgramList(p.id);
            } finally {
              setBusy(false);
            }
          }}
        >
          <PlusIcon className="h-4 w-4" /> Start from scratch
        </Button>
      </div>
    );
  }

  // ---- Editing a program ----------------------------------------------------
  return (
    <div className="space-y-4">
      <TopBar title="Programs" onBack={onBack} />

      {/* Program switcher */}
      <div className="flex flex-wrap gap-1.5">
        {programs.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className="rounded-full px-3 py-1.5 text-sm font-semibold"
            style={
              p.id === activeId
                ? { background: "var(--color-brand)", color: "#fff" }
                : { background: "var(--color-surface-2)", color: "var(--color-muted)" }
            }
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={async () => {
            const p = await createProgram(`Program ${programs.length + 1}`);
            await loadProgramList(p.id);
          }}
          className="rounded-full px-3 py-1.5 text-sm font-semibold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
        >
          <PlusIcon className="inline h-3.5 w-3.5" />
        </button>
      </div>

      {active && (
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{active.name}</h2>
            {active.description && (
              <p className="text-xs text-muted">{active.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {active.is_active ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ background: "var(--color-accent)", color: "#0b0f1a" }}
              >
                Active
              </span>
            ) : (
              <button
                onClick={async () => {
                  await setActiveProgram(active.id);
                  await loadProgramList(active.id);
                }}
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
              >
                Set active
              </button>
            )}
            <button
              onClick={async () => {
                if (!confirm(`Delete "${active.name}"? This can't be undone.`)) return;
                await deleteProgram(active.id);
                const pick = await loadProgramList(
                  programs.filter((p) => p.id !== active.id)[0]?.id,
                );
                await loadDays(pick);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--color-surface-2)", color: "var(--color-protein)" }}
              aria-label="Delete program"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Days */}
      {days.length === 0 && (
        <EmptyState
          Icon={DumbbellIcon}
          title="No training days yet"
          hint="Add a day like Push, Pull, or Legs — then fill it with exercises."
        />
      )}

      {days.map(({ day, exercises: pex }) => (
        <div key={day.id} className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">{day.name}</h3>
            <button
              onClick={async () => {
                if (!confirm(`Remove "${day.name}"?`)) return;
                await deleteDay(day.id);
                await loadDays(activeId);
              }}
              className="text-xs font-semibold"
              style={{ color: "var(--color-muted)" }}
            >
              Remove
            </button>
          </div>

          {pex.length === 0 ? (
            <p className="mb-2 text-sm text-muted">No exercises yet.</p>
          ) : (
            <ul className="mb-2 space-y-1.5">
              {pex.map((x) => (
                <li key={x.id}>
                  <button
                    onClick={() => {
                      const ex = exMap.get(x.exercise_id);
                      if (ex) setTarget({ dayId: day.id, exercise: ex, editing: x });
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
                    style={{ background: "var(--color-surface-2)" }}
                  >
                    <span className="font-medium">
                      {exMap.get(x.exercise_id)?.name ?? "Exercise"}
                    </span>
                    <span className="text-sm text-muted">
                      {x.target_sets} × {x.target_reps_low}–{x.target_reps_high}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <AddButton label="Add exercise" onClick={() => setPicker({ dayId: day.id })} />
        </div>
      ))}

      <AddDay onAdd={async (name) => {
        if (!activeId) return;
        await addDay(activeId, name);
        await loadDays(activeId);
      }} />

      {/* Pickers / editors */}
      {picker && (
        <ExercisePicker
          open
          exercises={exercises}
          onClose={() => setPicker(null)}
          onCreated={onLibraryChange}
          onPick={(ex) => {
            const dayId = picker.dayId;
            setPicker(null);
            setTarget({ dayId, exercise: ex });
          }}
        />
      )}

      {target && (
        <TargetEditor
          key={target.editing?.id ?? target.exercise.id}
          exercise={target.exercise}
          editing={target.editing}
          onClose={() => setTarget(null)}
          onDelete={
            target.editing
              ? async () => {
                  await deleteProgramExercise(target.editing!.id);
                  setTarget(null);
                  await loadDays(activeId);
                }
              : undefined
          }
          onSave={async (vals) => {
            if (target.editing) {
              await updateProgramExercise(target.editing.id, {
                target_sets: vals.sets,
                target_reps_low: vals.repLow,
                target_reps_high: vals.repHigh,
              });
            } else {
              await addProgramExercise(target.dayId, target.exercise.id, vals);
            }
            setTarget(null);
            await loadDays(activeId);
          }}
        />
      )}
    </div>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: "var(--color-surface-2)" }}
        aria-label="Back"
      >
        <BackIcon className="h-5 w-5" />
      </button>
      <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
    </div>
  );
}

function TemplateCard({
  template,
  onPick,
  busy,
}: {
  template: ProgramTemplate;
  onPick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onPick}
      disabled={busy}
      className="card w-full p-4 text-left transition active:scale-[0.99] disabled:opacity-50"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{template.name}</h3>
        <span className="text-xs font-semibold text-muted">{template.days.length} days</span>
      </div>
      <p className="mt-1 text-sm text-muted">{template.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {template.days.map((d) => (
          <span
            key={d.name}
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "var(--color-surface-2)", color: "var(--color-brand-soft)" }}
          >
            {d.name}
          </span>
        ))}
      </div>
    </button>
  );
}

function AddDay({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <AddButton label="Add training day" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="New training day">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push, Pull, Legs, Upper…"
          className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
        />
        <Button
          block
          disabled={!name.trim()}
          onClick={() => {
            onAdd(name.trim());
            setName("");
            setOpen(false);
          }}
        >
          <CheckIcon className="h-4 w-4" /> Add day
        </Button>
      </Sheet>
    </>
  );
}

function TargetEditor({
  exercise,
  editing,
  onSave,
  onDelete,
  onClose,
}: {
  exercise: Exercise;
  editing?: ProgramExercise;
  onSave: (vals: { sets: number; repLow: number; repHigh: number }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [sets, setSets] = useState(editing?.target_sets ?? 3);
  const [repLow, setRepLow] = useState(editing?.target_reps_low ?? 8);
  const [repHigh, setRepHigh] = useState(editing?.target_reps_high ?? 12);

  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      <div className="space-y-4">
        <Row label="Sets">
          <Stepper value={sets} onChange={setSets} min={1} max={12} />
        </Row>
        <Row label="Rep range (low)">
          <Stepper
            value={repLow}
            onChange={(v) => {
              setRepLow(v);
              if (v > repHigh) setRepHigh(v);
            }}
            min={1}
            max={100}
          />
        </Row>
        <Row label="Rep range (high)">
          <Stepper
            value={repHigh}
            onChange={(v) => setRepHigh(Math.max(v, repLow))}
            min={1}
            max={100}
          />
        </Row>
        <div className="flex gap-2 pt-1">
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
          <Button block onClick={() => onSave({ sets, repLow, repHigh })}>
            {editing ? "Save" : "Add to day"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="w-40">{children}</div>
    </div>
  );
}
