import { useState } from "react";
import { APP_NAME } from "@/appConfig";
import { useAuth } from "@/features/auth/AuthProvider";
import { useProfile } from "@/features/profile/ProfileProvider";
import { useTheme, type Theme } from "@/lib/theme";
import { Segmented, Button } from "@/components/ui";
import type { CoachMode, WeightUnit, VolumeUnit } from "@/types";

export function SettingsPage() {
  const { displayName, user, demo, configured, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { theme, setTheme } = useTheme();

  const [keyInput, setKeyInput] = useState("");
  const [savedKey, setSavedKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const hasKey = Boolean(profile?.gemini_api_key);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>

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
              {user?.email ?? (demo ? "Demo mode (local only)" : "Signed in")}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: "var(--color-surface-2)", color: "var(--color-protein)" }}
        >
          {demo ? "Exit demo (clears local data)" : "Sign out"}
        </button>
      </section>

      {/* Units */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Units</h2>
        <div>
          <p className="mb-1.5 text-sm">Weight</p>
          <Segmented<WeightUnit>
            value={profile?.weight_unit ?? "kg"}
            onChange={(v) => updateProfile({ weight_unit: v })}
            options={[
              { value: "kg", label: "Kilograms" },
              { value: "lb", label: "Pounds" },
            ]}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm">Volume</p>
          <Segmented<VolumeUnit>
            value={profile?.volume_unit ?? "ml"}
            onChange={(v) => updateProfile({ volume_unit: v })}
            options={[
              { value: "ml", label: "Milliliters" },
              { value: "oz", label: "Ounces" },
            ]}
          />
        </div>
      </section>

      {/* Appearance */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Appearance</h2>
        <Segmented<Theme>
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <p className="text-xs text-muted">
          {theme === "system"
            ? "Follows your device's light / dark setting."
            : `Always ${theme}.`}
        </p>
      </section>

      {/* AI Coach */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">AI coach</h2>
          <button
            onClick={() => updateProfile({ coach_enabled: !(profile?.coach_enabled ?? true) })}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              background: profile?.coach_enabled ?? true ? "var(--color-accent)" : "var(--color-surface-2)",
              color: profile?.coach_enabled ?? true ? "#0b0f1a" : "var(--color-muted)",
            }}
          >
            {profile?.coach_enabled ?? true ? "On" : "Off"}
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-sm">In-workout style</p>
          <Segmented<CoachMode>
            value={profile?.coach_mode ?? "recap"}
            onChange={(v) => updateProfile({ coach_mode: v })}
            options={[
              { value: "reactions", label: "Per-set reactions" },
              { value: "recap", label: "End recap" },
            ]}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm">Gemini API key</p>
          <p className="mb-2 text-xs text-muted">
            Optional. Powers conversational briefings via a server-side edge function —
            the key is stored on your profile and never sent to the browser. Without it,
            the coach uses smart rule-based guidance.
          </p>
          {hasKey && !savedKey ? (
            <div className="flex items-center gap-2">
              <span
                className="flex-1 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
              >
                Key saved ✓
              </span>
              <Button
                variant="danger"
                onClick={async () => {
                  await updateProfile({ gemini_api_key: null });
                }}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste key (AIza…)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--color-surface-2)" }}
              />
              <Button
                disabled={!keyInput.trim()}
                onClick={async () => {
                  setKeyError(null);
                  try {
                    await updateProfile({ gemini_api_key: keyInput.trim() });
                    setKeyInput("");
                    setSavedKey(false);
                  } catch (e) {
                    setKeyError((e as Error).message ?? String(e));
                  }
                }}
              >
                Save
              </Button>
            </div>
          )}
          {keyError && (
            <p className="mt-2 text-xs" style={{ color: "var(--color-protein)" }}>
              Couldn’t save: {keyError}
            </p>
          )}
        </div>
      </section>

      {/* Setup status */}
      <section className="card p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Setup status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <StatusRow ok={configured} label="Supabase backend" hint=".env.local URL + anon key" />
          <StatusRow ok={hasKey} label="Gemini AI coach" hint="Add your key above (optional)" />
        </ul>
      </section>

      <p className="pt-2 text-center text-xs text-muted">{APP_NAME} · v0.5.1</p>
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
