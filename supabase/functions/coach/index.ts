// ============================================================================
// Supabase Edge Function: coach
// ----------------------------------------------------------------------------
// The AI coach runs HERE, server-side, so the Gemini API key never touches the
// browser (CLAUDE.md §3, §7). The user's key is stored per-user in their
// `profiles.gemini_api_key` row; this function reads it using the caller's own
// JWT (RLS ensures they can only read their own row), builds a token-frugal
// prompt, calls Gemini, and returns text.
//
// Graceful degradation: if the user has no key, we return { fallback: true } and
// the client uses its rule-based briefing/recap instead — the app never blocks.
//
// DEPLOY (owner, one-time):
//   supabase functions deploy coach
// The frontend calls it via supabase.functions.invoke('coach', { body }).
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// `gemini-flash-latest` is a moving alias to Google's current flash model, so a
// future model retirement won't 404 the way the pinned `gemini-1.5-flash-latest`
// did (the 1.5 line was shut down and returned 404 for every request).
const GEMINI_MODEL = "gemini-flash-latest";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CoachRequest {
  kind: "briefing" | "recap" | "reaction" | "plan";
  // Compact context — only what the coach needs (keeps us in the free tier).
  dayName?: string;
  goal?: string | null;
  bodyweightKg?: number | null;
  unit?: string; // "kg" | "lb" — the unit all weights below are expressed in (plan)
  exercises?: {
    name: string;
    target?: string; // e.g. "4 × 5–8"
    lastTime?: string; // e.g. "60 kg × 8"
    suggestion?: string; // e.g. "62.5 kg × 5"
  }[];
  summary?: string; // for recap/reaction
  history?: string; // recent recaps, for cross-session continuity
}

/**
 * The `plan` kind is the pre-workout coach: it reads each exercise's history +
 * the rule engine's suggested next target (the "anchor") and returns a STRUCTURED
 * plan — a motivating intro plus, per exercise, a next weight×reps and a one-line
 * reason. The client clamps every number back to a safe band around the anchor,
 * so the JSON here is a proposal, never the final word (hybrid guardrail).
 */
function buildPlanPrompt(req: CoachRequest): string {
  const unit = req.unit === "lb" ? "lb" : "kg";
  const lines: string[] = [];
  lines.push(
    `You are a sharp, upbeat strength coach planning today's session. Every set the athlete logs is taken to MUSCULAR FAILURE, so the reps shown are their true max at that weight (there is no RPE — judge effort purely from weight and reps). All weights are in ${unit}.`,
  );
  lines.push(
    "Progressive-overload logic: if last time they reached the TOP of the target rep range, add load and reset toward the bottom of the range; if they fell short of the top, keep the weight and chase one more rep; if they blew well past the top, a slightly bigger jump is warranted.",
  );
  lines.push(
    `Each exercise below lists its target set×rep scheme, last session's working sets, and a rule-engine SUGGESTION. Treat the suggestion as your anchor: stay close to it and only deviate when the real numbers clearly justify it — never move the weight more than about two increments (~5 ${unit}) from it, and keep reps inside the target range.`,
  );
  if (req.dayName) lines.push(`Session: ${req.dayName}.`);
  if (req.goal) lines.push(`Goal: ${req.goal}.`);
  if (req.bodyweightKg) lines.push(`Bodyweight: ${req.bodyweightKg} kg.`);
  lines.push("Exercises (use the leading index in your output):");
  (req.exercises ?? []).forEach((e, i) => {
    lines.push(
      `${i}. ${e.name}${e.target ? ` (target ${e.target})` : ""}${
        e.lastTime ? `, last time ${e.lastTime}` : ", no prior data"
      }${e.suggestion ? `, suggestion ${e.suggestion}` : ""}`,
    );
  });
  lines.push(
    `Return ONLY JSON of the form {"intro": "<one short, motivating sentence for the whole session>", "exercises": [{"index": <number matching the input>, "weight": <number in ${unit}>, "reps": <number inside the target rep range>, "why": "<one concise sentence citing the real reps/weight and the progression logic>"}]}. Include one object per exercise, in the same order.`,
  );
  // House style: the intro/why prose is shown in-app; never use em dashes.
  lines.push("Style for intro and why: do not use em dashes. Use commas, periods, or parentheses instead.");
  return lines.join("\n");
}

function buildPrompt(req: CoachRequest): string {
  if (req.kind === "plan") return buildPlanPrompt(req);
  const lines: string[] = [];
  if (req.kind === "briefing") {
    lines.push(
      "You are an upbeat, concise strength coach. Write a short pre-workout briefing (2-3 sentences, no lists, no markdown). Motivate and highlight one concrete progression to chase today.",
    );
  } else if (req.kind === "recap") {
    lines.push(
      "You are an upbeat, concise strength coach. Write a short post-workout recap (2-3 sentences, no markdown). Celebrate wins and give one focus for next time.",
    );
  } else {
    lines.push(
      "You are an upbeat, specific strength coach. React to the set just completed in ONE short sentence (no markdown, no emoji spam). Drive progressive overload using the ACTUAL numbers: if they fell short of the top of the rep range, nudge one more rep or a small load bump next set; if they hit or beat it, tell them to add load next time. Reference the real reps/weight, never generic filler like \"keep going\".",
    );
  }
  // House style: never use em dashes in the reply (product-wide rule).
  lines.push("Style: do not use em dashes anywhere. Use commas, periods, or parentheses instead.");
  if (req.dayName) lines.push(`Session: ${req.dayName}.`);
  if (req.goal) lines.push(`Goal: ${req.goal}.`);
  if (req.bodyweightKg) lines.push(`Bodyweight: ${req.bodyweightKg} kg.`);
  if (req.exercises?.length) {
    lines.push("Plan:");
    for (const e of req.exercises) {
      lines.push(
        `- ${e.name}${e.target ? ` (target ${e.target})` : ""}${
          e.lastTime ? `, last time ${e.lastTime}` : ""
        }${e.suggestion ? `, aim ${e.suggestion}` : ""}`,
      );
    }
  }
  if (req.summary) lines.push(req.summary);
  if (req.history) {
    lines.push(
      "Recent sessions (reference the trend, a stall, a streak, or steady progress, don't just repeat it):",
    );
    lines.push(req.history);
  }
  return lines.join("\n");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = request.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;

    // 1) Authenticate the caller with THEIR token (just to learn who they are).
    const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    // 2) Read the caller's OWN key with the service role. Reading via the
    //    forwarded user JWT was unreliable here — when the token didn't reach
    //    PostgREST the RLS'd SELECT returned nothing, so a saved key looked
    //    absent and the coach silently fell back to rule-based ("AI didn't
    //    fire: no key on the server"). The service role bypasses RLS; we still
    //    scope the read to `user.id`, so a caller can only ever get their own
    //    key. The service-role secret never leaves the server.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return json({ fallback: true, error: "server misconfigured: no SUPABASE_SERVICE_ROLE_KEY" });
    }
    const admin = createClient(url, serviceKey);
    const { data: profile, error: readErr } = await admin
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .maybeSingle();
    if (readErr) {
      return json({ fallback: true, error: `profiles read failed: ${readErr.message}` });
    }

    const key = profile?.gemini_api_key ?? Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      return json({
        fallback: true,
        error: profile
          ? "profiles row found but gemini_api_key is empty — re-save your key in Settings"
          : "no profiles row for this user",
      });
    }

    const body = (await request.json()) as CoachRequest;
    const prompt = buildPrompt(body);
    const isPlan = body.kind === "plan";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // `gemini-flash-latest` resolves to a "thinking" model. Left unbounded,
          // its internal reasoning both (a) takes many seconds — long enough that
          // the call feels dead / can time out — and (b) is drawn from
          // maxOutputTokens, so it routinely ate the whole 2048 budget and
          // returned EMPTY text (surfaced as the rule-based fallback / "AI didn't
          // work"). Disabling thinking makes the coach fast and reliable; the
          // prompt already keeps the prose short so no reasoning headroom is lost.
          // The plan needs a bit more room (structured JSON over several
          // exercises) and asks for machine-readable JSON directly.
          generationConfig: {
            temperature: isPlan ? 0.6 : 0.8,
            maxOutputTokens: isPlan ? 800 : 512,
            thinkingConfig: { thinkingBudget: 0 },
            ...(isPlan ? { responseMimeType: "application/json" } : {}),
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

    if (isPlan) {
      // Parse the structured plan. A malformed/empty response degrades to
      // fallback so the client keeps its rule-based prefill — never blocks.
      if (!text) return json({ fallback: true, error: "empty plan from gemini" });
      try {
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.exercises)) {
          return json({ fallback: true, error: "plan JSON missing exercises[]" });
        }
        return json({ plan: parsed });
      } catch (e) {
        return json({ fallback: true, error: `plan parse failed: ${String(e).slice(0, 120)}` });
      }
    }

    return json({ text: text ?? null, fallback: !text });
  } catch (e) {
    return json({ fallback: true, error: String(e) }, 200);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
