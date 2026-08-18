import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Exercise, PersonalRecord } from "@/types";
import { useWeightUnit } from "@/features/profile/ProfileProvider";
import { EmptyState, Spinner } from "@/components/ui";
import { ChartIcon, TrophyIcon } from "@/components/icons";
import { toDisplayWeight, formatWeight, shortDate, trim } from "@/lib/format";
import { listExercises, getExerciseHistory, getBestPRs, getMuscleVolume } from "./api";
import {
  bestSet,
  estimatedOneRepMax,
  workingSets,
  prTypeLabel,
} from "./logic";

export function ExerciseProgress() {
  const unit = useWeightUnit();
  const [loading, setLoading] = useState(true);
  const [trained, setTrained] = useState<Exercise[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [lib, best] = await Promise.all([listExercises(), getBestPRs()]);
      const trainedIds = new Set(best.map((p) => p.exercise_id));
      const libMap = new Map(lib.map((e) => [e.id, e]));
      const list = [...trainedIds].map((id) => libMap.get(id)).filter(Boolean) as Exercise[];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setTrained(list);
      setPrs(best);
      setSelected(list[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;
  if (trained.length === 0) {
    return (
      <EmptyState
        Icon={ChartIcon}
        title="No progress data yet"
        hint="Log a few sets and your strength curve per exercise will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <MuscleVolumeChart unit={unit} />
      <p className="font-display text-base font-bold tracking-tight text-accent">Per exercise</p>
      <div className="flex flex-wrap gap-1.5">
        {trained.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelected(e.id)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={
              e.id === selected
                ? { background: "var(--color-brand)", color: "#fff" }
                : { background: "var(--color-surface-2)", color: "var(--color-muted)" }
            }
          >
            {e.name}
          </button>
        ))}
      </div>
      {selected && (
        <ExerciseChart
          exerciseId={selected}
          unit={unit}
          prs={prs.filter((p) => p.exercise_id === selected)}
        />
      )}
    </div>
  );
}

function title(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MuscleVolumeChart({ unit }: { unit: "kg" | "lb" }) {
  const [data, setData] = useState<{ muscle: string; volume: number }[] | null>(null);

  useEffect(() => {
    getMuscleVolume(30).then((rows) =>
      setData(
        rows.map((r) => ({
          muscle: title(r.muscle),
          volume: Math.round(toDisplayWeight(r.volume, unit)),
        })),
      ),
    );
  }, [unit]);

  if (!data) return <Spinner />;
  if (data.length === 0) return null;

  return (
    <div className="card p-4">
      <p className="mb-2 font-display text-base font-bold tracking-tight text-accent">
        Volume by muscle · last 30 days ({unit})
      </p>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="muscle"
            width={64}
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-2)" }}
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Bar dataKey="volume" fill="var(--color-brand)" radius={[0, 6, 6, 0]} name="Volume" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExerciseChart({
  exerciseId,
  unit,
  prs,
}: {
  exerciseId: string;
  unit: "kg" | "lb";
  prs: PersonalRecord[];
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ date: string; e1rm: number; top: number }[]>([]);

  useEffect(() => {
    setLoading(true);
    getExerciseHistory(exerciseId).then((history) => {
      const points = history
        .map((h) => {
          const working = workingSets(h.sets);
          if (working.length === 0) return null;
          const e1rm = Math.max(
            ...working.map((s) => estimatedOneRepMax(s.weight_kg, s.reps)),
          );
          const top = bestSet(h.sets);
          return {
            date: shortDate(h.date),
            e1rm: Math.round(toDisplayWeight(e1rm, unit)),
            top: top ? Math.round(toDisplayWeight(top.weight_kg, unit)) : 0,
          };
        })
        .filter(Boolean) as { date: string; e1rm: number; top: number }[];
      setData(points);
      setLoading(false);
    });
  }, [exerciseId, unit]);

  const prByType = useMemo(() => {
    const m = new Map<string, PersonalRecord>();
    for (const p of prs) {
      const cur = m.get(p.record_type);
      if (!cur || p.value > cur.value) m.set(p.record_type, p);
    }
    return m;
  }, [prs]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <p className="mb-2 font-display text-base font-bold tracking-tight text-accent">
          Estimated 1RM ({unit})
        </p>
        {data.length < 2 ? (
          <p className="py-6 text-center text-sm text-muted">
            Log this exercise across a few sessions to see the trend.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
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
                domain={["dataMin - 5", "dataMax + 5"]}
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
                dataKey="e1rm"
                stroke="var(--color-brand)"
                strokeWidth={3}
                dot={{ r: 3, fill: "var(--color-brand)" }}
                activeDot={{ r: 5 }}
                name="Est. 1RM"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-4">
        <p className="mb-2 flex items-center gap-2 font-display text-base font-bold tracking-tight text-accent">
          <TrophyIcon className="h-4 w-4" style={{ color: "var(--color-accent)" }} /> Records
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["weight", "reps", "volume"] as const).map((type) => {
            const pr = prByType.get(type);
            return (
              <div
                key={type}
                className="rounded-xl p-3 text-center"
                style={{ background: "var(--color-surface-2)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted">
                  {prTypeLabel(type)}
                </p>
                <p className="mt-1 text-sm font-bold">
                  {!pr
                    ? "—"
                    : type === "weight"
                      ? formatWeight(pr.value, unit)
                      : type === "reps"
                        ? `${pr.value} reps`
                        : `${trim(Math.round(toDisplayWeight(pr.value, unit)))} ${unit}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
