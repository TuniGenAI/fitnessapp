import { useState } from "react";
import { APP_NAME } from "@/appConfig";
import { useAuth } from "@/features/auth/AuthProvider";
import { useProfile } from "@/features/profile/ProfileProvider";
import { useTheme, type Theme } from "@/lib/theme";
import { Segmented, Button } from "@/components/ui";
import type { CoachMode, WeightUnit, VolumeUnit } from "@/types";
import {
  restTimerOn,
  setRestTimerOn,
  restSeconds,
  setRestSeconds,
  REST_PRESETS,
  formatClock,
} from "@/features/workouts/restTimer";
import { exportAllData, downloadJson } from "@/lib/exportData";
import { testCoachAI } from "@/features/coach/api";

export function SettingsPage() {
  const { displayName, user, demo, configured, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { theme, setTheme } = useTheme();

  const [keyInput, setKeyInput] = useState("");
  const [savedKey, setSavedKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const hasKey = Boolean(profile?.gemini_api_key);

  // Rest-timer prefs live in localStorage (device preference, not synced).
  const [restOn, setRestOn] = useState(restTimerOn);
  const [restSecs, setRestSecs] = useState(restSeconds);

  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>

      {/* Account */}
      <section className="card p-4">
        <h2 className="font-display text-base font-bold tracking-tight text-accent">Account</h2>
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
          style={{ background: "var(--color-surface-2)", color: "var(--color-danger-text)" }}
        >
          {demo ? "Exit demo (clears local data)" : "Sign out"}
        </button>
      </section>

      {/* Units */}
      <section className="card space-y-3 p-4">
        <h2 className="font-display text-base font-bold tracking-tight text-accent">Units</h2>
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
        <h2 className="font-display text-base font-bold tracking-tight text-accent">Appearance</h2>
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

      {/* Workout */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-accent">Rest timer</h2>
          <button
            onClick={() => {
              const next = !restOn;
              setRestOn(next);
              setRestTimerOn(next);
            }}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              background: restOn ? "var(--color-accent)" : "var(--color-surface-2)",
              color: restOn ? "#0b0f1a" : "var(--color-muted)",
            }}
          >
            {restOn ? "On" : "Off"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Starts a countdown automatically after each working set. Adjust or skip it
          from the timer while training.
        </p>
        {restOn && (
          <div>
            <p className="mb-1.5 text-sm">Default rest</p>
            <div className="flex gap-1.5">
              {REST_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setRestSecs(s);
                    setRestSeconds(s);
                  }}
                  className="flex-1 rounded-lg py-2 text-xs font-bold transition"
                  style={{
                    background: restSecs === s ? "var(--color-brand)" : "var(--color-surface-2)",
                    color: restSecs === s ? "#fff" : "var(--color-muted)",
                  }}
                >
                  {formatClock(s)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* AI Coach */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-accent">AI coach</h2>
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
            Optional. Powers conversational briefings via a server-side edge function.
            The key is stored on your profile and never sent to the browser. Without it,
            the coach uses smart rule-based guidance.
          </p>
          {hasKey && !savedKey ? (
            <div className="flex items-center gap-2">
              <span
                className="flex-1 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--color-surface-2)", color: "var(--color-accent-text)" }}
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
            <p className="mt-2 text-xs" style={{ color: "var(--color-danger-text)" }}>
              Couldn't save: {keyError}
            </p>
          )}

          {/* Diagnostic: fire one real coach call and show exactly what happens.
              Turns the silent "(rule-based)" fallback into a readable reason. */}
          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--color-line)" }}>
            <Button
              block
              variant="subtle"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                setTestResult(null);
                try {
                  setTestResult(await testCoachAI());
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? "Testing…" : "Test coach AI"}
            </Button>
            {testResult && (
              <div
                className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                style={{
                  background: "var(--color-surface-2)",
                  color: testResult.ok ? "var(--color-accent-text)" : "var(--color-danger-text)",
                }}
              >
                <span className="font-bold">{testResult.ok ? "✓ AI replied: " : "✕ AI didn't fire: "}</span>
                {testResult.detail}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="card space-y-3 p-4">
        <h2 className="font-display text-base font-bold tracking-tight text-accent">Your data</h2>
        <p className="text-xs text-muted">
          Download everything you've logged (workouts, food, body metrics, photos) as
          a single JSON file. Your data, yours to keep.
        </p>
        <Button
          block
          variant="subtle"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setExportErr(null);
            try {
              const data = await exportAllData();
              downloadJson(data);
            } catch (e) {
              setExportErr((e as Error).message ?? String(e));
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Preparing…" : "Export my data (JSON)"}
        </Button>
        {exportErr && (
          <p className="text-xs" style={{ color: "var(--color-danger-text)" }}>
            Export failed: {exportErr}
          </p>
        )}
      </section>

      {/* Setup status */}
      <section className="card p-4">
        <h2 className="font-display text-base font-bold tracking-tight text-accent">Setup status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <StatusRow ok={configured} label="Supabase backend" hint=".env.local URL + anon key" />
          <StatusRow ok={hasKey} label="Gemini AI coach" hint="Add your key above (optional)" />
        </ul>
      </section>

      <p className="pt-2 text-center text-xs text-muted">{APP_NAME} · v0.16.2 · FitBody design</p>
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
