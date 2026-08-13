import { APP_NAME } from "@/appConfig";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTheme } from "@/lib/theme";

export function SettingsPage() {
  const { displayName, user, demo, configured, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>

      {/* Account */}
      <section className="card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Account</h2>
        <div className="mt-3 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{displayName}</div>
            <div className="truncate text-sm text-muted">
              {user?.email ?? (demo ? "Demo mode (no backend yet)" : "Signed in")}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-protein)" }}
        >
          {demo ? "Exit demo" : "Sign out"}
        </button>
      </section>

      {/* Appearance */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Appearance</h2>
            <p className="mt-1 text-sm">Theme: {theme === "dark" ? "Dark" : "Light"}</p>
          </div>
          <button
            onClick={toggle}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--color-surface-2)" }}
          >
            Switch to {theme === "dark" ? "light" : "dark"}
          </button>
        </div>
      </section>

      {/* Setup status */}
      <section className="card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Setup status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <StatusRow ok={configured} label="Supabase backend" hint=".env.local URL + anon key" />
          <StatusRow ok={false} label="Gemini AI coach" hint="Add key in Milestone 3" />
        </ul>
      </section>

      {/* Later settings */}
      <section className="card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Coming later</h2>
        <p className="mt-2 text-sm text-muted">
          Gemini API key, nutrition goals, program management, supplement stack,
          and units (kg/lb, ml/oz) will live here as those milestones land.
        </p>
      </section>

      <p className="pt-2 text-center text-xs text-muted">{APP_NAME} · v0.1.0</p>
    </div>
  );
}

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-center justify-between">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
      <span
        className="rounded-full px-2.5 py-0.5 text-xs font-bold"
        style={{
          background: ok ? "var(--color-accent)" : "var(--color-surface-2)",
          color: ok ? "#0b0f1a" : "var(--color-muted)",
        }}
      >
        {ok ? "Connected" : "Not set"}
      </span>
    </li>
  );
}
