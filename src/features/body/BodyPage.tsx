import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { BodyMetric } from "@/types";
import { useProfile } from "@/features/profile/ProfileProvider";
import {
  PageHeader,
  Button,
  Sheet,
  Stepper,
  Spinner,
  EmptyState,
} from "@/components/ui";
import { HeartPulseIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  toDisplayWeight,
  fromDisplayWeight,
  formatWeight,
  shortDate,
  relativeDay,
  trim,
} from "@/lib/format";
import { listMetrics, addMetric, deleteMetric, smoothWeights } from "./api";

export function BodyPage() {
  const { profile } = useProfile();
  const unit = profile?.weight_unit ?? "kg";
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setMetrics(await listMetrics());
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const latest = metrics.length ? metrics[metrics.length - 1] : null;

  const chart = useMemo(() => {
    const pts = metrics
      .filter((m) => m.weight_kg != null)
      .map((m) => ({
        date: shortDate(m.measured_at),
        weight: Math.round(toDisplayWeight(m.weight_kg as number, unit) * 10) / 10,
      }));
    return smoothWeights(pts);
  }, [metrics, unit]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Body"
        Icon={HeartPulseIcon}
        action={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon className="h-4 w-4" /> Weigh in
          </Button>
        }
      />

      {loading ? (
        <Spinner />
      ) : metrics.length === 0 ? (
        <EmptyState
          Icon={HeartPulseIcon}
          title="No weigh-ins yet"
          hint="Log weight, body-fat %, muscle and water from your scale to see your trend."
          action={<Button onClick={() => setAdding(true)}>Add first weigh-in</Button>}
        />
      ) : (
        <>
          {/* Latest snapshot */}
          {latest && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Weight"
                value={latest.weight_kg != null ? formatWeight(latest.weight_kg, unit) : "—"}
                color="var(--color-brand)"
              />
              <StatCard label="Body fat" value={pct(latest.body_fat_pct)} color="var(--color-protein)" />
              <StatCard label="Muscle" value={pct(latest.muscle_pct)} color="var(--color-fat)" />
              <StatCard label="Water" value={pct(latest.water_pct)} color="var(--color-water)" />
            </section>
          )}

          {/* Trend */}
          {chart.length >= 2 && (
            <section className="card p-4">
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                Weight trend ({unit})
              </p>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={chart} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    domain={["dataMin - 1", "dataMax + 1"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-line)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--color-muted)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-line)"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: "var(--color-muted)" }}
                    name="Scale"
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="var(--color-brand)"
                    strokeWidth={3}
                    dot={false}
                    name="Trend"
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-1 text-center text-xs text-muted">
                The bold line is your smoothed trend — that's the number that matters, not daily noise.
              </p>
            </section>
          )}

          {/* History */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">History</h2>
            {[...metrics].reverse().map((m) => (
              <div key={m.id} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {m.weight_kg != null ? formatWeight(m.weight_kg, unit) : "—"}
                    {m.body_fat_pct != null && (
                      <span className="text-muted"> · {trim(m.body_fat_pct)}% bf</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {relativeDay(m.measured_at)}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await deleteMetric(m.id);
                    await load();
                  }}
                  className="text-muted"
                  aria-label="Delete weigh-in"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Honest sync note (PRD §9) */}
      <section className="card p-4" style={{ borderColor: "var(--color-line)" }}>
        <p className="text-xs text-muted">
          <span className="font-semibold" style={{ color: "var(--color-brand-soft)" }}>
            Why manual entry?
          </span>{" "}
          iPhone + a home-screen web app can't read your Xiaomi scale over Bluetooth
          directly. For now you enter numbers from the scale's app — quick and reliable.
          A future native app / Apple Shortcuts bridge could auto-forward these (see PRD §9).
        </p>
      </section>

      {adding && (
        <WeighInSheet
          unit={unit}
          startWeightKg={latest?.weight_kg ?? null}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function pct(v: number | null): string {
  return v == null ? "—" : `${trim(v)}%`;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-lg font-extrabold" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function WeighInSheet({
  unit,
  startWeightKg,
  onClose,
  onSaved,
}: {
  unit: "kg" | "lb";
  startWeightKg: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState(
    startWeightKg != null ? Number(toDisplayWeight(startWeightKg, unit).toFixed(1)) : unit === "lb" ? 175 : 80,
  );
  const [bf, setBf] = useState(0);
  const [muscle, setMuscle] = useState(0);
  const [water, setWater] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Sheet open onClose={onClose} title="New weigh-in">
      <div className="space-y-4">
        <Row label={`Weight (${unit})`}>
          <Stepper value={weight} onChange={setWeight} step={unit === "lb" ? 0.2 : 0.1} decimals={1} min={0} max={500} />
        </Row>
        <Row label="Body fat %">
          <Stepper value={bf} onChange={setBf} step={0.1} decimals={1} min={0} max={70} />
        </Row>
        <Row label="Muscle %">
          <Stepper value={muscle} onChange={setMuscle} step={0.1} decimals={1} min={0} max={80} />
        </Row>
        <Row label="Water %">
          <Stepper value={water} onChange={setWater} step={0.1} decimals={1} min={0} max={80} />
        </Row>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
        />
        <Button
          block
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await addMetric({
                weight_kg: weight > 0 ? fromDisplayWeight(weight, unit) : null,
                body_fat_pct: bf > 0 ? bf : null,
                muscle_pct: muscle > 0 ? muscle : null,
                water_pct: water > 0 ? water : null,
                note: note.trim() || null,
              });
              onSaved();
            } finally {
              setSaving(false);
            }
          }}
        >
          Save weigh-in
        </Button>
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
