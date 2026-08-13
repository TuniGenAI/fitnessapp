/**
 * Session state bridge.
 *
 * The data layer (`src/lib/localDb.ts` + each feature's `api.ts`) needs to know
 * two things on every call, without threading React context through:
 *   1. the current user id, and
 *   2. whether we're talking to the real Supabase backend or the local demo store.
 *
 * `AuthProvider` pushes the current session/demo flag here whenever it changes,
 * and the data layer reads it synchronously. This keeps feature code backend-
 * agnostic: it calls `listExercises()` and the api decides where the data lives.
 */
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Stable id used for all rows created while browsing in demo mode. */
export const DEMO_USER_ID = "demo-user";

let realUserId: string | null = null;
let demo = false;

/** Called by AuthProvider on every auth/demo change. */
export function setSessionState(session: Session | null, isDemo: boolean): void {
  realUserId = session?.user?.id ?? null;
  demo = isDemo && !realUserId;
}

/** The id to stamp on rows and filter by — real user id, or the demo id. */
export function getUserId(): string | null {
  return realUserId ?? (demo ? DEMO_USER_ID : null);
}

/** True when we should read/write the real Supabase backend. */
export function usingBackend(): boolean {
  return Boolean(supabase) && Boolean(realUserId);
}

/** True when browsing the local, no-backend demo. */
export function isDemo(): boolean {
  return demo;
}
