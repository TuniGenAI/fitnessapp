import { Suspense } from "react";
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
import { Spinner } from "./ui";

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

/**
 * App frame: a full-height flex column where only <main> scrolls and the tab
 * bar is an in-flow flex child pinned to the bottom by the layout — NOT
 * `position: fixed`. Fixed + backdrop-filter detaches mid-scroll on iOS
 * Safari/PWA and lands over the content; this pattern avoids that entirely.
 */
export function AppShell() {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      <InstallPrompt />

      <nav
        className="shrink-0 rounded-t-[26px]"
        style={{
          background: "var(--color-brand)",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -10px 30px -18px rgba(0,0,0,0.6)",
        }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="group flex flex-1 flex-col items-center gap-1 py-3"
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="h-6 w-6 transition-colors"
                    style={{
                      color: isActive ? "var(--color-accent)" : "#ffffff",
                      opacity: isActive ? 1 : 0.8,
                    }}
                  />
                  <span
                    className="text-[10px] font-bold transition-colors"
                    style={{
                      color: isActive ? "var(--color-accent)" : "#ffffff",
                      opacity: isActive ? 1 : 0.8,
                    }}
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
