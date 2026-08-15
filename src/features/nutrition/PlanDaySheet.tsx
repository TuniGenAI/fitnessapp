/**
 * "Plan the rest of my day" — the on-tap nutrition coach.
 *
 * Snapshots the day's remaining macros + what's been eaten + a habit digest,
 * asks the `nutrition-coach` edge function for a budget-friendly Tunisian plan
 * for the meals still ahead, and lets the owner keep chatting. Falls back to a
 * rule-based plan (coachLogic.fallbackPlan) in demo mode, with no key, or on a
 * quota/AI error — the feature never dead-ends. On-tap only (never on load).
 */
import { useEffect, useRef, useState } from "react";
import type { FoodLog, Goals } from "@/types";
import { Sheet, Button, Spinner } from "@/components/ui";
import {
  planRestOfDay,
  getHabitDigest,
  type Macros,
  type ChatTurn,
  type PlanContext,
  type HabitDigest,
} from "./api";
import { fallbackPlan, goalLabel } from "./coachLogic";

const EMPTY_HABIT: HabitDigest = { avgCalories: 0, avgProtein: 0, topFoods: [] };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function PlanDaySheet({
  open,
  onClose,
  goals,
  totals,
  logs,
}: {
  open: boolean;
  onClose: () => void;
  goals: Goals;
  totals: Macros;
  logs: FoodLog[];
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  /** Muted note (demo/no-key) or the AI error hint (bad key / quota). */
  const [note, setNote] = useState<string | null>(null);
  const habitRef = useRef<HabitDigest>(EMPTY_HABIT);
  const scrollRef = useRef<HTMLDivElement>(null);

  const targets: Macros = {
    calories: goals.calorie_target ?? 0,
    protein_g: goals.protein_target_g ?? 0,
    carbs_g: goals.carbs_target_g ?? 0,
    fat_g: goals.fat_target_g ?? 0,
  };
  const remaining: Macros = {
    calories: targets.calories - totals.calories,
    protein_g: targets.protein_g - totals.protein_g,
    carbs_g: targets.carbs_g - totals.carbs_g,
    fat_g: targets.fat_g - totals.fat_g,
  };

  function buildContext(): PlanContext {
    const now = new Date();
    const eatenToday = [
      ...new Set(logs.map((l) => l.name.trim()).filter(Boolean)),
    ].slice(0, 20);
    return {
      timeHHmm: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      goalLabel: goalLabel(goals.goal_type),
      remaining,
      targets,
      eatenToday,
      habit: habitRef.current,
    };
  }

  async function runSend(userText: string, prior: ChatTurn[]) {
    const next: ChatTurn[] = [...prior, { role: "user", text: userText }];
    setMessages(next);
    setLoading(true);
    setNote(null);
    const ctx = buildContext();
    try {
      const text = await planRestOfDay(ctx, next);
      if (text) {
        setMessages([...next, { role: "model", text }]);
      } else {
        // No backend / no key → rule-based plan.
        setMessages([...next, { role: "model", text: fallbackPlan(ctx.remaining, ctx.timeHHmm) }]);
        setNote(
          "Simple rule-based plan (demo mode or no Gemini key). Add a key in Settings for tailored coaching.",
        );
      }
    } catch (e) {
      // Real AI error (bad key / quota) — still give the rule-based plan, but
      // surface the actual reason.
      setMessages([...next, { role: "model", text: fallbackPlan(ctx.remaining, ctx.timeHHmm) }]);
      setNote(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // On open: load the habit digest, then fire the first plan automatically.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        habitRef.current = await getHabitDigest();
      } catch {
        habitRef.current = EMPTY_HABIT;
      }
      if (!alive) return;
      await runSend("Plan the rest of my day.", []);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function onSubmit() {
    const t = input.trim();
    if (!t || loading) return;
    setInput("");
    runSend(t, messages);
  }

  const gap = (n: number) => Math.max(0, Math.round(n));

  return (
    <Sheet open={open} onClose={onClose} title="Plan the rest of my day">
      {/* Gap summary — client-side, no AI. */}
      <p className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--color-surface-2)" }}>
        <span className="text-muted">Left today: </span>
        <span className="font-semibold">{gap(remaining.calories)} kcal</span>
        {" · "}
        <span className="font-semibold">{gap(remaining.protein_g)} g protein</span>
        {" · "}
        {gap(remaining.carbs_g)} g carbs · {gap(remaining.fat_g)} g fat
      </p>

      <div ref={scrollRef} className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
              m.role === "user" ? "ml-auto" : ""
            }`}
            style={
              m.role === "user"
                ? { background: "var(--color-brand)", color: "#fff" }
                : { background: "var(--color-surface-2)" }
            }
          >
            {m.text}
          </div>
        ))}
        {loading && <Spinner />}
      </div>

      {note && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
          {note}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Ask a follow-up (e.g. no chicken today)"
          className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--color-surface-2)" }}
          disabled={loading}
        />
        <Button onClick={onSubmit} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </Sheet>
  );
}
