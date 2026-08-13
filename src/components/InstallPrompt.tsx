import { useEffect, useState } from "react";
import { XIcon, PlusIcon } from "./icons";
import { APP_NAME } from "@/appConfig";

/** Chrome's beforeinstallprompt event (not in the standard TS lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fitnessapp.installDismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * "Install to home screen" nudge. Uses the native prompt where available
 * (Android/desktop Chrome) and shows iOS Safari's manual steps otherwise.
 * Dismissible and remembered, so it never nags.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires the event — show manual instructions after a short beat.
    let t: number | undefined;
    if (isIOS()) t = window.setTimeout(() => setShow(true), 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-lg px-4">
      <div
        className="flex items-center gap-3 rounded-2xl p-3 shadow-lg"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Install {APP_NAME}</p>
          <p className="text-xs text-muted">
            {deferred
              ? "Add it to your home screen for a full-screen, app-like experience."
              : "Tap the Share button, then “Add to Home Screen”."}
          </p>
        </div>
        {deferred && (
          <button
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice.catch(() => undefined);
              dismiss();
            }}
            className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            <PlusIcon className="h-4 w-4" /> Install
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 text-muted" aria-label="Dismiss">
          <XIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
