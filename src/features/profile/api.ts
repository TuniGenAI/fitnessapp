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
    // Upsert (not update): a plain UPDATE affects 0 rows — and .single() then
    // throws — if the new-user trigger never created this profile row (e.g. the
    // account predates the trigger). Upserting on the primary key creates it if
    // missing, so settings like the Gemini key reliably persist across logins.
    const { data, error } = await supabase!
      .from("profiles")
      .upsert({ id: uid, ...patch }, { onConflict: "id" })
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
    const { data, error } = await supabase!
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return localDb.first<Goals>("goals", { user_id: uid });
}

export async function updateGoals(patch: GoalsUpdate): Promise<Goals | null> {
  const uid = getUserId();
  if (!uid) return null;
  if (usingBackend()) {
    // Upsert (not update): the new-user trigger is supposed to create the goals
    // row, but a plain UPDATE persists nothing (and .single() throws) if it's
    // missing. Upserting on the unique user_id creates it if absent, so nutrition
    // targets stick across logins.
    const { data, error } = await supabase!
      .from("goals")
      .upsert({ user_id: uid, ...patch }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const existing = localDb.first<Goals>("goals", { user_id: uid });
  if (existing) return localDb.update<Goals>("goals", existing.id, patch as Partial<Goals>);
  return localDb.insert<Goals>("goals", { user_id: uid, ...(patch as Partial<Goals>) });
}
