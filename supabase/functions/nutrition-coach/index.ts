// ============================================================================
// Supabase Edge Function: nutrition-coach
// ----------------------------------------------------------------------------
// "Plan the rest of my day." Given the user's remaining macros, what they've
// already eaten, their usual foods, the time of day, and their goal, ask Gemini
// for a concrete, budget-friendly Tunisian plan for the meals still ahead — then
// keep the conversation going (follow-up messages). Runs server-side so the
// Gemini key never touches the browser (same pattern as `coach` / `food-text`).
//
// The key is read per-user from `profiles.gemini_api_key` using the caller's own
// JWT (RLS scopes it to their row). No key / quota → { fallback: true } and the
// client shows a rule-based mini-plan instead — the app never blocks.
//
// This is an ON-TAP feature only; it must never be called on passive screen
// loads (see HANDOFF 2026-08-14, the v0.6.0 quota-drain fix).
//
// DEPLOY (owner, one-time):  supabase functions deploy nutrition-coach
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// Moving alias — see the note in `coach` (a pinned 1.5 model was retired and
// 404'd every call).
const GEMINI_MODEL = "gemini-flash-latest";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface PlanContext {
  timeHHmm: string;
  goalLabel: string;
  remaining: Macros;
  targets: Macros;
  eatenToday: string[];
  habit: { avgCalories: number; avgProtein: number; topFoods: string[] };
}

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

interface Req {
  context: PlanContext;
  messages: ChatTurn[];
}

function macroLine(m: Macros): string {
  return `${Math.round(m.calories)} kcal, ${Math.round(m.protein_g)} g protein, ${Math.round(
    m.carbs_g,
  )} g carbs, ${Math.round(m.fat_g)} g fat`;
}

function buildSystem(ctx: PlanContext): string {
  return [
    "You are a warm, concise nutrition coach for someone living in Tunisia.",
    "Rules:",
    "- Halal only: never suggest pork or alcohol.",
    "- Prefer affordable, everyday Tunisian foods — eggs, tuna, lbenna/yogurt, bread, couscous, lentils/chickpeas, seasonal vegetables, chicken. Budget-friendly staples, not fancy imports. You do NOT know exact current prices, so speak in terms of cheap/humble foods, not dinar amounts.",
    "- Plan the meals that realistically REMAIN given the current time. Their usual pattern is 3 meals + an afternoon snack (breakfast before 10:00, lunch 12–14, afternoon snack 16–17, dinner 19–21). But CHECK what they have already eaten today — do not assume a meal happened just because its time has passed.",
    "- Prioritise hitting the remaining PROTEIN first, then fill the remaining calories; do not blow past the calorie target.",
    "- Give concrete foods with rough portions and an approximate protein/calorie figure per suggestion. Use their usual foods when they fit.",
    "- Keep it warm and brief: about 4–6 sentences. Light structure (one line per meal) is fine, but no markdown headings.",
    "",
    "Their situation right now:",
    `- Local time: ${ctx.timeHHmm}`,
    `- Goal: ${ctx.goalLabel}`,
    `- Daily targets: ${macroLine(ctx.targets)}`,
    `- Remaining today: ${macroLine(ctx.remaining)}`,
    `- Already eaten today: ${ctx.eatenToday.length ? ctx.eatenToday.join(", ") : "nothing logged yet"}`,
    `- Foods they eat often: ${ctx.habit.topFoods.length ? ctx.habit.topFoods.join(", ") : "not enough history yet"}`,
    `- Typical intake: ~${ctx.habit.avgCalories} kcal and ${ctx.habit.avgProtein} g protein per day`,
  ].join("\n");
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // Read the caller's own key with the service role — the forwarded user JWT
    // was unreliable for the RLS'd profiles SELECT, so a saved key read back
    // empty and the AI silently fell back. Scoped to user.id; the service-role
    // secret never leaves the server. (See coach/index.ts for the full note.)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return json({ fallback: true, error: "server misconfigured: no SUPABASE_SERVICE_ROLE_KEY" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data: profile, error: readErr } = await admin
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .maybeSingle();
    if (readErr) return json({ fallback: true, error: `profiles read failed: ${readErr.message}` });
    const key = profile?.gemini_api_key ?? Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ fallback: true, error: profile ? "gemini_api_key empty — re-save in Settings" : "no profiles row" });

    const body = (await request.json()) as Req;
    if (!body?.context) return json({ error: "no context" }, 400);

    // Map the conversation to Gemini's multi-turn format. It must start with a
    // user turn and alternate; our transcript naturally does (user → model → …).
    const turns = (body.messages ?? []).filter((m) => m.text?.trim());
    const contents = (turns.length
      ? turns
      : [{ role: "user" as const, text: "Plan the rest of my day." }]
    ).map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystem(body.context) }] },
          contents,
          // gemini-flash-latest is a "thinking" model. Unbounded, its reasoning
          // is slow (the tap feels dead / can time out) AND is drawn from
          // maxOutputTokens, so it routinely ate the whole budget and returned
          // empty text → the rule-based fallback. Disable thinking for a fast,
          // reliable plan; 768 tokens is ample for the ~4–6 sentence answer.
          // Prose out, so no responseMimeType.
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 768,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      return json({ fallback: true, error: `gemini ${res.status}: ${detail.slice(0, 200)}` });
    }
    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return json({ text: text ?? null, fallback: !text });
  } catch (e) {
    return json({ fallback: true, error: String(e) }, 200);
  }
});
