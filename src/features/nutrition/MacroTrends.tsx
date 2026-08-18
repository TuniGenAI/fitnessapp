import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { shortDate } from "@/lib/format";
import { getDailyHistory } from "./api";

/** Last-7-days calorie intake vs target. Lazy-loaded (pulls in recharts). */
export default function MacroTrends({
  target,
  version,
}: {
  target: number | null;
  version: number;
}) {
  const [data, setData] = useState<{ label: string; calories: number }[] | null>(null);

  useEffect(() => {
    getDailyHistory(7).then((rows) =>
      setData(rows.map((r) => ({ label: shortDate(r.date), calories: r.calories }))),
    );
  }, [version]);

  if (!data) return null;
  const anyLogged = data.some((d) => d.calories > 0);
  if (!anyLogged) return null;

  return (
    <section className="card p-4">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
        Calories · last 7 days
      </p>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
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
          {target != null && target > 0 && (
            <ReferenceLine
              y={target}
              stroke="var(--color-accent)"
              strokeDasharray="4 4"
              label={{ value: "target", fontSize: 10, fill: "var(--color-accent)", position: "right" }}
            />
          )}
          <Bar dataKey="calories" radius={[6, 6, 0, 0]} name="Calories">
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  target && d.calories > target * 1.05
                    ? "var(--color-protein)"
                    : "url(#calGrad)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
