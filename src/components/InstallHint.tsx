import { useEffect, useState } from "react";

const DISMISS_KEY = "vyou.install-hint.dismissed";

type Platform = "ios" | "android" | null;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallHint() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    if (isStandalone || dismissed) return;

    if (isIOS) setPlatform("ios");
    else if (isAndroid) setPlatform("android");

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isIOS && !isStandalone && !dismissed) setPlatform("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!platform) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setPlatform(null);
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") setPlatform(null);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-400/40 bg-gradient-to-b from-emerald-500/20 to-black/90 p-4 text-sm text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl" aria-hidden>📲</span>
          <div className="flex-1 space-y-1">
            <p className="text-base font-semibold leading-tight">
              Install VYU for the best experience
            </p>
            <p className="text-xs leading-snug text-white/80">
              {platform === "ios" ? (
                <>
                  Fullscreen camera, no browser chrome eating your controls in landscape. Tap{" "}
                  <span className="rounded bg-white/15 px-1 py-0.5 font-semibold">Share</span> →{" "}
                  <span className="rounded bg-white/15 px-1 py-0.5 font-semibold">Add to Home Screen</span>.
                </>
              ) : deferredPrompt ? (
                <>Fullscreen camera, no URL bar, works offline. One-tap install below.</>
              ) : (
                <>
                  Fullscreen camera, no URL bar, works offline. Tap your browser menu →{" "}
                  <span className="rounded bg-white/15 px-1 py-0.5 font-semibold">Install app</span> (or{" "}
                  <span className="rounded bg-white/15 px-1 py-0.5 font-semibold">Add to Home screen</span>).
                </>
              )}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="-mr-1 -mt-1 p-1 text-white/50 hover:text-white/90"
            aria-label="Dismiss install hint"
          >
            ✕
          </button>
        </div>
        {platform === "android" && deferredPrompt && (
          <button
            onClick={installAndroid}
            className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black active:scale-95"
          >
            Install VYU
          </button>
        )}
      </div>
    </div>
  );
}
