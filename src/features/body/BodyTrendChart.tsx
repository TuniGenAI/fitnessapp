import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/** Weight trend chart (raw scale points + smoothed trend). Lazy-loaded so
 *  recharts only ships when the Body screen actually has data to plot. */
export default function BodyTrendChart({
  data,
  unit,
}: {
  data: { date: string; weight: number; trend: number }[];
  unit: "kg" | "lb";
}) {
  return (
    <section className="card p-4">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
        Weight trend ({unit})
      </p>
      <ResponsiveContainer width="100%" height={210}>
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
  );
}
