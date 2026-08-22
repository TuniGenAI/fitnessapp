import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Exercise,
  Workout,
  WorkoutSet,
  ProgramExercise,
  RecordType,
} from "@/types";
import { useProfile, useWeightUnit } from "@/features/profile/ProfileProvider";
import { Button, Stepper, Spinner, AddButton, Sheet } from "@/components/ui";
import { TrophyIcon, TrashIcon, CheckIcon, DumbbellIcon } from "@/components/icons";
import {
  toDisplayWeight,
  fromDisplayWeight,
  weightIncrementKg,
  formatWeight,
  trim,
} from "@/lib/format";
import { celebrate } from "@/lib/celebrate";
import {
  listExercises,
  listProgramExercises,
  listSets,
  getLastWorkoutSets,
  getRecentSessionBestE1RMs,
  logSet,
  deleteSet,
  completeWorkout,
  trainedDaysThisWeek,
} from "./api";
import { todayISO } from "@/lib/format";
import {
  bestSet,
  suggestNextTarget,
  workingSets,
  setVolume,
  estimatedOneRepMax,
  prTypeLabel,
  detectStall,
  deloadTarget,
  clampSuggestionToBand,
  type TargetSuggestion,
} from "./logic";
import { ExercisePicker } from "./ExercisePicker";
import {
  getRecap,
  getReaction,
  saveCoachMessage,
  getWorkoutPlan,
  getWorkoutBriefing,
  type StoredPlan,
} from "@/features/coach/api";
import { reactionForSet } from "@/features/coach/logic";
import { usingBackend } from "@/lib/session";
import {
  restTimerOn,
  restSeconds,
  restDoneCue,
  formatClock,
} from "./restTimer";

interface Entry {
  exercise: Exercise;
  target?: ProgramExercise;
  sets: WorkoutSet[];
  last: WorkoutSet[];
  suggestion: TargetSuggestion | null;
}

export function WorkoutLogger({
  workout,
  onExit,
}: {
  workout: Workout;
  onExit: () => void;
}) {
  const unit = useWeightUnit();
  const { profile } = useProfile();
  const coachEnabled = profile?.coach_enabled ?? true;
  const reactionsMode = (profile?.coach_mode ?? "recap") === "reactions";
  const [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]); // ad-hoc added exercises
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recap, setRecap] = useState<{ text: string; ai: boolean } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  // Rest timer: {startedAt, seconds} while a rest is running, else null.
  const [rest, setRest] = useState<{ startedAt: number; seconds: number } | null>(null);
  // Which exercise is mid-log (locks the button so a double-tap can't create
  // duplicate sets while the insert is in flight).
  const [loggingId, setLoggingId] = useState<string | null>(null);
  // Per-set coach reaction shown INLINE on each exercise card, keyed by
  // exerciseId (the latest line replaces the previous one on that card).
  const [reactions, setReactions] = useState<Record<string, string>>({});
  // Per-exercise monotonic token so a late AI reaction from an earlier set on the
  // same exercise can't overwrite the line from a newer set.
  const reactionTokens = useRef<Record<string, number>>({});
  // Pre-workout AI plan (briefing + hybrid targets), keyed by exerciseId.
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const planStarted = useRef(false);

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    const lib = await listExercises();
    const libMap = new Map(lib.map((e) => [e.id, e]));

    const planned = workout.program_day_id
      ? await listProgramExercises(workout.program_day_id)
      : [];
    const sets = await listSets(workout.id);

    // Session exercise order: planned first, then ad-hoc extras, then any
    // logged-but-unplanned exercises.
    const order: { id: string; target?: ProgramExercise }[] = [];
    const seen = new Set<string>();
    for (const p of planned) {
      order.push({ id: p.exercise_id, target: p });
      seen.add(p.exercise_id);
    }
    for (const id of extraIds) {
      if (!seen.has(id)) {
        order.push({ id });
        seen.add(id);
      }
    }
    for (const s of sets) {
      if (!seen.has(s.exercise_id)) {
        order.push({ id: s.exercise_id });
        seen.add(s.exercise_id);
      }
    }

    const built = await Promise.all(
      order.map(async ({ id, target }) => {
        const exercise = libMap.get(id);
        if (!exercise) return null;
        const exSets = sets.filter((s) => s.exercise_id === id);
        const last = await getLastWorkoutSets(id, workout.id);
        const repHigh = target?.target_reps_high ?? 12;
        let suggestion = suggestNextTarget(
          last,
          target?.target_reps_low ?? 8,
          repHigh,
          unit,
        );
        // If the last 3 sessions haven't progressed, suggest a deload instead of
        // repeating a jump that isn't landing (ROADMAP #8).
        if (suggestion) {
          const recentE1RMs = await getRecentSessionBestE1RMs(id, workout.id, 3);
          if (detectStall(recentE1RMs)) {
            const working = workingSets(last);
            const topWeight = working.length
              ? Math.max(...working.map((s) => s.weight_kg))
              : suggestion.weightKg;
            suggestion = deloadTarget(topWeight, repHigh, unit);
          }
        }
        return { exercise, target, sets: exSets, last, suggestion } as Entry;
      }),
    );
    setLibrary(lib);
    setEntries(built.filter(Boolean) as Entry[]);
    setLoading(false);
  }, [workout, extraIds, unit]);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-workout AI plan. Fires ONCE per session, only after entries are built.
  // This is a deliberate trigger (you chose to start a workout) — never a passive
  // screen load, per the free-tier quota history in CLAUDE.md. The result is
  // clamped to the guardrail band and persisted to the workout, so a mid-session
  // reload reuses it instead of re-calling the AI. No history / AI off / any
  // failure → no panel and the plain rule-based prefill stands (nothing changes).
  useEffect(() => {
    if (loading || planStarted.current) return;
    planStarted.current = true;
    (async () => {
      const stored = await getWorkoutBriefing(workout.id);
      if (stored) {
        setPlan(stored);
        return;
      }
      if (!coachEnabled || !usingBackend()) return;
      const coachable = entries.filter((e) => e.suggestion && e.last.length > 0);
      if (coachable.length === 0) return;

      setPlanning(true);
      try {
        const ai = await getWorkoutPlan({
          dayName: workout.name ?? "Training",
          unit,
          exercises: coachable.map((e) => ({
            name: e.exercise.name,
            target: e.target
              ? `${e.target.target_sets} × ${e.target.target_reps_low}–${e.target.target_reps_high}`
              : undefined,
            lastTime:
              workingSets(e.last)
                .map((s) => `${trim(toDisplayWeight(s.weight_kg, unit))} × ${s.reps}`)
                .join(", ") || undefined,
            suggestion: e.suggestion
              ? `${trim(toDisplayWeight(e.suggestion.weightKg, unit))} × ${e.suggestion.reps}`
              : undefined,
          })),
        });
        if (!ai) return; // keep rule prefill, show no panel

        const built: StoredPlan = {
          intro: (ai.intro ?? "").slice(0, 400),
          ai: true,
          exercises: [],
        };
        for (const ax of ai.exercises) {
          const entry = coachable[ax.index];
          if (!entry?.suggestion) continue;
          const clamped = clampSuggestionToBand(
            { weightKg: fromDisplayWeight(ax.weight, unit), reps: ax.reps },
            entry.suggestion.weightKg,
            entry.target?.target_reps_low ?? 8,
            entry.target?.target_reps_high ?? 12,
            unit,
          );
          built.exercises.push({
            exerciseId: entry.exercise.id,
            weightKg: clamped.weightKg,
            reps: clamped.reps,
            why: (ax.why ?? "").slice(0, 200),
          });
        }
        if (built.exercises.length === 0) return;
        setPlan(built);
        await saveCoachMessage("briefing", JSON.stringify(built), workout.id);
      } finally {
        setPlanning(false);
      }
    })();
    // Runs once when entries finish loading (guarded by planStarted).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function onLog(
    entry: Entry,
    weightKg: number,
    reps: number,
    warmup: boolean,
    rpe: number | null,
  ) {
    if (loggingId) return; // a log is already in flight — ignore the extra tap
    setLoggingId(entry.exercise.id);
    try {
      const { set, celebrated } = await logSet({
        workout_id: workout.id,
        exercise_id: entry.exercise.id,
        weight_kg: weightKg,
        reps,
        rpe,
        is_warmup: warmup,
      });
      // Optimistic: splice the real returned row straight into this entry. The
      // old code re-ran the full `load()` (which re-scans all workout history
      // TWICE per exercise) after every set — seconds of lag on a phone, during
      // which the set looked unsaved and users re-tapped into duplicates.
      setEntries((prev) =>
        prev.map((e) =>
          e.exercise.id === entry.exercise.id ? { ...e, sets: [...e.sets, set] } : e,
        ),
      );
      // Kick off the rest countdown after a real working set (opt-out in Settings).
      if (!warmup && restTimerOn()) {
        setRest({ startedAt: Date.now(), seconds: restSeconds() });
      }
      if (celebrated.length > 0) {
        celebrate();
        flashToast(celebrated.map((c: RecordType) => `🏆 ${prTypeLabel(c)} PR!`).join("  "));
      } else if (coachEnabled && reactionsMode && !warmup) {
        const exId = entry.exercise.id;
        const token = (reactionTokens.current[exId] ?? 0) + 1;
        reactionTokens.current[exId] = token;
        const lastBest = bestSet(entry.last);
        const beatLastTime = lastBest
          ? estimatedOneRepMax(weightKg, reps) > estimatedOneRepMax(lastBest.weight_kg, lastBest.reps)
          : false;
        // Instant rule-based line so feedback never lags the tap, shown inline on
        // this exercise's card…
        setReactions((prev) => ({
          ...prev,
          [exId]: reactionForSet({
            isPr: false,
            beatLastTime,
            reps,
            targetHigh: entry.target?.target_reps_high,
          }),
        }));
        // …then upgrade to a specific AI reaction when it lands (full per-set AI
        // mode). Non-blocking; a slow call or a transient 503 just leaves the
        // rule line in place. Guarded by a per-exercise token so a stale reaction
        // from an earlier set can't clobber a newer one.
        const targetTxt = entry.target
          ? `target ${entry.target.target_reps_low}–${entry.target.target_reps_high} reps`
          : "no set target";
        const lastTxt = lastBest
          ? `last time ${formatWeight(lastBest.weight_kg, unit)} × ${lastBest.reps}`
          : "no prior data";
        const rpeTxt = rpe != null ? `, RPE ${rpe}` : "";
        const summary = `Set just completed on ${entry.exercise.name}: ${formatWeight(
          weightKg,
          unit,
        )} × ${reps}${rpeTxt} (${targetTxt}, ${lastTxt}). Coach toward progressive overload with the real numbers.`;
        getReaction(summary)
          .then((ai) => {
            if (ai && reactionTokens.current[exId] === token) {
              setReactions((prev) => ({ ...prev, [exId]: ai }));
            }
          })
          .catch(() => {
            /* keep the rule line */
          });
      }
    } catch (err) {
      // logSet already retries the critical writes, so reaching here means every
      // attempt failed. Log the real reason (the old bare `catch {}` swallowed
      // it, leaving these failures undiagnosable).
      console.error("logSet failed after retries", err);
      flashToast("Couldn't log that set. Check your connection and try again.");
    } finally {
      setLoggingId(null);
    }
  }

  /** Finish tap: warn first if no working sets were logged, else recap. */
  function finishWorkout() {
    const working = entries.flatMap((e) => e.sets).filter((s) => !s.is_warmup);
    if (working.length === 0) {
      setConfirmEmpty(true);
      return;
    }
    runFinish();
  }

  async function runFinish() {
    setConfirmEmpty(false);
    setFinishing(true);
    const allSets = entries.flatMap((e) => e.sets);
    const working = allSets.filter((s) => !s.is_warmup);
    const totalVolumeKg = working.reduce((v, s) => v + setVolume(s.weight_kg, s.reps), 0);
    const prCount = allSets.filter((s) => s.is_pr).length;
    let top: { name: string; best: string } | undefined;
    let topScore = 0;
    for (const e of entries) {
      const b = bestSet(e.sets);
      if (b && estimatedOneRepMax(b.weight_kg, b.reps) > topScore) {
        topScore = estimatedOneRepMax(b.weight_kg, b.reps);
        top = { name: e.exercise.name, best: `${formatWeight(b.weight_kg, unit)} × ${b.reps}` };
      }
    }
    // Sessions this week (incl. this one) — cross-session continuity. Uses the
    // same calendar-week + has-working-sets definition as the dashboard; this
    // session isn't marked complete yet, so add its day explicitly.
    let trainedThisWeek = 1;
    try {
      const days = await trainedDaysThisWeek();
      if (working.length > 0) days.add(todayISO(new Date(workout.started_at)));
      trainedThisWeek = Math.max(1, days.size);
    } catch {
      /* non-fatal — fall back to just this session */
    }
    const result = await getRecap(
      {
        dayName: workout.name ?? "Training",
        workingSets: working.length,
        totalVolumeKg,
        prCount,
        topExercise: top,
        trainedThisWeek,
      },
      coachEnabled,
    );
    await saveCoachMessage("recap", result.text, workout.id);
    setRecap(result);
    setFinishing(false);
  }

  const totalSets = entries.reduce((n, e) => n + workingSets(e.sets).length, 0);

  // Coach targets keyed by exerciseId, and a name lookup for the plan panel.
  const planMap = useMemo(
    () => new Map((plan?.exercises ?? []).map((p) => [p.exerciseId, p])),
    [plan],
  );
  const nameById = useMemo(
    () => new Map(entries.map((e) => [e.exercise.id, e.exercise.name])),
    [entries],
  );

  return (
    <div className="space-y-4">
      <SessionHeader
        workout={workout}
        totalSets={totalSets}
        finishing={finishing}
        onFinish={finishWorkout}
      />

      {(planning || plan) && (
        <CoachPlanPanel plan={plan} nameById={nameById} unit={unit} />
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {entries.map((e) => {
            // Overlay the coach's clamped target onto this card's suggestion when
            // the plan covers it; otherwise the rule-based suggestion stands.
            const planned = planMap.get(e.exercise.id);
            const shown: Entry = planned
              ? {
                  ...e,
                  suggestion: {
                    weightKg: planned.weightKg,
                    reps: planned.reps,
                    reason: planned.why || "Coach's target for today",
                  },
                }
              : e;
            return (
            <ExerciseLogCard
              key={e.exercise.id}
              entry={shown}
              unit={unit}
              pending={loggingId === e.exercise.id}
              reaction={reactions[e.exercise.id] ?? null}
              onLog={(w, r, warm, rpe) => onLog(e, w, r, warm, rpe)}
              onDeleteSet={async (id) => {
                // Optimistic remove — drop it from state immediately, reconcile
                // from the backend only if the delete actually fails.
                setEntries((prev) =>
                  prev.map((en) => ({ ...en, sets: en.sets.filter((s) => s.id !== id) })),
                );
                try {
                  await deleteSet(id);
                } catch {
                  await load();
                }
              }}
            />
            );
          })}

          <AddButton label="Add exercise" onClick={() => setPicking(true)} />
        </>
      )}

      {picking && (
        <ExercisePicker
          open
          exercises={library}
          onClose={() => setPicking(false)}
          onCreated={load}
          onPick={(ex) => {
            setPicking(false);
            setExtraIds((prev) => (prev.includes(ex.id) ? prev : [...prev, ex.id]));
          }}
        />
      )}

      {recap && (
        <Sheet
          open
          onClose={async () => {
            await completeWorkout(workout.id);
            onExit();
          }}
          title="Workout complete 🎉"
        >
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ background: "var(--color-surface-2)" }}
          >
            <TrophyIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--color-accent)" }} />
            <p className="text-sm leading-relaxed">
              <span className="font-bold" style={{ color: "var(--color-brand-soft)" }}>
                Coach{recap.ai ? "" : " (rule-based)"}:
              </span>{" "}
              {recap.text}
            </p>
          </div>
          <Button
            block
            className="mt-4"
            onClick={async () => {
              await completeWorkout(workout.id);
              onExit();
            }}
          >
            Done
          </Button>
        </Sheet>
      )}

      {confirmEmpty && (
        <Sheet open onClose={() => setConfirmEmpty(false)} title="No sets logged yet">
          <p className="text-sm leading-relaxed text-muted">
            You haven't logged any working sets this session, so there's nothing to
            record. Tap the green <span className="font-semibold">“Log set”</span> button
            after each set, or finish anyway if you're done.
          </p>
          <div className="mt-4 flex gap-2">
            <Button block variant="subtle" onClick={() => setConfirmEmpty(false)}>
              Keep training
            </Button>
            <Button block variant="danger" onClick={runFinish}>
              Finish anyway
            </Button>
          </div>
        </Sheet>
      )}

      {rest && (
        <RestTimer
          startedAt={rest.startedAt}
          seconds={rest.seconds}
          onChangeSeconds={(s) => setRest((r) => (r ? { ...r, seconds: s } : r))}
          onClose={() => setRest(null)}
        />
      )}

      {toast && (
        <div
          className={`fixed inset-x-0 z-40 flex justify-center px-4 ${
            rest ? "bottom-40" : "bottom-24"
          }`}
        >
          <div
            className="rounded-full px-5 py-3 text-sm font-bold shadow-lg"
            style={{ background: "var(--color-accent)", color: "#0b0f1a" }}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pre-workout coach panel at the top of the logger: an AI intro line plus a
 * compact list of today's targets per exercise. Shows a "reading your history"
 * state while the plan is in flight. Only rendered when there's a plan (or one
 * loading) — a first-ever session with no history shows nothing here.
 */
function CoachPlanPanel({
  plan,
  nameById,
  unit,
}: {
  plan: StoredPlan | null;
  nameById: Map<string, string>;
  unit: "kg" | "lb";
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <DumbbellIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-brand-soft)" }} />
        <h2 className="text-sm font-bold" style={{ color: "var(--color-brand-soft)" }}>
          Coach's plan
        </h2>
      </div>

      {plan ? (
        <>
          {plan.intro && <p className="mt-2 text-sm leading-relaxed">{plan.intro}</p>}
          {plan.exercises.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {plan.exercises.map((p) => (
                <li
                  key={p.exerciseId}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--color-surface-2)" }}
                >
                  <span className="font-semibold">{nameById.get(p.exerciseId) ?? "Exercise"}</span>
                  <span className="mx-1.5 text-muted">→</span>
                  <span className="font-bold" style={{ color: "var(--color-accent-text)" }}>
                    {formatWeight(p.weightKg, unit)} × {p.reps}
                  </span>
                  {p.why && <span className="mt-0.5 block text-xs text-muted">{p.why}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Spinner />
          <span>Reading your last sessions to set today's targets…</span>
        </div>
      )}
    </div>
  );
}

/**
 * Floating rest countdown, shown after a working set. Auto-fires a haptic/beep
 * cue at zero, then can be adjusted (±15s), skipped, or dismissed. Rendered
 * `sticky` inside the scrolling page rather than `fixed`: the bottom nav is an
 * in-flow element (not fixed, per the iOS Safari fix), so a fixed overlay would
 * land on top of it. Sticky keeps the bar pinned just above the nav instead.
 */
function RestTimer({
  startedAt,
  seconds,
  onChangeSeconds,
  onClose,
}: {
  startedAt: number;
  seconds: number;
  onChangeSeconds: (s: number) => void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [cued, setCued] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.round((startedAt + seconds * 1000 - now) / 1000));
  const done = remaining === 0;

  // Fire the completion cue once, and auto-dismiss shortly after.
  useEffect(() => {
    if (done && !cued) {
      setCued(true);
      restDoneCue();
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
  }, [done, cued, onClose]);

  const pct = Math.min(100, Math.max(0, (remaining / seconds) * 100));

  return (
    <div className="sticky bottom-3 z-40 mt-2">
      <div className="rounded-2xl p-3 shadow-lg card-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-muted">
                {done ? "Rest done, next set" : "Resting"}
              </span>
              <span
                className="font-display text-lg font-bold tabular-nums"
                style={{ color: done ? "var(--color-accent)" : "inherit" }}
              >
                {formatClock(remaining)}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--color-line)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${done ? 100 : pct}%`,
                  background: done ? "var(--color-accent)" : "var(--color-brand)",
                }}
              />
            </div>
          </div>
          {!done && (
            <div className="flex shrink-0 items-center gap-1">
              <TimerChip label="−15" onClick={() => onChangeSeconds(Math.max(15, seconds - 15))} />
              <TimerChip label="+15" onClick={() => onChangeSeconds(seconds + 15)} />
            </div>
          )}
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--color-brand)", color: "#fff" }}
          >
            {done ? "Done" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimerChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
      style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
    >
      {label}
    </button>
  );
}

function SessionHeader({
  workout,
  totalSets,
  finishing,
  onFinish,
}: {
  workout: Workout;
  totalSets: number;
  finishing: boolean;
  onFinish: () => void;
}) {
  const elapsed = useElapsed(workout.started_at);
  return (
    <div
      className="rounded-[var(--radius-card)] p-4 text-white"
      style={{
        background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Workout in progress
          </p>
          <h1 className="mt-0.5 text-xl font-bold">{workout.name ?? "Training"}</h1>
          <p className="mt-1 text-sm opacity-90">
            {elapsed} · {totalSets} working {totalSets === 1 ? "set" : "sets"}
          </p>
        </div>
        <DumbbellIcon className="h-7 w-7 opacity-90" />
      </div>
      <button
        onClick={onFinish}
        disabled={finishing}
        className="mt-3 w-full rounded-full py-3 font-bold tracking-wide transition active:scale-[0.98] disabled:opacity-70"
        style={{ background: "var(--color-accent)", color: "var(--color-on-accent)" }}
      >
        {finishing ? "Wrapping up…" : "Finish workout"}
      </button>
    </div>
  );
}

function ExerciseLogCard({
  entry,
  unit,
  pending,
  reaction,
  onLog,
  onDeleteSet,
}: {
  entry: Entry;
  unit: "kg" | "lb";
  pending: boolean;
  /** Inline per-set coach line for THIS exercise (rule-based instantly, then AI). */
  reaction: string | null;
  onLog: (weightKg: number, reps: number, warmup: boolean, rpe: number | null) => void;
  onDeleteSet: (id: string) => void;
}) {
  const { exercise, target, sets, last, suggestion } = entry;
  const inc = weightIncrementKg(unit);

  // Draft prefilled from suggestion → last best → target midpoint.
  const initial = useMemo(() => {
    if (suggestion) {
      return { weight: toDisplayWeight(suggestion.weightKg, unit), reps: suggestion.reps };
    }
    const b = bestSet(last);
    if (b) return { weight: toDisplayWeight(b.weight_kg, unit), reps: b.reps };
    const midReps = target
      ? Math.round((target.target_reps_low + target.target_reps_high) / 2)
      : 10;
    return { weight: unit === "lb" ? 45 : 20, reps: midReps };
  }, [suggestion, last, target, unit]);

  const [weight, setWeight] = useState(initial.weight);
  const [reps, setReps] = useState(initial.reps);
  const [warmup, setWarmup] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [showLast, setShowLast] = useState(false); // full previous-session list
  // The AI plan can land AFTER this card first renders (it's non-blocking), which
  // changes `initial`. Snap the draft to the new target — but only while the user
  // hasn't hand-adjusted it, so we never yank numbers out from under them mid-entry.
  const edited = useRef(false);
  useEffect(() => {
    if (edited.current) return;
    setWeight(initial.weight);
    setReps(initial.reps);
  }, [initial.weight, initial.reps]);

  const lastBest = bestSet(last);
  const lastWorking = workingSets(last);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold">{exercise.name}</h3>
          {target && (
            <p className="text-xs text-muted">
              Target {target.target_sets} × {target.target_reps_low}–
              {target.target_reps_high}
            </p>
          )}
        </div>
        {lastBest && (
          // Tap to expand every set from last session (collapsed by default so the
          // card stays compact). Falls back to a static label if there was only
          // the one set.
          <button
            type="button"
            onClick={() => lastWorking.length > 1 && setShowLast((v) => !v)}
            className="text-right"
            aria-expanded={showLast}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted">
              Last time{lastWorking.length > 1 ? ` · ${lastWorking.length} sets` : ""}
            </p>
            <p className="text-sm font-semibold" style={{ color: showLast ? "var(--color-brand-soft)" : undefined }}>
              {formatWeight(lastBest.weight_kg, unit)} × {lastBest.reps}
              {lastWorking.length > 1 && (
                <span className="ml-1 text-xs text-muted">{showLast ? "▲" : "▼"}</span>
              )}
            </p>
          </button>
        )}
      </div>

      {showLast && lastWorking.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {lastWorking.map((s, i) => (
            <li
              key={s.id}
              className="rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{ background: "var(--color-surface-2)" }}
            >
              <span className="text-muted">{i + 1}.</span> {formatWeight(s.weight_kg, unit)} × {s.reps}
            </li>
          ))}
        </ul>
      )}

      {suggestion && (
        <div
          className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "var(--color-surface-2)" }}
        >
          <TrophyIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
          <span>
            <span className="font-bold" style={{ color: "var(--color-brand-soft)" }}>
              Suggested: {formatWeight(suggestion.weightKg, unit)} × {suggestion.reps}
            </span>{" "}
            · {suggestion.reason}
          </span>
        </div>
      )}

      {/* Logged sets */}
      {sets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {sets.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--color-surface-2)" }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: s.is_warmup ? "var(--color-line)" : "var(--color-brand)",
                    color: "#fff",
                  }}
                >
                  {s.is_warmup ? "W" : i + 1}
                </span>
                <span className="font-medium">
                  {formatWeight(s.weight_kg, unit)} × {s.reps}
                  {s.rpe != null && (
                    <span className="ml-1 text-xs text-muted">@{trim(s.rpe)}</span>
                  )}
                </span>
                {s.is_pr && (
                  <TrophyIcon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                )}
              </span>
              <button
                onClick={() => onDeleteSet(s.id)}
                className="text-muted"
                aria-label="Delete set"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Coach reaction — inline in the card (never a floating toast, so it can't
          overlap the Log button / nav, and the full sentence wraps freely). */}
      {reaction && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed"
          style={{ background: "var(--color-surface-2)" }}
        >
          <DumbbellIcon
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--color-brand-soft)" }}
          />
          <span>
            <span className="font-bold" style={{ color: "var(--color-brand-soft)" }}>
              Coach:
            </span>{" "}
            {reaction}
          </span>
        </div>
      )}

      {/* Input row */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Weight ({unit})</p>
          <Stepper
            value={weight}
            onChange={(v) => {
              edited.current = true;
              setWeight(v);
            }}
            step={toDisplayWeight(inc, unit)}
            min={0}
            decimals={2}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Reps</p>
          <Stepper
            value={reps}
            onChange={(v) => {
              edited.current = true;
              setReps(v);
            }}
            step={1}
            min={0}
          />
        </div>
      </div>

      {/* Optional RPE — effort rating, only relevant for working sets. Kept as a
          quick tap-to-set / tap-to-clear row so it never slows the core loop. */}
      {!warmup && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="mr-0.5 text-[11px] font-semibold text-muted">RPE</span>
          {[6, 7, 8, 9, 10].map((v) => (
            <button
              key={v}
              onClick={() => setRpe((cur) => (cur === v ? null : v))}
              aria-pressed={rpe === v}
              className="h-8 flex-1 rounded-full text-xs font-bold transition"
              style={{
                background: rpe === v ? "var(--color-brand)" : "var(--color-surface-2)",
                color: rpe === v ? "#fff" : "var(--color-muted)",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setWarmup((w) => !w)}
          className="rounded-full px-3 py-2 text-xs font-semibold"
          style={{
            background: warmup ? "var(--color-brand)" : "var(--color-surface-2)",
            color: warmup ? "#fff" : "var(--color-muted)",
          }}
        >
          Warm-up
        </button>
        <Button
          block
          variant="accent"
          disabled={pending}
          onClick={() => {
            onLog(fromDisplayWeight(weight, unit), reps, warmup, warmup ? null : rpe);
            setRpe(null);
          }}
        >
          <CheckIcon className="h-4 w-4" /> {pending ? "Logging…" : `Log set ${trim(weight)} ${unit} × ${reps}`}
        </Button>
      </div>
    </div>
  );
}

function useElapsed(startISO: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(startISO).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
