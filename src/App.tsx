import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth, useIsAuthed } from "@/features/auth/AuthProvider";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

// The landing (Dashboard) and shell load eagerly for an instant first paint.
// The four heavier tabs are split into their own chunks and fetched on first
// navigation, so they stay off the cold-start critical path. AppShell wraps the
// outlet in <Suspense>, so the tab bar remains visible while a chunk loads.
const WorkoutsPage = lazy(() =>
  import("@/features/workouts/WorkoutsPage").then((m) => ({ default: m.WorkoutsPage })),
);
const NutritionPage = lazy(() =>
  import("@/features/nutrition/NutritionPage").then((m) => ({ default: m.NutritionPage })),
);
const BodyPage = lazy(() =>
  import("@/features/body/BodyPage").then((m) => ({ default: m.BodyPage })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

export default function App() {
  const { ready } = useAuth();
  const authed = useIsAuthed();

  if (!ready) return <Splash />;
  if (!authed) return <LoginScreen />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="workouts" element={<WorkoutsPage />} />
        <Route path="nutrition" element={<NutritionPage />} />
        <Route path="body" element={<BodyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: "var(--color-line)", borderTopColor: "transparent" }}
      />
    </div>
  );
}
