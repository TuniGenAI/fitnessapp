import { useEffect, useState } from "react";

/** User preference. "system" follows the OS setting (the default). */
export type Theme = "system" | "light" | "dark";
type Resolved = "light" | "dark";

const KEY = "fitnessapp.theme";
const THEME_COLOR: Record<Resolved, string> = {
  dark: "#0a0e17",
  light: "#eaf1f8",
};

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Turn a preference into the concrete light/dark that should render now. */
export function resolveTheme(theme: Theme): Resolved {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

function apply(theme: Theme) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("light", resolved === "light");
  root.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[resolved]);
}

function stored(): Theme {
  return (localStorage.getItem(KEY) as Theme | null) ?? "system";
}

/** Read the stored preference and apply it before React renders (no flash). */
export function initTheme() {
  apply(stored());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(stored);

  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
    if (theme !== "system") return;
    // Re-apply live when the OS flips light/dark and we're following it.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return {
    theme,
    setTheme,
    /** Resolved light/dark for UI that needs to know what's actually showing. */
    resolved: resolveTheme(theme),
  };
}
