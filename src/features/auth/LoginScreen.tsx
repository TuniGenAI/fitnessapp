import { APP_NAME } from "@/appConfig";
import { useAuth } from "./AuthProvider";
import { Photo } from "@/components/Photo";
import { heroImage } from "@/lib/images";
import { GoogleIcon, DumbbellIcon, FlameIcon, TrophyIcon } from "@/components/icons";

/** First screen: sign in with Google, or browse in demo mode before the backend exists. */
export function LoginScreen() {
  const { configured, signInWithGoogle, enterDemo } = useAuth();

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="relative mb-8 overflow-hidden rounded-3xl">
        <Photo
          src={heroImage("full body strength", 800)}
          alt=""
          scrim="full"
          eager
          className="absolute inset-0 h-full w-full"
        />
        <div className="relative flex min-h-[230px] flex-col justify-end p-6 text-white">
          <div className="bg-grad-energy mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
            <DumbbellIcon className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-2 text-sm opacity-90">
            Know exactly what to lift and eat today. Log it in seconds. Watch your numbers go up.
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3 text-center">
        <Feature Icon={DumbbellIcon} label="Progressive overload" color="var(--color-brand)" />
        <Feature Icon={FlameIcon} label="Streaks & macros" color="var(--color-flame)" />
        <Feature Icon={TrophyIcon} label="PR celebrations" color="var(--color-accent)" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-white py-3.5 font-bold text-gray-800 shadow-lg transition active:scale-[0.98]"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {!configured && (
        <>
          <button
            onClick={enterDemo}
            className="mt-3 w-full rounded-full border py-3.5 font-bold text-muted transition active:scale-[0.98]"
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
  color,
}: {
  Icon: (p: { className?: string; style?: React.CSSProperties }) => JSX.Element;
  label: string;
  color?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-3">
      <Icon className="h-6 w-6" style={color ? { color } : undefined} />
      <span className="text-[11px] leading-tight text-muted">{label}</span>
    </div>
  );
}
