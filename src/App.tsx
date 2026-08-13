import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth, useIsAuthed } from "@/features/auth/AuthProvider";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { WorkoutsPage } from "@/features/workouts/WorkoutsPage";
import { NutritionPage } from "@/features/nutrition/NutritionPage";
import { BodyPage } from "@/features/body/BodyPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

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
