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

async function tryGemini(
  kind: "briefing" | "recap" | "reaction",
  body: unknown,
): Promise<string | null> {
  if (!usingBackend() || !supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke<CoachResponse>("coach", {
      body: { kind, ...(body as object) },
    });
    // Don't silently swallow the reason — the coach function already tells us
    // WHY it fell back (no key, quota/429, deploy error). Surface it to the
    // console so a real workout leaves a trace, then degrade as before.
    if (error) {
      console.warn(`[coach] ${kind} invoke failed:`, error.message ?? error);
      return null;
    }
    if (!data) return null;
    if (data.error) console.warn(`[coach] ${kind} fell back:`, data.error);
    else if (data.fallback) console.warn(`[coach] ${kind} fell back: no Gemini key reached the server`);
    if (data.fallback || !data.text) return null;
    return data.text;
  } catch (e) {
    console.warn(`[coach] ${kind} threw:`, e);
    return null;
  }
}

export interface CoachAiTest {
  ok: boolean;
  /** Human-readable result: the AI's reply on success, or the exact failure reason. */
  detail: string;
}

/**
 * Fire one real `coach` call and report exactly what happened — powers the
 * Settings "Test coach AI" button so the owner can see WHY the AI does or
 * doesn't fire without running a whole workout. Distinguishes the failure modes
 * that all otherwise collapse into a silent "(rule-based)".
 */
export async function testCoachAI(): Promise<CoachAiTest> {
  if (!usingBackend() || !supabase) {
    return {
      ok: false,
      detail: "You're in demo mode (not signed in to the backend) — the AI coach only runs for a signed-in account.",
    };
  }
  try {
    const { data, error } = await supabase.functions.invoke<CoachResponse>("coach", {
      body: {
        kind: "recap",
        dayName: "Test",
        summary: "Summary: 3 working sets, 300 kg total volume, 0 PRs.",
      },
    });
    if (error) return { ok: false, detail: `Edge function error: ${error.message ?? String(error)}` };
    if (!data) return { ok: false, detail: "No response from the coach function (is it deployed?)." };
    if (data.text) return { ok: true, detail: data.text };
    if (data.error) return { ok: false, detail: data.error };
    if (data.fallback)
      return {
        ok: false,
        detail: "Function ran but found no Gemini key on the server — your saved key isn't reaching the profiles row.",
      };
    return { ok: false, detail: "Empty response from the coach function." };
  } catch (e) {
    return { ok: false, detail: `Call threw: ${String(e)}` };
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

/**
 * AI reaction to a single just-logged set (per-set reactions mode). `summary` is
 * a compact one-liner the caller builds with the real numbers. Returns null on
 * any failure — the caller shows an instant rule-based line first and upgrades to
 * this when it lands, so a slow call or a transient 503 never blocks logging.
 */
export async function getReaction(summary: string): Promise<string | null> {
  return tryGemini("reaction", { summary });
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
