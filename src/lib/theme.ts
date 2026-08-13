import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "fitnessapp.theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f5f7fb" : "#0b0f1a");
}

/** Read the stored theme and apply it before React renders (avoids a flash). */
export function initTheme() {
  const stored = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
  apply(stored);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme | null) ?? "dark",
  );
  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);
  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}
