import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MapView from "../components/MapView";
import type { Classification, Confidence, Report, SessionStats, VerifiedReport } from "../lib/types";
import { inviteHeaders } from "../lib/invite";
import { prettyPhenomenon } from "../lib/format";

const POLL_INTERVAL_MS = 2500;
const CLASSIFY_POLL_TIMEOUT_MS = 90_000;
const RECONCILE_POLL_TIMEOUT_MS = 180_000;

// Module-scoped: survives component remount within the same browser session,
// keyed by classification id. Server-side idempotency is the durable guard.
const reconcileDispatchSet = new Set<string>();
const classifyDispatchSet = new Set<string>();

const DEV_DEBUG =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"));

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedReport | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("reports_v").select("*").eq("id", id).single();
      if (error) {
        setError(error.message);
        return;
      }
      setReport(data as Report);
    })();
  }, [id]);

  const [classifyAttempt, setClassifyAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function tick() {
      if (cancelled) return;
      const { data } = await supabase
        .from("classifications")
        .select("*")
        .eq("report_id", id)
        .eq("agent", "classifier")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setClassification(data as Classification);
        return;
      }
      // On first poll pass, dispatch classify if no existing row and we
      // haven't already dispatched it in this browser session. Classify is
      // idempotent server-side (keyed on report_id), so a double-dispatch
      // with the CaptureFlow fire-and-forget invoke is safe — the second
      // call returns the cached classification.
      const dispatchKey = id!;
      if (!classifyDispatchSet.has(dispatchKey)) {
        classifyDispatchSet.add(dispatchKey);
        supabase.functions
          .invoke("classify", { body: { report_id: id }, headers: inviteHeaders() })
          .catch((e) => {
            // FunctionsFetchError on iOS PWA is expected for long calls;
            // polling will still pick up the server-written row.
            console.warn("[classify] invoke fetch failed (polling continues)", e);
          });
      }
      if (Date.now() - startedAt > CLASSIFY_POLL_TIMEOUT_MS) {
        setClassifyError("Classifier did not respond within 90s.");
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [id, classifyAttempt]);

  function retryClassify() {
    if (!id) return;
    classifyDispatchSet.delete(id);
    setClassifyError(null);
    setClassifyAttempt((n) => n + 1);
  }

  // Module-scoped guard so a remount (iOS bfcache eviction, back-nav, tab
  // restore) does not re-fire reconcile for a classification we already
  // dispatched in this browser session. Server-side idempotency is the
  // durable guard; this prevents the visible "spinner restarts" UX bug.
  const dispatchedReconcileFor = useRef<Set<string>>(reconcileDispatchSet);

  useEffect(() => {
    if (!classification) return;
    let cancelled = false;
    const startedAt = Date.now();
    const cid = classification.id;

    // Reconcile only matters for in-taxonomy phenomena. out_of_scope and
    // tester_selfie default to inconclusive per the system prompt, so opening
    // a paid session for them is wasted cost. Surface a clean inconclusive
    // verdict locally instead.
    const skipPhenomena = new Set(["out_of_scope", "tester_selfie"]);
    if (classification.phenomenon && skipPhenomena.has(classification.phenomenon)) {
      setVerified({
        id: "local",
        verdict: "inconclusive",
        rationale: "This image is outside the severe-weather reporting scope, so the radar comparison does not apply.",
        confidence: "low",
        radar_frame_url: null,
        session_stats: null,
        created_at: new Date().toISOString(),
      } as unknown as VerifiedReport);
      return () => {
        cancelled = true;
      };
    }

    if (!dispatchedReconcileFor.current.has(cid)) {
      dispatchedReconcileFor.current.add(cid);
      supabase.functions
        .invoke("reconcile", {
          body: { classification_id: cid },
          headers: inviteHeaders(),
        })
        .then(({ data, error }) => {
          if (cancelled) return;
          // FunctionsFetchError ("Failed to send a request…") is expected on
          // iOS PWA for long-running calls — Safari kills the fetch around
          // 60–90s. Polling picks up the server-written verdict regardless,
          // so we only surface real HTTP errors (401 invite, 4xx schema).
          if (error && error.name !== "FunctionsFetchError") {
            setVerifyError(`Reconciliation could not start: ${error.message}`);
            return;
          }
          // deno-lint-ignore no-explicit-any
          const payload = data as { verified_report?: VerifiedReport; timed_out?: boolean } | null;
          if (payload?.verified_report) setVerified(payload.verified_report);
        })
        .catch((e) => {
          if (!cancelled) console.warn("[reconcile] invoke fetch failed (polling continues)", e);
        });
    }

    async function poll() {
      if (cancelled) return;
      const { data } = await supabase
        .from("verified_reports")
        .select("*")
        .eq("classification_id", cid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setVerified(data as VerifiedReport);
        return;
      }
      if (Date.now() - startedAt > RECONCILE_POLL_TIMEOUT_MS) {
        setVerifyError("Reconciliation did not respond within 3 minutes.");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [classification]);

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-red-400">
        <p>Could not load report.</p>
        <p className="text-xs text-white/40">{error}</p>
        <Link to="/" className="rounded-full bg-white/10 px-4 py-2 text-sm">Back to map</Link>
      </div>
    );
  }

  if (!report) {
    return <div className="flex h-dvh items-center justify-center text-white/60">Loading report…</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 active:scale-95"
          aria-label="Home"
        >
          <span aria-hidden>🏠</span>
          <span>Home</span>
        </Link>
        <span className="text-xs uppercase tracking-wider text-white/40">Report</span>
      </header>
      <div className="aspect-[16/9] w-full sm:aspect-[2/1]">
        <MapView center={[report.lon, report.lat]} zoom={12} />
      </div>
      <main className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
        {report.photo_url && (
          <section>
            <button
              type="button"
              onClick={() => setEnlarged(true)}
              className="relative block w-full overflow-hidden rounded-lg border border-white/10 bg-black active:scale-[0.99]"
              aria-label="Enlarge photo"
            >
              <img
                src={report.photo_url}
                alt="Submitted sky photo"
                className="w-full"
                loading="lazy"
              />
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70 backdrop-blur">
                Tap to enlarge
              </span>
            </button>
          </section>
        )}
        <ClassificationCard classification={classification} error={classifyError} onRetry={retryClassify} />
        <VerifiedCard verified={verified} error={verifyError} hasClassification={!!classification} />
        <section>
          <p className="text-white/50">Heading</p>
          <p className="text-xl font-semibold tabular-nums">{Math.round(report.heading_degrees)}°</p>
        </section>
        <section>
          <p className="text-white/50">Location</p>
          <p className="tabular-nums">{report.lat.toFixed(5)}, {report.lon.toFixed(5)}</p>
        </section>
        <section>
          <p className="text-white/50">Captured</p>
          <p>{new Date(report.captured_at).toLocaleString()}</p>
        </section>
        {report.caption && (
          <section>
            <p className="text-white/50">Caption</p>
            <p>{report.caption}</p>
          </section>
        )}
      </main>
      {enlarged && report.photo_url && (
        <button
          type="button"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          aria-label="Close enlarged photo"
        >
          <img
            src={report.photo_url}
            alt="Submitted sky photo (enlarged)"
            className="max-h-full max-w-full object-contain"
          />
          <span
            className="absolute right-4 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
            style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
          >
            Tap to close
          </span>
        </button>
      )}
    </div>
  );
}

function ClassificationCard({
  classification,
  error,
  onRetry,
}: {
  classification: Classification | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-medium text-red-100 active:scale-95"
        >
          Retry
        </button>
      </section>
    );
  }
  if (!classification) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/50">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Classifying with Opus 4.7…
        </span>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs uppercase tracking-wider">Classifier</p>
        <ConfidencePill value={classification.confidence} />
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {prettyPhenomenon(classification.phenomenon)}
      </p>
      {classification.hail_size_cm !== null && (
        <p className="mt-1 text-xs text-white/50">Estimated hail size: {classification.hail_size_cm} cm</p>
      )}
      {classification.features && classification.features.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-white/70">
          {classification.features.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-white/30">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
      <CostFooter stats={classification.session_stats} label="Classifier" />
    </section>
  );
}

function VerifiedCard({
  verified,
  error,
  hasClassification,
}: {
  verified: VerifiedReport | null;
  error: string | null;
  hasClassification: boolean;
}) {
  if (!hasClassification) return null;
  if (error) {
    return (
      <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
        {error}
      </section>
    );
  }
  if (!verified) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/50">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Reconciling against DWD RADOLAN…
        </span>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs uppercase tracking-wider">Reconciliation</p>
        <VerdictPill verdict={verified.verdict} />
      </div>
      {verified.rationale && (
        <p className="mt-2 text-sm leading-relaxed text-white/80">{verified.rationale}</p>
      )}
      {verified.radar_frame_url && (
        <a
          href={verified.radar_frame_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-[11px] text-white/40 underline underline-offset-2"
        >
          View radar frame
        </a>
      )}
      <CostFooter stats={verified.session_stats} label="Reconciliation" />
    </section>
  );
}

function ConfidencePill({ value }: { value: Confidence | null }) {
  const tone: Record<Confidence | "unknown", string> = {
    high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-red-500/15 text-red-300 border-red-500/30",
    unknown: "bg-white/5 text-white/40 border-white/10",
  };
  const v = value ?? "unknown";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${tone[v]}`}>
      {v} confidence
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: VerifiedReport["verdict"] }) {
  const tone: Record<VerifiedReport["verdict"], string> = {
    match: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    mismatch: "bg-red-500/15 text-red-300 border-red-500/30",
    inconclusive: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${tone[verdict]}`}>
      {verdict}
    </span>
  );
}

function CostFooter({ stats, label }: { stats: SessionStats | null; label: string }) {
  if (!DEV_DEBUG || !stats) return null;
  const cost = stats.cost_usd != null ? `$${stats.cost_usd.toFixed(4)}` : "—";
  const duration = stats.duration_ms != null ? `${(stats.duration_ms / 1000).toFixed(1)}s` : "—";
  return (
    <p className="mt-3 border-t border-white/5 pt-2 font-mono text-[10px] text-white/30">
      {label} · {stats.model} · {cost} · {duration} · {stats.session_id.slice(0, 12)}…
    </p>
  );
}

