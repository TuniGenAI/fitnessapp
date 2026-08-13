// ============================================================================
// Supabase Edge Function: food-text
// ----------------------------------------------------------------------------
// Free-text meal description → macro estimate, via Gemini — server-side so the
// key never touches the browser (same pattern as `food-photo`). The client
// sends a sentence like "2 eggs, toast with butter, a banana"; we ask Gemini
// for ONE compact JSON estimate summing the whole meal, plus a short name, and
// return it for the user to confirm (and optionally save) before logging.
//
// Graceful degradation: no key → { fallback: true } and the client tells the
// user to add a Gemini key (or log manually).
//
// DEPLOY (owner, one-time):  supabase functions deploy food-text
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// See note in `coach` — moving alias so a model retirement won't 404 us again.
const GEMINI_MODEL = "gemini-flash-latest";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT =
  "You are a nutrition estimator. The user describes a meal in free text, possibly " +
  "several items with rough quantities. Estimate the TOTAL macros for the whole meal " +
  "as described (sum every item). Also give a short, human meal name (max 5 words). " +
  "Respond with ONLY compact JSON, no prose, no code fences: " +
  '{"name":string,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}. ' +
  "Use grams for macros and total kcal for the whole meal. If the text is not food, " +
  'return {"name":"","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}.';

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .maybeSingle();
    const key = profile?.gemini_api_key ?? Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ fallback: true });

    const { text } = (await request.json()) as { text?: string };
    if (!text || !text.trim()) return json({ error: "no text" }, 400);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${PROMPT}\n\nMeal: ${text.trim()}` }] }],
          // `gemini-flash-latest` is a "thinking" model: internal reasoning draws
          // from maxOutputTokens, so a tight 200 cap left nothing for the answer
          // and the reply came back empty ("no json"). Give thinking + output room,
          // and force JSON so we never depend on the model avoiding code fences.
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!res.ok) {
      return json({ fallback: true, error: `gemini ${res.status}` });
    }
    const data = await res.json();
    const out: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = out.match(/\{[\s\S]*\}/);
    if (!match) return json({ fallback: true, error: "no json" });
    try {
      const parsed = JSON.parse(match[0]);
      const calories = Math.max(0, Math.round(Number(parsed.calories) || 0));
      if (calories === 0 && !parsed.name) {
        // Model decided this wasn't food.
        return json({ fallback: true, error: "not food" });
      }
      return json({
        food: {
          name: String(parsed.name || "Meal"),
          calories,
          protein_g: Math.max(0, Math.round(Number(parsed.protein_g) || 0)),
          carbs_g: Math.max(0, Math.round(Number(parsed.carbs_g) || 0)),
          fat_g: Math.max(0, Math.round(Number(parsed.fat_g) || 0)),
        },
      });
    } catch {
      return json({ fallback: true, error: "parse failed" });
    }
  } catch (e) {
    return json({ fallback: true, error: String(e) }, 200);
  }
});
