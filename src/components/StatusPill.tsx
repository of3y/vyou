import { useCallback, useEffect, useState } from "react";
import { Drawer } from "vaul";
import { hardRefresh } from "../lib/refresh";
import { getInviteToken } from "../lib/invite";

export type ConnStatus = "connecting" | "online" | "slow" | "offline";

type Props = {
  status: ConnStatus;
  lastOkAt: number | null;
  className?: string;
};

export default function StatusPill({ status, lastOkAt, className }: Props) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  const dot = dotClass(status);
  const label = pillLabel(status);
  const currentToken = getInviteToken();
  const tokenPreview = currentToken
    ? `${currentToken.slice(0, 6)}…${currentToken.slice(-3)}`
    : "(none)";

  const pasteInvite = useCallback(async () => {
    setPasteError(null);
    setPasting(true);
    try {
      const raw = window.prompt("Paste your invite link or token:");
      if (!raw) return;
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
        return;
      }
      window.localStorage.setItem("vyou_invite", token);
      // Reload so the new token is picked up by every polling effect at once
      // — simpler than threading a refresh signal through the app and
      // matches the InviteGate's behaviour after the splash paste.
      window.location.reload();
    } finally {
      setPasting(false);
    }
  }, []);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          className={
            className ??
            "inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/75 active:scale-95"
          }
          aria-label={`Connection: ${label}. Tap for refresh options.`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
          <span>{label}</span>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#1a1c22]/70 text-white outline-none backdrop-blur-2xl"
          style={{ maxHeight: "70dvh" }}
        >
          <Drawer.Title className="sr-only">App status</Drawer.Title>
          <Drawer.Description className="sr-only">
            Connection, invite, and refresh controls.
          </Drawer.Description>

          <div className="no-scrollbar relative flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-center pt-2.5 pb-2">
              <Drawer.Handle className="!h-1 !w-10 !rounded-full !bg-white/20" />
            </div>

            <div
              className="px-6 pt-2"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                App status
              </p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-white">
                {label}
              </h2>

              <dl className="mt-5 space-y-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                <Row label="Connection">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
                    <span>{label}</span>
                  </span>
                </Row>
                <Row label="Last sync">
                  <span className="text-white/70">{formatLastSync(lastOkAt)}</span>
                </Row>
                <Row label="Invite">
                  <span className="font-mono text-xs text-white/70">{tokenPreview}</span>
                </Row>
              </dl>

              <p className="mt-5 text-[13px] leading-snug text-white/55">
                Wrong invite or moved between deployments? Paste a fresh token — the page reloads
                so every poll picks it up.
              </p>
              <button
                type="button"
                disabled={pasting}
                onClick={pasteInvite}
                className="mt-3 w-full rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {pasting ? "…" : "Paste invite link"}
              </button>
              {pasteError && <p className="mt-2 text-xs text-amber-300">{pasteError}</p>}

              <p className="mt-5 text-[13px] leading-snug text-white/55">
                Stuck or expecting a fresh build? Hard refresh clears the app cache and reloads —
                works inside the home-screen PWA without re-installing.
              </p>
              <button
                type="button"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  await hardRefresh();
                }}
                className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black active:scale-[0.98] disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Hard refresh"}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-[0.16em] text-white/40">{label}</dt>
      <dd className="text-[13px] text-white/85">{children}</dd>
    </div>
  );
}

function dotClass(status: ConnStatus): string {
  switch (status) {
    case "online":
      return "bg-emerald-400";
    case "slow":
      return "bg-amber-400";
    case "offline":
      return "bg-red-400";
    case "connecting":
    default:
      return "bg-white/40";
  }
}

function pillLabel(status: ConnStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "slow":
      return "Slow";
    case "offline":
      return "Offline";
    case "connecting":
    default:
      return "Connecting";
  }
}

function formatLastSync(ts: number | null): string {
  if (ts === null) return "—";
  const diff = Date.now() - ts;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

// Lightweight hook used by the map page to derive status from the existing
// list-reports poll. Pass the duration of the last invoke and whether it
// errored; the hook returns the synthesized status + lastOkAt timestamp.
export function useConnStatus(): {
  status: ConnStatus;
  lastOkAt: number | null;
  recordOk: (durationMs: number) => void;
  recordError: () => void;
} {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);

  // Re-derive "stale" status when the page comes back or time passes — if
  // the last successful sync was a while ago, downgrade the pill so testers
  // see the staleness rather than a green dot frozen from earlier.
  useEffect(() => {
    if (lastOkAt === null) return;
    const id = setInterval(() => {
      const age = Date.now() - lastOkAt;
      if (age > 60_000) setStatus((s) => (s === "online" || s === "slow" ? "offline" : s));
      else if (age > 15_000) setStatus((s) => (s === "online" ? "slow" : s));
    }, 5_000);
    return () => clearInterval(id);
  }, [lastOkAt]);

  const recordOk = useCallback((durationMs: number) => {
    setLastOkAt(Date.now());
    setStatus(durationMs > 2_500 ? "slow" : "online");
  }, []);
  const recordError = useCallback(() => {
    setStatus("offline");
  }, []);

  return { status, lastOkAt, recordOk, recordError };
}
