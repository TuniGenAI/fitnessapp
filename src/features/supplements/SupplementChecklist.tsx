import { useCallback, useEffect, useState } from "react";
import type { Supplement } from "@/types";
import { Spinner } from "@/components/ui";
import { PillIcon, FlameIcon, CheckIcon } from "@/components/icons";
import { todayISO } from "@/lib/format";
import {
  listSupplements,
  getTakenMap,
  toggleTaken,
  getAdherence,
} from "./api";
import { ManageStackSheet } from "./ManageStackSheet";

/**
 * Dashboard supplement checklist — tick the once-a-day stack, see the streak,
 * and manage the stack. Calls `onChange` after a toggle so a parent can refresh
 * macro totals (checked protein powder feeds the day's protein).
 */
export function SupplementChecklist({
  date = todayISO(),
  onChange,
}: {
  date?: string;
  onChange?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [supps, setSupps] = useState<Supplement[]>([]);
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [streak, setStreak] = useState(0);
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    const [list, map, adherence] = await Promise.all([
      listSupplements(false),
      getTakenMap(date),
      getAdherence(),
    ]);
    setSupps(list);
    setTaken(map);
    setStreak(adherence.streak);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(id: string) {
    const next = !taken[id];
    setTaken((t) => ({ ...t, [id]: next })); // optimistic
    await toggleTaken(id, date, next);
    onChange?.();
    // refresh streak in the background
    getAdherence().then((a) => setStreak(a.streak));
  }

  const doneCount = supps.filter((s) => taken[s.id]).length;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <PillIcon className="h-4 w-4" style={{ color: "var(--color-fat)" }} /> Supplements
        </h2>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: "var(--color-surface-2)", color: "var(--color-flame)" }}
            >
              <FlameIcon className="h-3.5 w-3.5" />
              {streak}d
            </span>
          )}
          <span className="text-sm text-muted">
            {doneCount} / {supps.length}
          </span>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : supps.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No supplements in your stack.{" "}
          <button
            onClick={() => setManaging(true)}
            className="font-semibold"
            style={{ color: "var(--color-brand)" }}
          >
            Add some
          </button>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {supps.map((s) => {
            const done = taken[s.id];
            return (
              <li key={s.id}>
                <button
                  onClick={() => toggle(s.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                  style={{ background: "var(--color-surface-2)" }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: done ? "var(--color-accent)" : "var(--color-line)",
                      background: done ? "var(--color-accent)" : "transparent",
                      color: "#0b0f1a",
                    }}
                  >
                    {done && <CheckIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={done ? "text-muted line-through" : ""}>{s.name}</span>
                    {(s.protein_g > 0 || s.calories > 0) && (
                      <span className="ml-1 text-xs text-muted">
                        {s.protein_g > 0 ? `+${s.protein_g}g protein` : `+${s.calories} kcal`}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setManaging(true)}
        className="mt-3 w-full text-center text-xs font-semibold text-muted"
      >
        Manage stack
      </button>

      {managing && (
        <ManageStackSheet
          open
          onClose={() => setManaging(false)}
          onChange={async () => {
            await load();
            onChange?.();
          }}
        />
      )}
    </section>
  );
}
