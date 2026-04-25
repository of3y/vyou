import { useEffect, useState } from "react";
import { notify } from "../lib/notify";
import { hasInvite } from "../lib/invite";

const STORAGE_KEY = "vyou_invite";

export default function InviteBanner() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(!hasInvite());
    const id = window.setInterval(() => setMissing(!hasInvite()), 2000);
    return () => window.clearInterval(id);
  }, []);

  if (!missing) return null;

  async function pasteInvite() {
    const raw = window.prompt(
      "Paste your full invite link (e.g. https://vyou.dkck.dev/?invite=…)",
    );
    if (!raw) return;
    const token = extractInviteToken(raw.trim());
    if (!token) {
      notify.error("Couldn't find an invite token in that link");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, token);
    setMissing(false);
    notify.success("Invite accepted — you're signed in");
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur"
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>
          Not signed in. Open your{" "}
          <span className="font-semibold">?invite=…</span> link in this tab, or
        </span>
        <button
          onClick={pasteInvite}
          className="rounded-full border border-amber-300/50 bg-amber-400/20 px-2.5 py-0.5 font-semibold text-amber-50 active:scale-95"
        >
          Paste invite link
        </button>
      </div>
    </div>
  );
}

function extractInviteToken(raw: string): string | null {
  try {
    const url = new URL(raw);
    const token = url.searchParams.get("invite");
    if (token) return token;
  } catch {
    // not a full URL — fall through
  }
  const match = raw.match(/[?&]invite=([^&#\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  if (/^[A-Za-z0-9_-]{8,}$/.test(raw)) return raw;
  return null;
}
