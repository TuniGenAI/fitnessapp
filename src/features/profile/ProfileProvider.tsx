import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Profile, Goals, ProfileUpdate, GoalsUpdate } from "@/types";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  getProfile,
  getGoals,
  updateProfile as apiUpdateProfile,
  updateGoals as apiUpdateGoals,
} from "./api";

interface ProfileState {
  profile: Profile | null;
  goals: Goals | null;
  loading: boolean;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
  updateGoals: (patch: GoalsUpdate) => Promise<void>;
  reload: () => void;
}

const ProfileContext = createContext<ProfileState | undefined>(undefined);

/** Loads the current user's profile + goals once and shares them app-wide. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, demo } = useAuth();
  const authed = Boolean(user) || demo;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!authed) {
      setProfile(null);
      setGoals(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    // Load independently: a failing goals read must NOT discard a good profile
    // (or vice versa), otherwise a saved value looks lost on the next load.
    Promise.allSettled([getProfile(), getGoals()]).then(([p, g]) => {
      if (!alive) return;
      if (p.status === "fulfilled") setProfile(p.value);
      if (g.status === "fulfilled") setGoals(g.value);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [authed, nonce]);

  const value = useMemo<ProfileState>(
    () => ({
      profile,
      goals,
      loading,
      async updateProfile(patch) {
        const next = await apiUpdateProfile(patch);
        if (next) setProfile(next);
      },
      async updateGoals(patch) {
        const next = await apiUpdateGoals(patch);
        if (next) setGoals(next);
      },
      reload: () => setNonce((n) => n + 1),
    }),
    [profile, goals, loading],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within <ProfileProvider>");
  return ctx;
}

/** Convenience: the user's weight unit ("kg" fallback). */
// eslint-disable-next-line react-refresh/only-export-components
export function useWeightUnit() {
  return useProfile().profile?.weight_unit ?? "kg";
}
