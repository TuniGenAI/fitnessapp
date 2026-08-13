import { useCallback, useEffect, useMemo, useState } from "react";
import type { Food, FoodLog, MealType } from "@/types";
import { useProfile } from "@/features/profile/ProfileProvider";
import { MacroRing } from "@/components/MacroRing";
import {
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Sheet,
  Stepper,
  AddButton,
} from "@/components/ui";
import { AppleIcon, PlusIcon, TrashIcon, DropletIcon, SettingsIcon } from "@/components/icons";
import {
  listFoodLogs,
  sumFoodLogs,
  deleteFoodLog,
  getWaterMl,
  addWater,
  listFoods,
  listMeals,
  createMeal,
  deleteMeal,
  logMeal,
  type MealWithItems,
} from "./api";
import { AddFoodSheet } from "./AddFoodSheet";
import { GoalsEditor } from "./GoalsEditor";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function NutritionPage() {
  const { goals, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [water, setWater] = useState(0);
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [makingMeal, setMakingMeal] = useState(false);

  const load = useCallback(async () => {
    try {
      // allSettled so one failing query can't blank the whole screen.
      const [l, w, m] = await Promise.allSettled([listFoodLogs(), getWaterMl(), listMeals()]);
      if (l.status === "fulfilled") setLogs(l.value);
      if (w.status === "fulfilled") setWater(w.value);
      if (m.status === "fulfilled") setMeals(m.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => sumFoodLogs(logs), [logs]);
  const hasGoals = Boolean(goals?.calorie_target);
  const waterGoal = goals?.water_target_ml ?? 3000;

  async function quickWater(ml: number) {
    setWater((w) => w + ml); // optimistic
    try {
      await addWater(ml);
    } catch {
      /* schema cache / offline — keep the optimistic value */
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fuel"
        Icon={AppleIcon}
        action={
          <button
            onClick={() => setEditingGoals(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "var(--color-surface-2)", color: "var(--color-brand)" }}
            aria-label="Nutrition goals"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        }
      />

      {loading || profileLoading ? (
        <Spinner />
      ) : (
        <>
          {/* Rings */}
          {hasGoals ? (
            <section className="card p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MacroRing label="Calories" value={totals.calories} goal={goals!.calorie_target ?? 0} unit="" color="var(--color-calories)" />
                <MacroRing label="Protein" value={totals.protein_g} goal={goals!.protein_target_g ?? 0} color="var(--color-protein)" />
                <MacroRing label="Carbs" value={totals.carbs_g} goal={goals!.carbs_target_g ?? 0} color="var(--color-carbs)" />
                <MacroRing label="Fat" value={totals.fat_g} goal={goals!.fat_target_g ?? 0} color="var(--color-fat)" />
              </div>
            </section>
          ) : (
            <EmptyState
              Icon={AppleIcon}
              title="Set your nutrition goals"
              hint="Use the TDEE calculator or enter targets manually to unlock macro tracking."
              action={<Button onClick={() => setEditingGoals(true)}>Set goals</Button>}
            />
          )}

          {/* Water */}
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
                <DropletIcon className="h-4 w-4" style={{ color: "var(--color-water)" }} /> Water
              </h2>
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

          {/* Log food */}
          <Button block onClick={() => setAdding(true)}>
            <PlusIcon className="h-4 w-4" /> Log food
          </Button>

          {/* Today's log grouped by meal */}
          <FoodLogList logs={logs} onDelete={async (id) => { await deleteFoodLog(id); await load(); }} />

          {/* Saved meals */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Saved meals</h2>
            </div>
            {meals.length === 0 ? (
              <p className="text-sm text-muted">
                Save a combo of foods as a meal for one-tap logging.
              </p>
            ) : (
              meals.map((m) => (
                <div key={m.meal.id} className="card flex items-center gap-2 p-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={async () => {
                      await logMeal(m.meal.id);
                      await load();
                    }}
                  >
                    <p className="truncate font-semibold">{m.meal.name}</p>
                    <p className="truncate text-xs text-muted">
                      {m.items.length} items · {Math.round(m.totals.calories)} kcal · tap to log
                    </p>
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete meal "${m.meal.name}"?`)) return;
                      await deleteMeal(m.meal.id);
                      await load();
                    }}
                    className="text-muted"
                    aria-label="Delete meal"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
            <AddButton label="Create a meal" onClick={() => setMakingMeal(true)} />
          </section>
        </>
      )}

      {adding && (
        <AddFoodSheet open onClose={() => setAdding(false)} onLogged={load} />
      )}
      {editingGoals && <GoalsEditor open onClose={() => setEditingGoals(false)} />}
      {makingMeal && (
        <CreateMealSheet
          open
          onClose={() => setMakingMeal(false)}
          onCreated={async () => {
            setMakingMeal(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function FoodLogList({
  logs,
  onDelete,
}: {
  logs: FoodLog[];
  onDelete: (id: string) => void;
}) {
  if (logs.length === 0) {
    return (
      <p className="py-2 text-center text-sm text-muted">
        Nothing logged today yet. Tap “Log food” to start.
      </p>
    );
  }
  const byMeal = new Map<MealType | "other", FoodLog[]>();
  for (const l of logs) {
    const key = (l.meal_type ?? "other") as MealType | "other";
    const arr = byMeal.get(key) ?? [];
    arr.push(l);
    byMeal.set(key, arr);
  }
  const groups = [...MEAL_ORDER, "other" as const].filter((k) => byMeal.has(k));

  return (
    <div className="space-y-3">
      {groups.map((key) => {
        const items = byMeal.get(key)!;
        const cals = items.reduce((s, l) => s + l.calories, 0);
        return (
          <section key={key} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {key === "other" ? "Other" : MEAL_LABEL[key]}
              </h3>
              <span className="text-xs text-muted">{cals} kcal</span>
            </div>
            <ul className="space-y-1.5">
              {items.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--color-surface-2)" }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {l.name}
                      {l.servings !== 1 && (
                        <span className="text-muted"> ×{l.servings}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {l.calories} kcal · P{l.protein_g} C{l.carbs_g} F{l.fat_g}
                    </p>
                  </div>
                  <button onClick={() => onDelete(l.id)} className="text-muted" aria-label="Delete">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CreateMealSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listFoods().then(setFoods);
  }, []);

  const chosen = Object.entries(picked).filter(([, s]) => s > 0);

  return (
    <Sheet open={open} onClose={onClose} title="Create a meal">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Meal name (e.g. Post-workout shake)"
        className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--color-surface-2)" }}
      />
      {!foods ? (
        <Spinner />
      ) : foods.length === 0 ? (
        <p className="text-sm text-muted">
          Save some foods first (Log food → Custom), then bundle them into a meal.
        </p>
      ) : (
        <div className="space-y-1.5">
          {foods.map((f) => {
            const s = picked[f.id] ?? 0;
            return (
              <div
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                style={{ background: "var(--color-surface-2)" }}
              >
                <span className="min-w-0 truncate text-sm font-medium">{f.name}</span>
                <div className="w-32 shrink-0">
                  <Stepper
                    value={s}
                    onChange={(v) => setPicked((p) => ({ ...p, [f.id]: Math.max(0, v) }))}
                    step={0.5}
                    min={0}
                    decimals={1}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Button
        block
        className="mt-4"
        disabled={!name.trim() || chosen.length === 0 || saving}
        onClick={async () => {
          setSaving(true);
          try {
            await createMeal(
              name,
              chosen.map(([food_id, servings]) => ({ food_id, servings })),
            );
            onCreated();
          } finally {
            setSaving(false);
          }
        }}
      >
        <PlusIcon className="h-4 w-4" /> Save meal
      </Button>
    </Sheet>
  );
}
