import { useEffect, useState } from "react";

const DISMISS_KEY = "vyou.install-hint.dismissed";

export default function IOSInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    if (isIOS && !isStandalone && !dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-black/85 p-3 text-xs text-white/90 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
        <span className="mt-0.5 text-emerald-400">↑</span>
        <p className="flex-1 leading-snug">
          Add <span className="font-semibold">VYou</span> to your home screen — tap{" "}
          <span className="rounded bg-white/10 px-1 py-0.5">Share</span> then{" "}
          <span className="rounded bg-white/10 px-1 py-0.5">Add to Home Screen</span> for fullscreen capture.
        </p>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="text-white/40 hover:text-white/70"
          aria-label="Dismiss install hint"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
