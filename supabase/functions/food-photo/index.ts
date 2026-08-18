// ============================================================================
// Supabase Edge Function: food-photo
// ----------------------------------------------------------------------------
// Photo → macro estimate, via Gemini vision — server-side so the key never
// touches the browser (same pattern as the `coach` function). The client sends
// a base64 image; we ask Gemini for a compact JSON macro estimate and return it
// for the user to confirm before logging.
//
// Graceful degradation: no key → { fallback: true } and the client tells the
// user to add a Gemini key (or just log manually).
//
// DEPLOY (owner, one-time):  supabase functions deploy food-photo
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
  "You are a nutrition estimator. Estimate the macros of the food shown, for the " +
  "portion visible in the image. Respond with ONLY compact JSON, no prose, no code " +
  'fences: {"name":string,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}. ' +
  "Use grams for macros and total kcal for the whole visible portion.";

// The user can add a free-text hint about what's actually in the photo (the
// camera often can't tell chicken from turkey, or that a sauce is included).
// Trust the note to resolve ambiguity, but still read quantities/portion from
// the image unless the note overrides them.
const NOTE_PREFIX =
  "\n\nThe user describes what's in the photo — treat this as authoritative for " +
  "identifying the food and any hidden ingredients, and use it to correct what the " +
  "image alone would suggest:\n";

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

    const { imageBase64, mimeType, note } = (await request.json()) as {
      imageBase64: string;
      mimeType?: string;
      note?: string;
    };
    if (!imageBase64) return json({ error: "no image" }, 400);

    const promptText =
      note && note.trim() ? PROMPT + NOTE_PREFIX + note.trim() : PROMPT;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mimeType ?? "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          // See food-text: `gemini-flash-latest` is a thinking model. Unbounded
          // thinking is slow (feels dead) and eats maxOutputTokens, returning
          // empty text ("no json"). Disable thinking + force JSON for a fast,
          // reliable estimate.
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!res.ok) {
      return json({ fallback: true, error: `gemini ${res.status}` });
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ fallback: true, error: "no json" });
    try {
      const parsed = JSON.parse(match[0]);
      return json({
        food: {
          name: String(parsed.name ?? "Estimated food"),
          calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
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
