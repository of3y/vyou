import { useState } from "react";
import { captureInviteFromUrl, hasInvite } from "../lib/invite";

// Hard gate at app root: without an invite token, nothing else mounts. Anyone
// reaching the URL without ?invite=… in their localStorage sees only the
// paste-invite splash. Read-gate enforcement on the backend (RLS + invite-
// gated edge functions) is what actually protects the data; this is the UX
// layer that prevents the rest of the app from rendering broken empty states.

export default function InviteGate({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = useState<boolean>(() => {
    captureInviteFromUrl();
    return hasInvite();
  });
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  if (hasToken) return <>{children}</>;

  async function pasteInvite() {
    setPasteError(null);
    setPasting(true);
    try {
      const raw = window.prompt("Paste your invite link or token:");
      if (!raw) {
        setPasting(false);
        return;
      }
      const trimmed = raw.trim();
      let token: string | null = null;
      try {
        const url = new URL(trimmed);
        token = url.searchParams.get("invite");
      } catch {
        token = trimmed;
      }
      if (!token) {
        setPasteError("No invite token found in that link.");
        setPasting(false);
        return;
      }
      window.localStorage.setItem("vyou_invite", token);
      setHasToken(true);
    } finally {
      setPasting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">VYou</p>
        <h1 className="text-2xl font-semibold">Invite required</h1>
      </div>
      <p className="max-w-sm text-sm text-white/60">
        VYou is in private beta with a small test cohort this week. Reach the app via your invite link
        — or paste it below if the deep link didn't carry over to the installed PWA.
      </p>
      <button
        type="button"
        onClick={pasteInvite}
        disabled={pasting}
        className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black active:scale-95 disabled:opacity-50"
      >
        Paste invite link
      </button>
      {pasteError && <p className="text-xs text-amber-300">{pasteError}</p>}
      <p className="max-w-sm text-[11px] text-white/30">
        No invite? Submission is open during the Built-with-Opus-4.7 hackathon week — the public
        version goes live after that.
      </p>
    </div>
  );
}
