import { useCallback, useEffect, useState } from "react";
import { hardRefresh } from "../lib/refresh";

export type ConnStatus = "connecting" | "online" | "slow" | "offline";

type Props = {
  status: ConnStatus;
  lastOkAt: number | null;
};

export default function StatusPill({ status, lastOkAt }: Props) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dot = dotClass(status);
  const label = pillLabel(status);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute left-4 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur active:scale-95"
        style={{ top: "calc(2.5rem + env(safe-area-inset-top))" }}
        aria-label={`Connection: ${label}. Tap for refresh options.`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
        <span>{label}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f2430] p-5 text-sm text-white/90 shadow-2xl"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">App status</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <dl className="mt-4 space-y-2">
              <Row label="Connection">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
                  <span>{label}</span>
                </span>
              </Row>
              <Row label="Last sync">
                <span className="text-white/70">{formatLastSync(lastOkAt)}</span>
              </Row>
            </dl>
            <p className="mt-4 text-xs text-white/50">
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
              className="mt-4 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black active:scale-95 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Hard refresh"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs uppercase tracking-wider text-white/40">{label}</dt>
      <dd className="text-sm">{children}</dd>
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
