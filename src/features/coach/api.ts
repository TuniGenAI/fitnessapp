/**
 * Coach client. Tries the Gemini edge function when the user has AI enabled +
 * a key; otherwise (and on any error) uses the rule-based text in `logic.ts`.
 * Either way the caller gets a string — the app never blocks on AI.
 */
import { supabase } from "@/lib/supabase";
import { usingBackend, getUserId } from "@/lib/session";
import { insertRow, selectRows } from "@/lib/repo";
import type { CoachMessage, CoachRole } from "@/types";
import {
  buildBriefing,
  buildRecap,
  type BriefingContext,
  type RecapContext,
} from "./logic";

interface CoachResponse {
  text?: string | null;
  fallback?: boolean;
  error?: string;
}

async function tryGemini(kind: "briefing" | "recap", body: unknown): Promise<string | null> {
  if (!usingBackend() || !supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke<CoachResponse>("coach", {
      body: { kind, ...(body as object) },
    });
    if (error || !data || data.fallback || !data.text) return null;
    return data.text;
  } catch {
    return null;
  }
}

export async function getBriefing(
  ctx: BriefingContext,
  useAI: boolean,
): Promise<{ text: string; ai: boolean }> {
  if (useAI) {
    const ai = await tryGemini("briefing", {
      dayName: ctx.dayName,
      exercises: ctx.exercises.map((e) => ({
        name: e.name,
        target: e.target,
        lastTime: e.lastTime,
        suggestion: e.suggestion,
      })),
    });
    if (ai) return { text: ai, ai: true };
  }
  return { text: buildBriefing(ctx), ai: false };
}

export async function getRecap(
  ctx: RecapContext,
  useAI: boolean,
): Promise<{ text: string; ai: boolean }> {
  // An empty session (nothing lifted) gets the honest rule-based line — no AI
  // call, so the coach never congratulates "0 kg moved".
  if (useAI && ctx.workingSets > 0 && ctx.totalVolumeKg > 0) {
    // Cross-session memory (ROADMAP #10): give the AI a compact digest of the
    // last couple of recaps so it can reference a multi-week narrative rather
    // than reacting to today in isolation.
    const history = await recentRecapDigest();
    const ai = await tryGemini("recap", {
      dayName: ctx.dayName,
      summary: `Summary: ${ctx.workingSets} working sets, ${Math.round(
        ctx.totalVolumeKg,
      )} kg total volume, ${ctx.prCount} PRs${
        ctx.topExercise ? `, top ${ctx.topExercise.name} ${ctx.topExercise.best}` : ""
      }.${ctx.trainedThisWeek ? ` ${ctx.trainedThisWeek} sessions this week.` : ""}`,
      history,
    });
    if (ai) return { text: ai, ai: true };
  }
  return { text: buildRecap(ctx), ai: false };
}

/** Best-effort persistence of a coach message (non-fatal on failure). */
export async function saveCoachMessage(
  role: CoachRole,
  content: string,
  workoutId?: string,
): Promise<void> {
  const uid = getUserId();
  if (!uid) return;
  try {
    await insertRow<CoachMessage>("coach_messages", {
      user_id: uid,
      workout_id: workoutId ?? null,
      role,
      content,
    });
  } catch {
    /* non-fatal */
  }
}

export async function listCoachMessages(workoutId?: string): Promise<CoachMessage[]> {
  const uid = getUserId();
  if (!uid) return [];
  const filter: Record<string, unknown> = { user_id: uid };
  if (workoutId) filter.workout_id = workoutId;
  const rows = await selectRows<CoachMessage>("coach_messages", filter);
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Compact digest of the last couple of recaps for the AI's cross-session memory.
 * Kept short (prose model, quota-frugal) and best-effort — empty string on any
 * failure so the recap call is never blocked by it.
 */
async function recentRecapDigest(limit = 2): Promise<string> {
  try {
    const msgs = (await listCoachMessages())
      .filter((m) => m.role === "recap")
      .slice(0, limit);
    if (msgs.length === 0) return "";
    return msgs
      .map((m) => `• ${m.content.slice(0, 160)}`)
      .join("\n");
  } catch {
    return "";
  }
}
