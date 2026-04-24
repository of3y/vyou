import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { inviteHeaders } from "../lib/invite";
import type { Classification, Report, VerifiedReport } from "../lib/types";
import { prettyPhenomenon } from "../lib/format";

type Row = {
  report: Report;
  classification: Classification | null;
  verified: VerifiedReport | null;
};

const LIMIT = 50;

export default function ReportsList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data: reports, error: repErr } = await supabase
      .from("reports_v")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(LIMIT);
    if (repErr) {
      setLoadError(repErr.message);
      return;
    }
    const reportList = (reports ?? []) as Report[];
    if (reportList.length === 0) {
      setRows([]);
      return;
    }
    const ids = reportList.map((r) => r.id);

    const [clsRes, verRes] = await Promise.all([
      supabase
        .from("classifications")
        .select("*")
        .eq("agent", "classifier")
        .in("report_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("verified_reports")
        .select("*")
        .in("report_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    // Partial-load warnings: reports loaded, but classifications or verdicts
    // failed to fetch. Surface the failure rather than rendering the gap as
    // "awaiting classification" / "no verdict".
    const partialErrors: string[] = [];
    if (clsRes.error) partialErrors.push(`classifications: ${clsRes.error.message}`);
    if (verRes.error) partialErrors.push(`verified reports: ${verRes.error.message}`);
    setPartialError(partialErrors.length ? partialErrors.join(" · ") : null);

    const classifications = (clsRes.data ?? []) as Classification[];
    const verifieds = (verRes.data ?? []) as VerifiedReport[];

    const clsByReport = new Map<string, Classification>();
    for (const c of classifications) {
      if (!clsByReport.has(c.report_id)) clsByReport.set(c.report_id, c);
    }
    const verByClassification = new Map<string, VerifiedReport>();
    for (const v of verifieds) {
      if (!verByClassification.has(v.classification_id)) verByClassification.set(v.classification_id, v);
    }

    setRows(
      reportList.map((report) => {
        const cls = clsByReport.get(report.id) ?? null;
        const ver = cls ? verByClassification.get(cls.id) ?? null : null;
        return { report, classification: cls, verified: ver };
      }),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function rerun(row: Row) {
    if (!row.classification) return;
    const cid = row.classification.id;
    setBusyFor(cid);
    setActionError(null);
    try {
      const { error } = await supabase.functions.invoke("reconcile", {
        body: { classification_id: cid, force: true },
        headers: inviteHeaders(),
      });
      // Same iOS-Safari tolerance as ReportDetail: FunctionsFetchError
      // is expected on long calls; the row lands server-side regardless.
      if (error && error.name !== "FunctionsFetchError") {
        setActionError(`Re-run failed for ${row.report.id.slice(0, 8)}: ${error.message}`);
      }
      // Poll briefly for the fresh row before refreshing the whole list.
      const started = Date.now();
      while (Date.now() - started < 180_000) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data } = await supabase
          .from("verified_reports")
          .select("*")
          .eq("classification_id", cid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data && data.id !== row.verified?.id) break;
      }
      await load();
    } finally {
      setBusyFor(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header
        className="flex items-center justify-between gap-3 px-4 py-3"
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
        <span className="text-xs uppercase tracking-wider text-white/40">Reports</span>
        <button
          type="button"
          onClick={load}
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 active:scale-95"
        >
          Refresh
        </button>
      </header>

      {actionError && (
        <p className="mx-4 mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {actionError}
        </p>
      )}
      {partialError && (
        <p className="mx-4 mb-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Partial load — {partialError}
        </p>
      )}

      <main className="flex-1 space-y-2 p-4 pb-8">
        {loadError && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            Could not load reports: {loadError}
          </p>
        )}
        {rows === null && !loadError && (
          <p className="text-xs text-white/50">Loading reports…</p>
        )}
        {rows && rows.length === 0 && (
          <p className="text-xs text-white/50">No reports yet.</p>
        )}
        {rows?.map((row) => (
          <RowCard
            key={row.report.id}
            row={row}
            busy={busyFor === row.classification?.id}
            onRerun={() => rerun(row)}
          />
        ))}
      </main>
    </div>
  );
}

function RowCard({
  row,
  busy,
  onRerun,
}: {
  row: Row;
  busy: boolean;
  onRerun: () => void;
}) {
  const { report, classification, verified } = row;
  const canRerun = !!classification;

  return (
    <article className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <Link
        to={`/report/${report.id}`}
        className="flex flex-1 gap-3 active:opacity-80"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-black">
          {report.photo_url ? (
            <img
              src={report.photo_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/30">
              no photo
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-sm font-medium">
            {classification ? prettyPhenomenon(classification.phenomenon) : "Awaiting classification"}
          </p>
          <p className="text-[11px] tabular-nums text-white/50">
            {new Date(report.submitted_at).toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {verified && <VerdictPill verdict={verified.verdict} />}
            {!verified && classification && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
                no verdict
              </span>
            )}
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-white/40">
              {Math.round(report.heading_degrees)}°
            </span>
          </div>
        </div>
      </Link>
      <div className="flex flex-col justify-center">
        <button
          type="button"
          onClick={onRerun}
          disabled={!canRerun || busy}
          className="rounded-full bg-sky-500/20 px-3 py-1.5 text-[11px] font-medium text-sky-200 disabled:opacity-40 active:scale-95"
        >
          {busy ? "Re-running…" : "Re-run"}
        </button>
      </div>
    </article>
  );
}

function VerdictPill({ verdict }: { verdict: VerifiedReport["verdict"] }) {
  const tone: Record<VerifiedReport["verdict"], string> = {
    match: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    mismatch: "bg-red-500/15 text-red-300 border-red-500/30",
    inconclusive: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone[verdict]}`}>
      {verdict}
    </span>
  );
}

