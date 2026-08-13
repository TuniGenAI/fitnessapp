import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthState {
  /** True once we've resolved the initial session (or decided on demo mode). */
  ready: boolean;
  /** True when a real Supabase project is wired up. */
  configured: boolean;
  /** True when running without a backend (browse-everything demo). */
  demo: boolean;
  user: User | null;
  session: Session | null;
  displayName: string;
  signInWithGoogle: () => Promise<void>;
  enterDemo: () => void;
  signOut: () => Promise<void>;
}

const DEMO_FLAG = "fitnessapp.demo";

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState<boolean>(
    () => localStorage.getItem(DEMO_FLAG) === "1",
  );

  useEffect(() => {
    if (!supabase) {
      // No backend configured yet — resolve immediately into demo-capable state.
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    const user = session?.user ?? null;
    const displayName =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.email as string | undefined) ??
      (demo ? "Demo athlete" : "Athlete");

    return {
      ready,
      configured: isSupabaseConfigured,
      demo: demo && !user,
      user,
      session,
      displayName,
      async signInWithGoogle() {
        if (!supabase) {
          // Fallback: no backend — enter demo mode instead of failing.
          localStorage.setItem(DEMO_FLAG, "1");
          setDemo(true);
          return;
        }
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
      },
      enterDemo() {
        localStorage.setItem(DEMO_FLAG, "1");
        setDemo(true);
      },
      async signOut() {
        localStorage.removeItem(DEMO_FLAG);
        setDemo(false);
        if (supabase) await supabase.auth.signOut();
      },
    };
  }, [ready, session, demo]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** True when the user may see the app (real session or demo mode). */
export function useIsAuthed(): boolean {
  const { user, demo } = useAuth();
  return Boolean(user) || demo;
}
