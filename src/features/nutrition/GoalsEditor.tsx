import { useEffect, useMemo, useState } from "react";
import type { GoalType } from "@/types";
import { useProfile } from "@/features/profile/ProfileProvider";
import { getLatestWeightKg } from "@/features/body/api";
import { Sheet, Button, Segmented, Stepper } from "@/components/ui";
import { toDisplayWeight, fromDisplayWeight } from "@/lib/format";
import {
  computeTargets,
  caloriesFromMacros,
  ACTIVITY_LABELS,
  type Activity,
  type Sex,
  type TdeeInput,
} from "./tdee";
import {
  targetsFromRate,
  rateLabel,
  type ExpenditureEstimate,
} from "./adaptiveTdee";
import { getExpenditureEstimate } from "./api";
import { useAsync } from "@/lib/useAsync";

const TDEE_KEY = "fitnessapp.tdee";
const RATE_KEY = "fitnessapp.goalRate";

interface SavedInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: GoalType;
}

function loadInputs(): SavedInputs {
  try {
    const raw = localStorage.getItem(TDEE_KEY);
    if (raw) return JSON.parse(raw) as SavedInputs;
  } catch {
    /* ignore */
  }
  return { sex: "male", age: 30, heightCm: 178, weightKg: 80, activity: "moderate", goal: "cut" };
}

/** TDEE calculator + manual override → writes calorie/macro targets to `goals`. */
export function GoalsEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { goals, updateGoals } = useProfile();
  const { profile } = useProfile();
  const unit = profile?.weight_unit ?? "kg";
  const [mode, setMode] = useState<"adaptive" | "calc" | "manual">("adaptive");
  const [error, setError] = useState<string | null>(null);

  // Save, closing only on success and surfacing any backend error instead of
  // silently failing (which looked like "goals don't save").
  async function save(patch: Parameters<typeof updateGoals>[0]) {
    setError(null);
    try {
      await updateGoals(patch);
      onClose();
    } catch (e) {
      setError((e as Error).message ?? String(e));
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nutrition goals">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "adaptive", label: "Adaptive" },
          { value: "calc", label: "Formula" },
          { value: "manual", label: "Manual" },
        ]}
      />
      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--color-protein)" }}>
          Couldn’t save: {error}
        </p>
      )}
      <div className="mt-4">
        {mode === "adaptive" ? (
          <Adaptive
            onSave={(t) =>
              save({
                source: "calculated",
                goal_type: t.goal_type,
                calorie_target: t.calories,
                protein_target_g: t.protein_g,
                carbs_target_g: t.carbs_g,
                fat_target_g: t.fat_g,
              })
            }
            onNeedFormula={() => setMode("calc")}
          />
        ) : mode === "calc" ? (
          <Calculator
            unit={unit}
            onSave={(t) =>
              save({
                source: "calculated",
                goal_type: t.goal_type,
                calorie_target: t.calories,
                protein_target_g: t.protein_g,
                carbs_target_g: t.carbs_g,
                fat_target_g: t.fat_g,
              })
            }
          />
        ) : (
          <Manual
            initial={{
              calories: goals?.calorie_target ?? 2200,
              protein_g: goals?.protein_target_g ?? 160,
              carbs_g: goals?.carbs_target_g ?? 220,
              fat_g: goals?.fat_target_g ?? 70,
              water: goals?.water_target_ml ?? 3000,
            }}
            onSave={(v) =>
              save({
                source: "manual",
                calorie_target: v.calories,
                protein_target_g: v.protein_g,
                carbs_target_g: v.carbs_g,
                fat_target_g: v.fat_g,
                water_target_ml: v.water,
              })
            }
          />
        )}
      </div>
    </Sheet>
  );
}

const GOALS: { value: GoalType; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "maintain", label: "Maintain" },
  { value: "bulk", label: "Bulk" },
];

function loadRate(): number {
  const raw = Number(localStorage.getItem(RATE_KEY));
  return Number.isFinite(raw) ? raw : -0.5;
}

const CONFIDENCE_LABEL: Record<ExpenditureEstimate["confidence"], string> = {
  high: "high confidence",
  medium: "building confidence",
  low: "early estimate",
};

/**
 * Adaptive TDEE mode: back-calculates real expenditure from logged intake +
 * weigh-ins, then sets targets from a weekly rate of change. Degrades to the
 * Formula tab until there's enough data (~2 weeks of food logs + weigh-ins).
 */
function Adaptive({
  onSave,
  onNeedFormula,
}: {
  onSave: (t: {
    goal_type: GoalType;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }) => void;
  onNeedFormula: () => void;
}) {
  const { data: est, loading } = useAsync(() => getExpenditureEstimate(), []);
  const { data: weightKg } = useAsync(() => getLatestWeightKg(), []);
  const [rate, setRate] = useState<number>(loadRate);

  const targets = useMemo(() => {
    if (!est || weightKg == null) return null;
    return targetsFromRate(est.expenditure, rate, weightKg);
  }, [est, weightKg, rate]);

  if (loading) {
    return <p className="text-sm text-muted">Reading your intake + weigh-ins…</p>;
  }

  // Not enough data yet — be honest and point at the formula path.
  if (!est || weightKg == null) {
    return (
      <div className="space-y-3">
        <div className="card-2 p-4">
          <p className="text-sm font-semibold">Not enough data yet</p>
          <p className="mt-1 text-xs text-muted">
            The adaptive engine learns your real maintenance calories from about two
            weeks of logged food and regular weigh-ins. Keep logging and it kicks in
            automatically. For now, set a starting target from the formula.
          </p>
        </div>
        <Button block variant="subtle" onClick={onNeedFormula}>
          Use the formula instead
        </Button>
      </div>
    );
  }

  const trendText =
    est.weightChangeKg === 0
      ? "held steady"
      : `${est.weightChangeKg < 0 ? "down" : "up"} ${Math.abs(est.weightChangeKg)} kg`;

  return (
    <div className="space-y-4">
      <div className="card-2 p-4">
        <p className="text-xs text-muted">Your estimated maintenance</p>
        <p className="font-display text-3xl font-bold">
          {est.expenditure.toLocaleString()}{" "}
          <span className="text-base font-medium text-muted">kcal/day</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          From {est.intakeDays} logged days over {est.daysCovered} days (weight{" "}
          {trendText}) · {CONFIDENCE_LABEL[est.confidence]}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">
          Weekly goal: {rateLabel(rate)}
        </p>
        <input
          type="range"
          min={-1}
          max={0.5}
          step={0.05}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>−1.0 (fast cut)</span>
          <span>0 (maintain)</span>
          <span>+0.5 (bulk)</span>
        </div>
      </div>

      {targets && (
        <div className="card-2 p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Preview label="Cals" value={targets.calories} />
            <Preview label="Protein" value={`${targets.protein_g}g`} />
            <Preview label="Carbs" value={`${targets.carbs_g}g`} />
            <Preview label="Fat" value={`${targets.fat_g}g`} />
          </div>
        </div>
      )}

      <Button
        block
        onClick={() => {
          if (!targets) return;
          localStorage.setItem(RATE_KEY, String(rate));
          onSave({
            goal_type: targets.goal_type,
            calories: targets.calories,
            protein_g: targets.protein_g,
            carbs_g: targets.carbs_g,
            fat_g: targets.fat_g,
          });
        }}
      >
        Save adaptive targets
      </Button>
    </div>
  );
}

function Calculator({
  unit,
  onSave,
}: {
  unit: "kg" | "lb";
  onSave: (t: {
    goal_type: GoalType;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }) => void;
}) {
  const [inp, setInp] = useState<SavedInputs>(loadInputs);
  const patch = (p: Partial<SavedInputs>) => setInp((s) => ({ ...s, ...p }));

  // Prefill weight from the most recent weigh-in, if there is one.
  useEffect(() => {
    getLatestWeightKg().then((kg) => {
      if (kg != null) setInp((s) => ({ ...s, weightKg: kg }));
    });
  }, []);

  const targets = useMemo(() => computeTargets(inp as TdeeInput), [inp]);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Sex</p>
        <Segmented<Sex>
          value={inp.sex}
          onChange={(v) => patch({ sex: v })}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
      </div>

      <Row label="Age">
        <Stepper value={inp.age} onChange={(v) => patch({ age: v })} min={13} max={100} />
      </Row>
      <Row label="Height (cm)">
        <Stepper
          value={inp.heightCm}
          onChange={(v) => patch({ heightCm: v })}
          min={120}
          max={230}
        />
      </Row>
      <Row label={`Weight (${unit})`}>
        <Stepper
          value={Number(toDisplayWeight(inp.weightKg, unit).toFixed(1))}
          onChange={(v) => patch({ weightKg: fromDisplayWeight(v, unit) })}
          step={unit === "lb" ? 1 : 0.5}
          decimals={1}
          min={30}
          max={400}
        />
      </Row>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Activity</p>
        <select
          value={inp.activity}
          onChange={(e) => patch({ activity: e.target.value as Activity })}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)", color: "inherit" }}
        >
          {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Goal</p>
        <Segmented<GoalType>
          value={inp.goal}
          onChange={(v) => patch({ goal: v })}
          options={GOALS}
        />
      </div>

      {/* Preview */}
      <div className="card-2 p-4">
        <p className="text-xs text-muted">
          Maintenance ≈ {targets.maintenance} kcal · target adjusts for your goal
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <Preview label="Cals" value={targets.calories} />
          <Preview label="Protein" value={`${targets.protein_g}g`} />
          <Preview label="Carbs" value={`${targets.carbs_g}g`} />
          <Preview label="Fat" value={`${targets.fat_g}g`} />
        </div>
      </div>

      <Button
        block
        onClick={() => {
          localStorage.setItem(TDEE_KEY, JSON.stringify(inp));
          onSave({
            goal_type: inp.goal,
            calories: targets.calories,
            protein_g: targets.protein_g,
            carbs_g: targets.carbs_g,
            fat_g: targets.fat_g,
          });
        }}
      >
        Save these targets
      </Button>
    </div>
  );
}

function Manual({
  initial,
  onSave,
}: {
  initial: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    water: number;
  };
  onSave: (v: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    water: number;
  }) => void;
}) {
  const [v, setV] = useState(initial);
  const patch = (p: Partial<typeof v>) => setV((s) => ({ ...s, ...p }));
  const implied = caloriesFromMacros(v.protein_g, v.carbs_g, v.fat_g);

  return (
    <div className="space-y-4">
      <Row label="Calories">
        <Stepper value={v.calories} onChange={(c) => patch({ calories: c })} step={50} min={0} max={8000} />
      </Row>
      <Row label="Protein (g)">
        <Stepper value={v.protein_g} onChange={(p) => patch({ protein_g: p })} step={5} min={0} max={500} />
      </Row>
      <Row label="Carbs (g)">
        <Stepper value={v.carbs_g} onChange={(c) => patch({ carbs_g: c })} step={5} min={0} max={800} />
      </Row>
      <Row label="Fat (g)">
        <Stepper value={v.fat_g} onChange={(f) => patch({ fat_g: f })} step={5} min={0} max={300} />
      </Row>
      <Row label="Water (ml)">
        <Stepper value={v.water} onChange={(w) => patch({ water: w })} step={250} min={0} max={8000} />
      </Row>
      <p className="text-xs text-muted">
        Macros imply ≈ {implied} kcal{" "}
        {Math.abs(implied - v.calories) > 100 && (
          <span style={{ color: "var(--color-carbs)" }}>
            (differs from your {v.calories} kcal target)
          </span>
        )}
      </p>
      <Button block onClick={() => onSave(v)}>
        Save targets
      </Button>
    </div>
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

function Preview({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
