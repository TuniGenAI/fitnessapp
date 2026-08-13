import { NavLink, Outlet } from "react-router-dom";
import type { ComponentType, SVGProps } from "react";
import {
  HomeIcon,
  DumbbellIcon,
  AppleIcon,
  HeartPulseIcon,
  SettingsIcon,
} from "./icons";
import { InstallPrompt } from "./InstallPrompt";

interface Tab {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TABS: Tab[] = [
  { to: "/", label: "Today", Icon: HomeIcon },
  { to: "/workouts", label: "Train", Icon: DumbbellIcon },
  { to: "/nutrition", label: "Fuel", Icon: AppleIcon },
  { to: "/body", label: "Body", Icon: HeartPulseIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

/** App frame: scrollable content + a fixed bottom tab bar (thumb-reachable). */
export function AppShell() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <InstallPrompt />

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t"
        style={{
          background: "color-mix(in srgb, var(--color-ink) 88%, transparent)",
          borderColor: "var(--color-line)",
          backdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="group flex flex-1 flex-col items-center gap-1 py-2.5 text-muted"
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="h-6 w-6 transition-colors"
                    style={isActive ? { color: "var(--color-brand)" } : undefined}
                  />
                  <span
                    className="text-[10px] font-medium transition-colors"
                    style={isActive ? { color: "var(--color-brand)" } : undefined}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
