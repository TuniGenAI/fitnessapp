import { useMemo, useState } from "react";
import type { Exercise, ExerciseType } from "@/types";
import { Sheet, Button, Segmented } from "@/components/ui";
import { SearchIcon, PlusIcon, EditIcon } from "@/components/icons";
import { getUserId } from "@/lib/session";
import { createExercise, updateExercise, deleteExercise } from "./api";

const MUSCLE_ORDER = [
  "chest",
  "back",
  "shoulders",
  "legs",
  "glutes",
  "biceps",
  "triceps",
  "core",
];

function title(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

type Mode =
  | { kind: "pick" }
  | { kind: "create" }
  | { kind: "edit"; exercise: Exercise };

/** Bottom-sheet picker over the exercise library, with inline custom create/edit. */
export function ExercisePicker({
  open,
  exercises,
  onPick,
  onClose,
  onCreated,
}: {
  open: boolean;
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  onCreated: () => void; // ask parent to refresh the library
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "pick" });
  const uid = getUserId();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = exercises.filter((e) => e.name.toLowerCase().includes(q));
    const byMuscle = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const arr = byMuscle.get(e.muscle_group) ?? [];
      arr.push(e);
      byMuscle.set(e.muscle_group, arr);
    }
    return [...byMuscle.entries()].sort(
      (a, b) =>
        (MUSCLE_ORDER.indexOf(a[0]) + 100) % 100 - ((MUSCLE_ORDER.indexOf(b[0]) + 100) % 100),
    );
  }, [exercises, query]);

  const title_ =
    mode.kind === "create"
      ? "New exercise"
      : mode.kind === "edit"
        ? "Edit exercise"
        : "Choose exercise";

  return (
    <Sheet open={open} onClose={onClose} title={title_}>
      {mode.kind !== "pick" ? (
        <ExerciseForm
          initialName={mode.kind === "create" ? query : mode.exercise.name}
          existing={mode.kind === "edit" ? mode.exercise : null}
          onCancel={() => setMode({ kind: "pick" })}
          onDone={async (ex) => {
            setMode({ kind: "pick" });
            onCreated();
            onPick(ex);
          }}
          onDeleted={() => {
            setMode({ kind: "pick" });
            onCreated();
          }}
        />
      ) : (
        <>
          <div
            className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--color-surface-2)" }}
          >
            <SearchIcon className="h-4 w-4 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="space-y-4">
            {groups.map(([muscle, list]) => (
              <div key={muscle}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  {title(muscle)}
                </p>
                <div className="space-y-1.5">
                  {list.map((ex) => {
                    const custom = !!ex.user_id && ex.user_id === uid;
                    return (
                      <div
                        key={ex.id}
                        className="flex items-center rounded-xl"
                        style={{ background: "var(--color-surface-2)" }}
                      >
                        <button
                          onClick={() => onPick(ex)}
                          className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-left"
                        >
                          <span className="truncate font-medium">{ex.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted">
                            {title(ex.type)}
                          </span>
                        </button>
                        {custom && (
                          <button
                            onClick={() => setMode({ kind: "edit", exercise: ex })}
                            className="px-3 py-2.5 text-muted"
                            aria-label={`Edit ${ex.name}`}
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="subtle"
            block
            className="mt-4"
            style={{ color: "var(--color-brand)" }}
            onClick={() => setMode({ kind: "create" })}
          >
            <PlusIcon className="h-4 w-4" />
            {query ? `Create "${query}"` : "Create custom exercise"}
          </Button>
        </>
      )}
    </Sheet>
  );
}

const TYPES: { value: ExerciseType; label: string }[] = [
  { value: "free_weight", label: "Free" },
  { value: "machine", label: "Machine" },
  { value: "cable", label: "Cable" },
  { value: "bodyweight", label: "Body" },
];

function ExerciseForm({
  initialName,
  existing,
  onCancel,
  onDone,
  onDeleted,
}: {
  initialName: string;
  existing: Exercise | null;
  onCancel: () => void;
  onDone: (ex: Exercise) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<ExerciseType>(existing?.type ?? "free_weight");
  const [muscle, setMuscle] = useState(existing?.muscle_group ?? "chest");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!existing) return;
    if (!confirm(`Delete "${existing.name}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteExercise(existing.id);
      onDeleted();
    } catch {
      setError("Can't delete. This exercise is used in a program or logged set.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--color-surface-2)" }}
      />
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Type</p>
        <Segmented options={TYPES} value={type} onChange={setType} />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Muscle group</p>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMuscle(m)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={
                m === muscle
                  ? { background: "var(--color-brand)", color: "#fff" }
                  : { background: "var(--color-surface-2)", color: "var(--color-muted)" }
              }
            >
              {title(m)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold" style={{ color: "var(--color-flame)" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          block
          disabled={!name.trim() || saving || deleting}
          onClick={async () => {
            setSaving(true);
            try {
              const ex = existing
                ? await updateExercise(existing.id, { name, type, muscle_group: muscle })
                : await createExercise({
                    name,
                    type,
                    muscle_group: muscle,
                    secondary_muscles: [],
                  });
              onDone(ex);
            } finally {
              setSaving(false);
            }
          }}
        >
          {existing ? "Save changes" : "Add exercise"}
        </Button>
      </div>

      {existing && (
        <Button
          variant="ghost"
          block
          disabled={saving || deleting}
          style={{ color: "var(--color-flame)" }}
          onClick={remove}
        >
          Delete exercise
        </Button>
      )}
    </div>
  );
}
