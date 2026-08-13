import { useState } from "react";
import { MacroRing } from "@/components/MacroRing";
import { FlameIcon, DumbbellIcon, TrophyIcon, PlusIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Today dashboard — the hybrid "what to do now" view.
 *
 * NOTE: values below are placeholders so the layout is real and testable.
 * They get wired to live data in later milestones (nutrition, workouts,
 * supplements, body). Each section is labeled with the milestone that fills it.
 */
export function DashboardPage() {
  const { displayName } = useAuth();
  const firstName = displayName.split(" ")[0];
  const [water, setWater] = useState(1250); // ml
  const waterGoal = 3000;

  const [supps, setSupps] = useState([
    { id: "whey", name: "Whey protein", done: true },
    { id: "creatine", name: "Creatine", done: true },
    { id: "vitd", name: "Vitamin D + fish oil", done: false },
    { id: "preworkout", name: "Pre-workout", done: false },
  ]);
  const suppsDone = supps.filter((s) => s.done).length;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{firstName} 👋</h1>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-flame)" }}
        >
          <FlameIcon className="h-4 w-4" />
          5
        </div>
      </header>

      {/* Weekly strip */}
      <section className="card-2 flex items-center justify-around p-3">
        <Stat label="Streak" value="5 days" />
        <Divider />
        <Stat label="Trained" value="3 / 5" />
        <Divider />
        <Stat label="Macros" value="86%" />
      </section>

      {/* Macro rings */}
      <section className="card p-4">
        <SectionTitle>Today's fuel</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MacroRing label="Calories" value={1680} goal={2600} unit="" color="var(--color-calories)" />
          <MacroRing label="Protein" value={128} goal={190} color="var(--color-protein)" />
          <MacroRing label="Carbs" value={165} goal={260} color="var(--color-carbs)" />
          <MacroRing label="Fat" value={52} goal={78} color="var(--color-fat)" />
        </div>
      </section>

      {/* Today's workout */}
      <section
        className="relative overflow-hidden rounded-[var(--radius-card)] p-4 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Today's session</p>
            <h3 className="mt-0.5 text-xl font-bold">Push Day</h3>
            <p className="mt-1 text-sm opacity-90">Bench · Overhead press · Dips · Triceps</p>
          </div>
          <DumbbellIcon className="h-8 w-8 opacity-90" />
        </div>
        <button className="mt-4 w-full rounded-xl bg-white/95 py-3 font-bold text-[color:var(--color-brand-strong)] transition active:scale-[0.98]">
          Start Workout
        </button>
      </section>

      {/* Water */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Water</SectionTitle>
          <span className="text-sm text-muted">
            {(water / 1000).toFixed(2)}L / {(waterGoal / 1000).toFixed(1)}L
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--color-line)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min((water / waterGoal) * 100, 100)}%`, background: "var(--color-water)" }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          {[250, 500].map((ml) => (
            <button
              key={ml}
              onClick={() => setWater((w) => Math.min(w + ml, waterGoal + 1000))}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: "var(--color-surface-2)", color: "var(--color-water)" }}
            >
              <PlusIcon className="h-4 w-4" />
              {ml}ml
            </button>
          ))}
        </div>
      </section>

      {/* Supplements */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Supplements</SectionTitle>
          <span className="text-sm text-muted">{suppsDone} / {supps.length}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {supps.map((s) => (
            <li key={s.id}>
              <button
                onClick={() =>
                  setSupps((prev) =>
                    prev.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)),
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={{ background: "var(--color-surface-2)" }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold"
                  style={{
                    borderColor: s.done ? "var(--color-accent)" : "var(--color-line)",
                    background: s.done ? "var(--color-accent)" : "transparent",
                    color: s.done ? "#0b0f1a" : "transparent",
                  }}
                >
                  ✓
                </span>
                <span className={s.done ? "text-muted line-through" : ""}>{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Coach line placeholder */}
      <section
        className="card flex items-start gap-3 p-4"
        style={{ borderColor: "var(--color-brand)" }}
      >
        <TrophyIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--color-accent)" }} />
        <p className="text-sm text-muted">
          <span className="font-semibold text-[color:var(--color-brand-soft)]">Coach:</span>{" "}
          Your AI briefing lands here once Gemini is wired up (Milestone 3). Today: beat 60kg×6 on bench.
        </p>
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{children}</h2>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px" style={{ background: "var(--color-line)" }} />;
}
