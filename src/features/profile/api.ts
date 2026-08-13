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
