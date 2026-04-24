import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MapView from "../components/MapView";
import type { Classification, Confidence, Report, SessionStats, VerifiedReport } from "../lib/types";
import { inviteHeaders } from "../lib/invite";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
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
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setClassifyError("Classifier did not respond within 90s. Try again from the map.");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!classification) return;
    let cancelled = false;
    const startedAt = Date.now();

    supabase.functions
      .invoke("reconcile", {
        body: { classification_id: classification.id },
        headers: inviteHeaders(),
      })
      .catch((e) => {
        console.warn("[reconcile] invoke failed", e);
        if (!cancelled) setVerifyError(`Reconciliation could not start: ${e?.message ?? e}`);
      });

    async function poll() {
      const { data } = await supabase
        .from("verified_reports")
        .select("*")
        .eq("classification_id", classification!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setVerified(data as VerifiedReport);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setVerifyError("Reconciliation did not respond within 90s.");
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
        <Link to="/" className="text-sm text-white/60">← Map</Link>
        <span className="text-xs uppercase tracking-wider text-white/40">Report</span>
      </header>
      <div className="aspect-[16/9] w-full sm:aspect-[2/1]">
        <MapView center={[report.lon, report.lat]} zoom={12} />
      </div>
      <main className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
        {report.photo_url && (
          <section>
            <img
              src={report.photo_url}
              alt="Submitted sky photo"
              className="w-full rounded-lg border border-white/10"
              loading="lazy"
            />
          </section>
        )}
        <ClassificationCard classification={classification} error={classifyError} />
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
    </div>
  );
}

function ClassificationCard({
  classification,
  error,
}: {
  classification: Classification | null;
  error: string | null;
}) {
  if (error) {
    return (
      <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
        {error}
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

function prettyPhenomenon(value: string | null): string {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
