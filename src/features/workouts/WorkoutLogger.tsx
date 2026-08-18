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
  type TargetSuggestion,
} from "./logic";
import { ExercisePicker } from "./ExercisePicker";
import { getRecap, getReaction, saveCoachMessage } from "@/features/coach/api";
import { reactionForSet } from "@/features/coach/logic";
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
  // Monotonic token so a late AI reaction from an earlier set can't overwrite a
  // newer set's toast.
  const reactionToken = useRef(0);

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
        const lastBest = bestSet(entry.last);
        const beatLastTime = lastBest
          ? estimatedOneRepMax(weightKg, reps) > estimatedOneRepMax(lastBest.weight_kg, lastBest.reps)
          : false;
        // Instant rule-based line so feedback never lags the tap…
        flashToast(
          reactionForSet({
            isPr: false,
            beatLastTime,
            reps,
            targetHigh: entry.target?.target_reps_high,
          }),
        );
        // …then upgrade to a specific AI reaction when it lands (full per-set AI
        // mode). Non-blocking; a slow call or a transient 503 just leaves the
        // rule line in place. Guarded by a token so a stale reaction from an
        // earlier set can't clobber a newer toast.
        const token = ++reactionToken.current;
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
            if (ai && token === reactionToken.current) flashToast(ai);
          })
          .catch(() => {
            /* keep the rule line */
          });
      }
    } catch {
      flashToast("Couldn't log that set — check your connection and try again.");
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

  return (
    <div className="space-y-4">
      <SessionHeader
        workout={workout}
        totalSets={totalSets}
        finishing={finishing}
        onFinish={finishWorkout}
      />

      {loading ? (
        <Spinner />
      ) : (
        <>
          {entries.map((e) => (
            <ExerciseLogCard
              key={e.exercise.id}
              entry={e}
              unit={unit}
              pending={loggingId === e.exercise.id}
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
          ))}

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
            after each set — or finish anyway if you're done.
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
                {done ? "Rest done — next set" : "Resting"}
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
  onLog,
  onDeleteSet,
}: {
  entry: Entry;
  unit: "kg" | "lb";
  pending: boolean;
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

  const lastBest = bestSet(last);

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
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted">Last time</p>
            <p className="text-sm font-semibold">
              {formatWeight(lastBest.weight_kg, unit)} × {lastBest.reps}
            </p>
          </div>
        )}
      </div>

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
            — {suggestion.reason}
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

      {/* Input row */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Weight ({unit})</p>
          <Stepper
            value={weight}
            onChange={setWeight}
            step={toDisplayWeight(inc, unit)}
            min={0}
            decimals={2}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-muted">Reps</p>
          <Stepper value={reps} onChange={setReps} step={1} min={0} />
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
          <CheckIcon className="h-4 w-4" /> {pending ? "Logging…" : `Log set ${trim(weight)}${unit} × ${reps}`}
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
