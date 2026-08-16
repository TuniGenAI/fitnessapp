/**
 * Rest-timer preferences (on/off + default duration), persisted in localStorage.
 *
 * Kept out of the DB deliberately: it's a lightweight device preference, not
 * shared data, so it needs no schema/migration and works identically in demo
 * mode. Both the Settings screen and the live logger read/write through here.
 */
const ON_KEY = "fitnessapp.restTimerOn";
const SECONDS_KEY = "fitnessapp.restSeconds";

export const DEFAULT_REST_SECONDS = 120;
/** Presets offered in Settings (seconds). */
export const REST_PRESETS = [60, 90, 120, 150, 180];

export function restTimerOn(): boolean {
  return localStorage.getItem(ON_KEY) !== "false"; // default on
}

export function setRestTimerOn(on: boolean): void {
  localStorage.setItem(ON_KEY, on ? "true" : "false");
}

export function restSeconds(): number {
  const raw = Number(localStorage.getItem(SECONDS_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REST_SECONDS;
}

export function setRestSeconds(seconds: number): void {
  localStorage.setItem(SECONDS_KEY, String(Math.max(15, Math.round(seconds))));
}

/** "2:00" from a seconds count. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A short completion cue: a gentle haptic buzz (Android/Chrome; iOS Safari
 * ignores it harmlessly) plus a brief beep via Web Audio. Best-effort — wrapped
 * so a blocked AudioContext or missing API never throws into the render loop.
 */
export function restDoneCue(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ignore */
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    /* ignore */
  }
}
