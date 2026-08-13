/**
 * Profile + goals data access (units, coach settings, nutrition targets).
 * Backend when signed in; local demo store otherwise.
 */
import { supabase } from "@/lib/supabase";
import { getUserId, usingBackend } from "@/lib/session";
import { localDb } from "@/lib/localDb";
import type {
  Profile,
  ProfileUpdate,
  Goals,
  GoalsUpdate,
} from "@/types";

/**
 * Self-test for the "saves but vanishes on refresh" bug. Runs in the user's own
 * authenticated session: reads their profile rows, writes a marker, re-reads it,
 * then restores the original key. The output pinpoints WHERE the value is lost —
 * write vs persistence vs session mismatch — without needing DB access.
 */
export async function diagnoseProfilePersistence(): Promise<string> {
  const uid = getUserId();
  const out: string[] = [];
  const sess = await supabase?.auth.getSession();
  const authId = sess?.data.session?.user?.id ?? null;
  out.push(`app uid: ${uid ?? "—"}`);
  out.push(`auth session uid: ${authId ?? "—"}`);
  out.push(`uid matches session: ${uid === authId ? "yes" : "NO ⚠︎"}`);
  out.push(`usingBackend: ${usingBackend()}`);
  if (!usingBackend() || !supabase || !uid) {
    out.push("Not signed in to the backend — nothing to test.");
    return out.join("\n");
  }

  // 1) What rows can this session actually see?
  const { data: rows, error: rErr } = await supabase
    .from("profiles")
    .select("id, gemini_api_key, updated_at");
  if (rErr) out.push(`READ error: ${rErr.message} [${rErr.code}]`);
  out.push(`profile rows visible: ${rows?.length ?? 0}`);
  for (const r of rows ?? []) {
    out.push(
      `  • id ${String(r.id).slice(0, 8)}…  key=${r.gemini_api_key ? "SET" : "empty"}  updated=${r.updated_at ?? "?"}`,
    );
  }
  const original = (rows ?? []).find((r) => r.id === uid)?.gemini_api_key ?? null;

  // 2) Write a unique marker, capturing what the write RETURNS.
  const marker = `diag-${Date.now()}`;
  const { data: wrote, error: wErr } = await supabase
    .from("profiles")
    .update({ gemini_api_key: marker })
    .eq("id", uid)
    .select("gemini_api_key")
    .maybeSingle();
  if (wErr) out.push(`WRITE error: ${wErr.message} [${wErr.code}]`);
  else out.push(`write returned: ${wrote?.gemini_api_key ?? "null (0 rows)"}`);

  // 3) Fresh, independent re-read — did the marker actually persist?
  const { data: after, error: aErr } = await supabase
    .from("profiles")
    .select("gemini_api_key")
    .eq("id", uid)
    .maybeSingle();
  if (aErr) out.push(`RE-READ error: ${aErr.message} [${aErr.code}]`);
  else {
    const ok = after?.gemini_api_key === marker;
    out.push(`re-read after write: ${after?.gemini_api_key ?? "null"}`);
    out.push(`>>> ${ok ? "PERSISTED ✓ (write works — problem is on load)" : "NOT PERSISTED ✗ (DB is rejecting the write)"}`);
  }

  // Restore the original key so the test doesn't clobber it.
  await supabase.from("profiles").update({ gemini_api_key: original }).eq("id", uid);
  return out.join("\n");
}

export async function getProfile(): Promise<Profile | null> {
  const uid = getUserId();
  if (!uid) return null;
  if (usingBackend()) {
    const { data, error } = await supabase!
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return localDb.first<Profile>("profiles", { id: uid });
}

export async function updateProfile(patch: ProfileUpdate): Promise<Profile | null> {
  const uid = getUserId();
  if (!uid) return null;
  if (usingBackend()) {
    // Read-then-write by primary key: UPDATE if the row exists, INSERT if it
    // doesn't (e.g. the account predates the new-user trigger). This avoids
    // relying on onConflict/constraints and, crucially, treats "update matched
    // 0 rows" as a hard error — otherwise a save blocked by RLS looks like it
    // succeeded but nothing persists.
    const { data: existing, error: readErr } = await supabase!
      .from("profiles")
      .select("id")
      .eq("id", uid)
      .maybeSingle();
    if (readErr) throw readErr;

    if (existing) {
      const { data, error } = await supabase!
        .from("profiles")
        .update(patch)
        .eq("id", uid)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "Update saved 0 rows — a row-level security policy is blocking updates on 'profiles'.",
        );
      return data;
    }
    const { data, error } = await supabase!
      .from("profiles")
      .insert({ id: uid, ...patch })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const existing = localDb.first<Profile>("profiles", { id: uid });
  if (existing) return localDb.update<Profile>("profiles", uid, patch as Partial<Profile>);
  return localDb.insert<Profile>("profiles", { id: uid, ...(patch as Partial<Profile>) });
}

export async function getGoals(): Promise<Goals | null> {
  const uid = getUserId();
  if (!uid) return null;
  if (usingBackend()) {
    // order+limit(1) instead of .maybeSingle(): if a duplicate goals row ever
    // exists, .maybeSingle() THROWS ("multiple rows") — and because the load
    // used to Promise.all, that also wiped the profile. Tolerate it instead.
    const { data, error } = await supabase!
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }
  return localDb.first<Goals>("goals", { user_id: uid });
}

export async function updateGoals(patch: GoalsUpdate): Promise<Goals | null> {
  const uid = getUserId();
  if (!uid) return null;
  if (usingBackend()) {
    // Read-then-write by user_id — same rationale as updateProfile: UPDATE the
    // existing row, INSERT if missing, and treat "0 rows updated" as a hard
    // error rather than a silent no-op.
    const { data: existingRows, error: readErr } = await supabase!
      .from("goals")
      .select("id")
      .eq("user_id", uid)
      .limit(1);
    if (readErr) throw readErr;

    if (existingRows && existingRows.length > 0) {
      const { data, error } = await supabase!
        .from("goals")
        .update(patch)
        .eq("user_id", uid)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "Update saved 0 rows — a row-level security policy is blocking updates on 'goals'.",
        );
      return data;
    }
    const { data, error } = await supabase!
      .from("goals")
      .insert({ user_id: uid, ...patch })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const existing = localDb.first<Goals>("goals", { user_id: uid });
  if (existing) return localDb.update<Goals>("goals", existing.id, patch as Partial<Goals>);
  return localDb.insert<Goals>("goals", { user_id: uid, ...(patch as Partial<Goals>) });
}
