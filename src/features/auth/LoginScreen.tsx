import { APP_NAME } from "@/appConfig";
import { useAuth } from "./AuthProvider";
import { GoogleIcon, DumbbellIcon, FlameIcon, TrophyIcon } from "@/components/icons";

/** First screen: sign in with Google, or browse in demo mode before the backend exists. */
export function LoginScreen() {
  const { configured, signInWithGoogle, enterDemo } = useAuth();

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-strong))" }}
        >
          <DumbbellIcon className="h-9 w-9 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted">
          Know exactly what to lift and eat today. Log it in seconds. Watch your numbers go up.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3 text-center">
        <Feature Icon={DumbbellIcon} label="Progressive overload" />
        <Feature Icon={FlameIcon} label="Streaks & macros" />
        <Feature Icon={TrophyIcon} label="PR celebrations" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-3.5 font-semibold text-gray-800 shadow-lg transition active:scale-[0.98]"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {!configured && (
        <>
          <button
            onClick={enterDemo}
            className="mt-3 w-full rounded-2xl border py-3.5 font-medium text-muted transition active:scale-[0.98]"
            style={{ borderColor: "var(--color-line)" }}
          >
            Explore in demo mode
          </button>
          <div
            className="mt-6 rounded-xl border p-3 text-xs text-muted"
            style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
          >
            <span className="font-semibold" style={{ color: "var(--color-accent)" }}>
              Setup note:
            </span>{" "}
            The backend (Supabase) isn't connected yet, so Google sign-in is inactive.
            Add your Supabase URL + anon key to <code>.env.local</code> to turn it on.
            Until then, “Explore in demo mode” lets you click through the whole app.
          </div>
        </>
      )}
    </div>
  );
}

function Feature({
  Icon,
  label,
}: {
  Icon: (p: { className?: string }) => JSX.Element;
  label: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-3">
      <Icon className="h-6 w-6" />
      <span className="text-[11px] leading-tight text-muted">{label}</span>
    </div>
  );
}
