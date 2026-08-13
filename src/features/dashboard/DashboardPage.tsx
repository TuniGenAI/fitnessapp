import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { FlameIcon, DumbbellIcon, TrophyIcon, PlusIcon, MinusIcon, DropletIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { useProfile } from "@/features/profile/ProfileProvider";
import { todayISO, relativeDay } from "@/lib/format";
import {
  getActiveWorkout,
  getActiveProgram,
  listDays,
  listProgramExercises,
  listExercises,
  listWorkouts,
} from "@/features/workouts/api";
import {
  getFoodTotals,
  getWaterMl,
  addWater,
  addMacros,
  type Macros,
} from "@/features/nutrition/api";
import { getSupplementMacros } from "@/features/supplements/api";
import { SupplementChecklist } from "@/features/supplements/SupplementChecklist";
import { getBriefing } from "@/features/coach/api";
import type { Workout } from "@/types";

interface TodaySession {
  dayId: string | null;
  dayName: string;
  exerciseNames: string[];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { displayName } = useAuth();
  const { profile, goals } = useProfile();
  const firstName = displayName.split(" ")[0];

  const [loading, setLoading] = useState(true);
  const [foodTotals, setFoodTotals] = useState<Macros>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [suppTotals, setSuppTotals] = useState<Macros>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [water, setWater] = useState(0);
  const [active, setActive] = useState<Workout | null>(null);
  const [session, setSession] = useState<TodaySession | null>(null);
  const [trainedThisWeek, setTrainedThisWeek] = useState(0);
  const [briefing, setBriefing] = useState<string>("");

  const refreshMacros = useCallback(async () => {
    const [food, supp] = await Promise.all([getFoodTotals(), getSupplementMacros()]);
    setFoodTotals(food);
    setSuppTotals(supp);
  }, []);

  const load = useCallback(async () => {
    try {
      // allSettled so one failing query (e.g. a not-yet-cached table) can't
      // blank the whole dashboard — each tile degrades independently.
      const [food, supp, w, act, program, workouts] = await Promise.allSettled([
        getFoodTotals(),
        getSupplementMacros(),
        getWaterMl(),
        getActiveWorkout(),
        getActiveProgram(),
        listWorkouts(50),
      ]);
      if (food.status === "fulfilled") setFoodTotals(food.value);
      if (supp.status === "fulfilled") setSuppTotals(supp.value);
      if (w.status === "fulfilled") setWater(w.value);
      if (act.status === "fulfilled") setActive(act.value);

      // Trained this week (distinct local days with a completed workout, last 7d).
      if (workouts.status === "fulfilled") {
        const weekAgo = todayISO(new Date(Date.now() - 6 * 86400000));
        const days = new Set(
          workouts.value
            .filter((x) => x.completed_at && todayISO(new Date(x.started_at)) >= weekAgo)
            .map((x) => todayISO(new Date(x.started_at))),
        );
        setTrainedThisWeek(days.size);
      }

      // Today's suggested session: first day of the active program.
      let sess: TodaySession | null = null;
      const activeProgram = program.status === "fulfilled" ? program.value : null;
      if (activeProgram) {
        const ds = await listDays(activeProgram.id);
        const day = ds[0] ?? null;
        if (day) {
          const [pex, lib] = await Promise.all([listProgramExercises(day.id), listExercises()]);
          const libMap = new Map(lib.map((e) => [e.id, e]));
          sess = {
            dayId: day.id,
            dayName: day.name,
            exerciseNames: pex.map((p) => libMap.get(p.exercise_id)?.name).filter(Boolean) as string[],
          };
        }
      }
      setSession(sess);

      // Coach briefing (rule-based unless AI configured).
      if (sess) {
        const { text } = await getBriefing(
          {
            dayName: sess.dayName,
            firstName,
            exercises: sess.exerciseNames.map((name) => ({ name })),
          },
          profile?.coach_enabled ?? true,
        );
        setBriefing(text);
      } else {
        setBriefing("");
      }
    } catch {
      /* keep whatever loaded; never hang on the spinner */
    } finally {
      setLoading(false);
    }
  }, [firstName, profile?.coach_enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => addMacros(foodTotals, suppTotals), [foodTotals, suppTotals]);
  const hasGoals = Boolean(goals?.calorie_target);
  const waterGoal = goals?.water_target_ml ?? 3000;
  const macroPct =
    hasGoals && goals?.calorie_target
      ? Math.round((totals.calories / goals.calorie_target) * 100)
      : null;

  async function quickWater(ml: number) {
    // Clamp so the logged total never dips below zero when reducing.
    const applied = Math.max(0, water + ml) - water;
    if (applied === 0) return;
    setWater((w) => w + applied);
    try {
      await addWater(applied);
    } catch {
      /* schema cache / offline — keep the optimistic value */
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">{firstName} 👋</h1>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-flame)" }}
        >
          <FlameIcon className="h-4 w-4" />
          <span className="font-display">{trainedThisWeek}</span>
        </div>
      </header>

      {/* Weekly strip */}
      <section className="card-2 flex items-center justify-around p-3">
        <Stat label="Trained" value={`${trainedThisWeek} / wk`} />
        <Divider />
        <Stat label="Calories" value={hasGoals ? `${Math.round(totals.calories)}` : "—"} />
        <Divider />
        <Stat label="Macros" value={macroPct != null ? `${macroPct}%` : "—"} />
      </section>

      {/* Macro rings */}
      {hasGoals ? (
        <section className="card p-4">
          <SectionTitle>Today's fuel</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MacroRing label="Calories" value={totals.calories} goal={goals!.calorie_target ?? 0} unit="" color="var(--color-calories)" />
            <MacroRing label="Protein" value={totals.protein_g} goal={goals!.protein_target_g ?? 0} color="var(--color-protein)" />
            <MacroRing label="Carbs" value={totals.carbs_g} goal={goals!.carbs_target_g ?? 0} color="var(--color-carbs)" />
            <MacroRing label="Fat" value={totals.fat_g} goal={goals!.fat_target_g ?? 0} color="var(--color-fat)" />
          </div>
        </section>
      ) : (
        <button
          onClick={() => navigate("/nutrition")}
          className="card w-full p-4 text-left"
          style={{ borderStyle: "dashed", borderColor: "var(--color-brand)" }}
        >
          <p className="font-semibold">Set your nutrition goals →</p>
          <p className="mt-1 text-sm text-muted">
            Unlock macro rings with the TDEE calculator on the Fuel tab.
          </p>
        </button>
      )}

      {/* Today's workout */}
      <section
        className="relative overflow-hidden rounded-[var(--radius-card)] p-4 text-white"
        style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))" }}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              {active ? "In progress" : "Today's session"}
            </p>
            <h3 className="mt-0.5 font-display text-xl font-bold">
              {active ? active.name ?? "Training" : session ? session.dayName : "No program yet"}
            </h3>
            <p className="mt-1 truncate text-sm opacity-90">
              {active
                ? `Started ${relativeDay(active.started_at).toLowerCase()}`
                : session
                  ? session.exerciseNames.slice(0, 4).join(" · ") || "Add exercises"
                  : "Pick a template on the Train tab"}
            </p>
          </div>
          <DumbbellIcon className="h-8 w-8 shrink-0 opacity-90" />
        </div>
        <button
          onClick={() => navigate("/workouts")}
          className="mt-4 w-full rounded-xl bg-white/95 py-3 font-bold text-[color:var(--color-brand-strong)] transition active:scale-[0.98]"
        >
          {active ? "Resume workout" : session ? "Go to workout" : "Build a program"}
        </button>
      </section>

      {/* Coach line */}
      {briefing && (
        <section className="card flex items-start gap-3 p-4" style={{ borderColor: "var(--color-brand)" }}>
          <TrophyIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--color-accent)" }} />
          <p className="text-sm text-muted">
            <span className="font-semibold text-[color:var(--color-brand-soft)]">Coach:</span> {briefing}
          </p>
        </section>
      )}

      {/* Water */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <DropletIcon className="h-4 w-4" style={{ color: "var(--color-water)" }} /> Water
            </span>
          </SectionTitle>
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
          <button
            onClick={() => quickWater(-250)}
            disabled={water <= 0}
            aria-label="Remove 250ml"
            className="flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          {[250, 500].map((ml) => (
            <button
              key={ml}
              onClick={() => quickWater(ml)}
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
      <SupplementChecklist onChange={refreshMacros} />
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
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px" style={{ background: "var(--color-line)" }} />;
}
