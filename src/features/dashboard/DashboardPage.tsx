import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { Photo } from "@/components/Photo";
import { heroImage } from "@/lib/images";
import { FlameIcon, DumbbellIcon, PlusIcon, MinusIcon, DropletIcon } from "@/components/icons";
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
import { withTimeout } from "@/lib/async";
import type { Workout } from "@/types";

interface TodaySession {
  dayId: string | null;
  dayName: string;
  exerciseNames: string[];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { displayName } = useAuth();
  const { goals } = useProfile();
  const firstName = displayName.split(" ")[0];

  const [loading, setLoading] = useState(true);
  // The "today's session" tile needs a 2nd/3rd query wave; it loads on its own
  // timeline so it never holds up the first paint of the rings/water/weekly.
  const [sessionLoading, setSessionLoading] = useState(true);
  const [foodTotals, setFoodTotals] = useState<Macros>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [suppTotals, setSuppTotals] = useState<Macros>({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [water, setWater] = useState(0);
  const [active, setActive] = useState<Workout | null>(null);
  const [session, setSession] = useState<TodaySession | null>(null);
  const [trainedThisWeek, setTrainedThisWeek] = useState(0);

  const refreshMacros = useCallback(async () => {
    const [food, supp] = await Promise.all([getFoodTotals(), getSupplementMacros()]);
    setFoodTotals(food);
    setSuppTotals(supp);
  }, []);

  const load = useCallback(async () => {
    // Hard safety net: never let the spinner hang. If a request stalls (a flaky
    // connection can leave a fetch pending forever, so `allSettled` below never
    // resolves and the `finally` never runs), clear loading anyway after 6s so
    // the dashboard renders with whatever came back. Each request is also
    // capped individually so one slow call can't stall the whole batch.
    const safety = setTimeout(() => {
      setLoading(false);
      setSessionLoading(false);
    }, 6000);
    try {
      // allSettled so one failing query (e.g. a not-yet-cached table) can't
      // blank the whole dashboard — each tile degrades independently.
      const [food, supp, w, act, program, workouts] = await Promise.allSettled([
        withTimeout(getFoodTotals()),
        withTimeout(getSupplementMacros()),
        withTimeout(getWaterMl()),
        withTimeout(getActiveWorkout()),
        withTimeout(getActiveProgram()),
        withTimeout(listWorkouts(50)),
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

      // Paint now — the rings/water/weekly all have their data. Don't make the
      // spinner wait on the extra query waves the session tile needs below.
      setLoading(false);

      // Today's suggested session: first day of the active program. Runs as a
      // second phase; the hero shows a skeleton until this settles.
      try {
        let sess: TodaySession | null = null;
        const activeProgram = program.status === "fulfilled" ? program.value : null;
        if (activeProgram) {
          const ds = await withTimeout(listDays(activeProgram.id));
          const day = ds[0] ?? null;
          if (day) {
            const [pex, lib] = await Promise.all([
              withTimeout(listProgramExercises(day.id)),
              withTimeout(listExercises()),
            ]);
            const libMap = new Map(lib.map((e) => [e.id, e]));
            sess = {
              dayId: day.id,
              dayName: day.name,
              exerciseNames: pex.map((p) => libMap.get(p.exercise_id)?.name).filter(Boolean) as string[],
            };
          }
        }
        setSession(sess);
      } catch {
        /* leave the session tile in its default (no program) state */
      } finally {
        setSessionLoading(false);
      }
    } catch {
      /* keep whatever loaded; never hang on the spinner */
    } finally {
      clearTimeout(safety);
      setLoading(false);
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => addMacros(foodTotals, suppTotals), [foodTotals, suppTotals]);
  const hasGoals = Boolean(goals?.calorie_target);
  const waterGoal = goals?.water_target_ml ?? 3000;

  // Gentle, data-driven nudge (ROADMAP #13) — dismissible for the day.
  const nudgeKey = `fitnessapp.nudgeDismissed.${todayISO()}`;
  const [nudgeDismissed, setNudgeDismissed] = useState(() =>
    typeof localStorage !== "undefined" && localStorage.getItem(nudgeKey) === "1",
  );
  const nudge = useMemo(
    () =>
      computeNudge({
        hasGoals,
        calories: totals.calories,
        protein: totals.protein_g,
        proteinGoal: goals?.protein_target_g ?? 0,
        hour: new Date().getHours(),
        hasActiveWorkout: Boolean(active),
        session,
      }),
    [hasGoals, totals.calories, totals.protein_g, goals?.protein_target_g, active, session],
  );
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
          <h1
            className="font-display text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--color-brand)" }}
          >
            Hi, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-muted">{greeting()} — time to challenge your limits.</p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-flame)" }}
        >
          <FlameIcon className="h-4 w-4" />
          <span className="font-display">{trainedThisWeek}</span>
        </div>
      </header>

      {/* Nudge */}
      {nudge && !nudgeDismissed && (
        <button
          onClick={() => {
            if (nudge.href) navigate(nudge.href);
          }}
          className="flex w-full items-start gap-3 rounded-[var(--radius-card)] p-3 text-left"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
        >
          <span className="text-lg leading-none">{nudge.emoji}</span>
          <span className="min-w-0 flex-1 text-sm">{nudge.text}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              localStorage.setItem(nudgeKey, "1");
              setNudgeDismissed(true);
            }}
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-muted"
            style={{ background: "var(--color-line)" }}
          >
            ✕
          </span>
        </button>
      )}

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

      {/* Today's workout — full-bleed photo hero */}
      <section className="relative min-h-[190px] overflow-hidden rounded-[var(--radius-card)]">
        <Photo
          src={heroImage(active?.name ?? session?.dayName ?? "workout", 800)}
          alt=""
          scrim="full"
          eager
          className="absolute inset-0 h-full w-full"
        />
        <div className="relative flex min-h-[190px] flex-col justify-end p-4 text-white">
          {sessionLoading && !active ? (
            // Skeleton while the session query waves settle — avoids a flash of
            // "No program yet" for users who actually have a program.
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/25" />
                  <div className="h-6 w-40 animate-pulse rounded bg-white/30" />
                  <div className="h-3 w-52 animate-pulse rounded bg-white/20" />
                </div>
                <DumbbellIcon className="h-8 w-8 shrink-0 opacity-90" />
              </div>
              <div className="mt-4 h-11 w-full animate-pulse rounded-xl bg-white/25" />
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide opacity-85">
                    {active ? "In progress" : "Today's session"}
                  </p>
                  <h3 className="mt-0.5 font-display text-2xl font-bold drop-shadow">
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
                className="mt-4 w-full rounded-full py-3.5 font-bold tracking-wide transition active:scale-[0.98]"
                style={{ background: "var(--color-accent)", color: "var(--color-on-accent)" }}
              >
                {active ? "Resume workout" : session ? "Go to workout" : "Build a program"}
              </button>
            </>
          )}
        </div>
      </section>

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
            className="flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          {[250, 500].map((ml) => (
            <button
              key={ml}
              onClick={() => quickWater(ml)}
              className="flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold"
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

interface Nudge {
  text: string;
  emoji: string;
  href?: string;
}

/** Pick the single most relevant gentle nudge from today's state, or none. */
function computeNudge(s: {
  hasGoals: boolean;
  calories: number;
  protein: number;
  proteinGoal: number;
  hour: number;
  hasActiveWorkout: boolean;
  session: TodaySession | null;
}): Nudge | null {
  // A workout already in progress — nudge to resume it.
  if (s.hasActiveWorkout) {
    return { text: "You've got a workout in progress — jump back in and finish strong.", emoji: "🏋️", href: "/workouts" };
  }
  // Nothing eaten yet, but goals are set — prompt to start logging.
  if (s.hasGoals && s.calories === 0) {
    return { text: "No food logged yet today. Tap Fuel to start hitting your macros.", emoji: "🍽️", href: "/nutrition" };
  }
  // Behind on protein in the afternoon/evening.
  if (s.hasGoals && s.proteinGoal > 0 && s.hour >= 15 && s.protein < s.proteinGoal * 0.5) {
    const left = Math.round(s.proteinGoal - s.protein);
    return { text: `You're behind on protein — about ${left} g to go. Plan the rest of your day on Fuel.`, emoji: "💪", href: "/nutrition" };
  }
  // A session is planned and untouched — nudge to train.
  if (s.session && s.session.exerciseNames.length > 0) {
    return { text: `Today's ${s.session.dayName} is ready when you are.`, emoji: "🔥", href: "/workouts" };
  }
  return null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display text-lg font-bold tracking-tight"
      style={{ color: "var(--color-accent)" }}
    >
      {children}
    </h2>
  );
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
