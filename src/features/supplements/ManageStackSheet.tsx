import { useEffect, useState } from "react";
import type { Supplement } from "@/types";
import { Sheet, Button, Stepper, Spinner } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import {
  listSupplements,
  createSupplement,
  updateSupplement,
  deleteSupplement,
} from "./api";

/** Add / edit / remove the once-a-day supplement stack. */
export function ManageStackSheet({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange: () => void;
}) {
  const [supps, setSupps] = useState<Supplement[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setSupps(await listSupplements(true));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <Sheet open={open} onClose={onClose} title="Manage stack">
      {!supps ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {supps.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "var(--color-surface-2)", opacity: s.is_active ? 1 : 0.55 }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted">
                  {s.serving_label ?? "1 serving"}
                  {s.protein_g > 0 ? ` · +${s.protein_g}g protein` : ""}
                  {s.calories > 0 ? ` · ${s.calories} kcal` : ""}
                </p>
              </div>
              <button
                onClick={async () => {
                  await updateSupplement(s.id, { is_active: !s.is_active });
                  await load();
                  onChange();
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold"
                style={{
                  background: "var(--color-surface)",
                  color: s.is_active ? "var(--color-accent)" : "var(--color-muted)",
                }}
              >
                {s.is_active ? "Active" : "Off"}
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${s.name}?`)) return;
                  await deleteSupplement(s.id);
                  await load();
                  onChange();
                }}
                className="text-muted"
                aria-label="Delete supplement"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}

          {adding ? (
            <AddSupplement
              onCancel={() => setAdding(false)}
              onAdded={async () => {
                setAdding(false);
                await load();
                onChange();
              }}
            />
          ) : (
            <Button
              variant="subtle"
              block
              className="mt-2"
              style={{ color: "var(--color-brand)" }}
              onClick={() => setAdding(true)}
            >
              <PlusIcon className="h-4 w-4" /> Add supplement
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function AddSupplement({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [protein, setProtein] = useState(0);
  const [calories, setCalories] = useState(0);
  const [saving, setSaving] = useState(false);

  return (
    <div className="card-2 space-y-3 p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Supplement name"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--color-surface)" }}
      />
      <input
        value={serving}
        onChange={(e) => setServing(e.target.value)}
        placeholder="Serving (e.g. 1 scoop, 5 g)"
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--color-surface)" }}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Protein (g)</p>
          <Stepper value={protein} onChange={setProtein} step={1} min={0} />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Calories</p>
          <Stepper value={calories} onChange={setCalories} step={5} min={0} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          block
          disabled={!name.trim() || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await createSupplement({
                name,
                serving_label: serving || null,
                protein_g: protein,
                calories,
              });
              onAdded();
            } finally {
              setSaving(false);
            }
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
