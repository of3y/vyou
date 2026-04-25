import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Drawer } from "vaul";
import { getReport } from "../lib/api";
import { getReporterId } from "../lib/reporter";
import { cardinalFromDegrees, prettyPhenomenon } from "../lib/format";
import { notify } from "../lib/notify";
import WeatherChip from "./WeatherChip";
import type { Classification, Confidence, Report, VerifiedReport } from "../lib/types";

type Props = {
  reportId: string | null;
  onClose: () => void;
};

type DetailState = {
  report: Report;
  classification: Classification | null;
  verified: VerifiedReport | null;
};

export default function ConeDetailDrawer({ reportId, onClose }: Props) {
  const [data, setData] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(false);
  // Track latest loaded state in a ref so the polling loop can decide whether
  // to keep going without re-running the effect on every data change.
  const dataRef = useRef<DetailState | null>(null);
  dataRef.current = data;
  // onClose can be a fresh closure on every parent render — pin it via ref so
  // the load effect below depends only on reportId.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!reportId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    dataRef.current = null;

    async function load(isFirst: boolean) {
      const { data: result, error: err } = await getReport(reportId!, getReporterId());
      if (cancelled) return;
      if (err || !result) {
        // Only surface an error toast when we haven't shown anything yet —
        // background polls that flake are noise once the cone is on screen.
        if (isFirst || !dataRef.current) {
          notify.error(err ?? "Could not load this cone.");
          onCloseRef.current();
        }
        setLoading(false);
        return;
      }
      const next: DetailState = {
        report: result.report,
        classification: result.classification,
        verified: result.verified,
      };
      setData(next);
      dataRef.current = next;
      setLoading(false);
    }
    load(true);

    // Light poll while open so a freshly classified cone resolves itself
    // without the user closing and re-opening.
    const interval = setInterval(() => {
      const cur = dataRef.current;
      if (cur?.classification && cur?.verified) return;
      load(false);
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reportId]);

  const open = reportId !== null;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      modal={false}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#1a1c22]/70 text-white outline-none backdrop-blur-2xl"
          style={{ height: "50dvh" }}
        >
          <Drawer.Title className="sr-only">Cone detail</Drawer.Title>
          <Drawer.Description className="sr-only">
            Photo, classification, and verification for this cone.
          </Drawer.Description>

          <div className="no-scrollbar relative flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-center pt-2.5 pb-2">
              <Drawer.Handle
                className="!h-1 !w-10 !rounded-full !bg-white/20"
              />
            </div>
            <div
              className="px-6 pt-2"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              {loading && !data && <SkeletonBody />}
              {data && <DetailBody {...data} />}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function DetailBody({ report, classification, verified }: DetailState) {
  const captured = new Date(report.captured_at);
  const ageMin = Math.max(0, Math.round((Date.now() - captured.getTime()) / 60000));
  const ageLabel = ageMin === 0 ? "Just now" : ageMin === 1 ? "1 min ago" : `${ageMin} min ago`;
  const heading = Math.round(report.heading_degrees);
  const cardinal = cardinalFromDegrees(report.heading_degrees);
  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <h2 className="text-[24px] font-semibold leading-tight tracking-tight text-white">
          {classification ? prettyPhenomenon(classification.phenomenon) : "Classifying…"}
        </h2>
        <p className="mt-1 text-[13px] text-white/50">
          {ageLabel} · facing {cardinal} · {heading}°
        </p>
        <WeatherChip lat={report.lat} lon={report.lon} capturedAt={report.captured_at} />
      </header>

      {report.photo_url && (
        <figure className="overflow-hidden rounded-3xl bg-black shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
          <img
            src={report.photo_url}
            alt="Submitted sky photo"
            className="block w-full"
            loading="lazy"
          />
        </figure>
      )}

      {!classification && (
        <div className="flex items-center gap-2.5 rounded-3xl bg-white/[0.04] px-4 py-3.5 text-[14px] text-white/65">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Reading the sky…
        </div>
      )}

      {classification && <WeatherSummaryCard classification={classification} />}

      {verified && <VerificationRow verified={verified} />}

      <Link
        to={`/report/${report.id}`}
        className="flex items-center justify-center rounded-full bg-white text-[14px] font-semibold text-black shadow-lg transition-colors hover:bg-white/90 active:scale-[0.98]"
        style={{ height: 48 }}
      >
        Open full report
      </Link>
    </div>
  );
}

function WeatherSummaryCard({ classification }: { classification: Classification }) {
  const confidenceCopy: Record<Confidence, string> = {
    high: "Highly confident read",
    medium: "Reasonably confident read",
    low: "Tentative read",
  };
  const confidenceTone: Record<Confidence, string> = {
    high: "text-emerald-300/90",
    medium: "text-amber-300/90",
    low: "text-rose-300/90",
  };
  const confidence = classification.confidence;
  const features = classification.features ?? [];
  const hail = classification.hail_size_cm;

  return (
    <section className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-white/65">In this sky</p>
        {confidence && (
          <span className={`text-[11px] font-medium ${confidenceTone[confidence]}`}>
            {confidenceCopy[confidence]}
          </span>
        )}
      </div>

      {features.length > 0 && (
        <p className="mt-3 text-[15px] leading-relaxed text-white/85">
          {joinFeatures(features)}
        </p>
      )}

      {features.length === 0 && (
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          The classifier didn't surface specific cloud features for this view.
        </p>
      )}

      {hail !== null && hail !== undefined && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-[15px]">
            🧊
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">Hail</p>
            <p className="text-[15px] font-medium text-white/90">~{hail} cm across</p>
          </div>
        </div>
      )}
    </section>
  );
}

function joinFeatures(features: string[]): string {
  const cleaned = features.map((f) => f.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return ensureSentence(cleaned[0]);
  return cleaned.map(ensureSentence).join(" ");
}

function ensureSentence(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function VerificationRow({ verified }: { verified: VerifiedReport }) {
  const meta: Record<VerifiedReport["verdict"], { icon: string; tone: string; label: string }> = {
    match: {
      icon: "✓",
      tone: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
      label: "Confirmed against radar",
    },
    mismatch: {
      icon: "!",
      tone: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
      label: "Radar disagrees",
    },
    inconclusive: {
      icon: "·",
      tone: "bg-white/[0.06] text-white/60 ring-white/10",
      label: "Radar inconclusive",
    },
  };
  const m = meta[verified.verdict];
  return (
    <section className="flex items-start gap-3 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/[0.05]">
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ring-1 ${m.tone}`}
      >
        {m.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-white/90">{m.label}</p>
        {verified.rationale && (
          <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">{verified.rationale}</p>
        )}
      </div>
    </section>
  );
}

function SkeletonBody() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
      <div className="h-7 w-2/3 animate-pulse rounded bg-white/10" />
      <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-white/5" />
      <div className="h-20 w-full animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

