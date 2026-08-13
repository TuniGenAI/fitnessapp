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
    const { data, error } = await supabase!
      .from("profiles")
      .update(patch)
      .eq("id", uid)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  return localDb.update<Profile>("profiles", uid, patch as Partial<Profile>);
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
    // A goals row is created by the new-user trigger; update it in place.
    const { data, error } = await supabase!
      .from("goals")
      .update(patch)
      .eq("user_id", uid)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const existing = localDb.first<Goals>("goals", { user_id: uid });
  if (!existing) return null;
  return localDb.update<Goals>("goals", existing.id, patch as Partial<Goals>);
}
