import { useMemo, useState } from "react";
import type { Exercise, ExerciseType } from "@/types";
import { Sheet, Button, Segmented } from "@/components/ui";
import { SearchIcon, PlusIcon } from "@/components/icons";
import { createExercise } from "./api";

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

/** Bottom-sheet picker over the exercise library, with inline custom-create. */
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
  const [creating, setCreating] = useState(false);

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

  return (
    <Sheet open={open} onClose={onClose} title={creating ? "New exercise" : "Choose exercise"}>
      {creating ? (
        <CreateExercise
          initialName={query}
          onCancel={() => setCreating(false)}
          onDone={async (ex) => {
            setCreating(false);
            onCreated();
            onPick(ex);
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
                  {list.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => onPick(ex)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
                      style={{ background: "var(--color-surface-2)" }}
                    >
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-xs text-muted">{title(ex.type)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="subtle"
            block
            className="mt-4"
            style={{ color: "var(--color-brand)" }}
            onClick={() => setCreating(true)}
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

function CreateExercise({
  initialName,
  onCancel,
  onDone,
}: {
  initialName: string;
  onCancel: () => void;
  onDone: (ex: Exercise) => void;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<ExerciseType>("free_weight");
  const [muscle, setMuscle] = useState("chest");
  const [saving, setSaving] = useState(false);

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
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          block
          disabled={!name.trim() || saving}
          onClick={async () => {
            setSaving(true);
            try {
              const ex = await createExercise({
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
          Add exercise
        </Button>
      </div>
    </div>
  );
}
