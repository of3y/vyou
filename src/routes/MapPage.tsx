import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MapView, { type LayerVisibility } from "../components/MapView";
import LayersDrawer from "../components/MapControls/LayersDrawer";
import TimeSlider, { type WindowKey } from "../components/MapControls/TimeSlider";
import StatusPill, { useConnStatus } from "../components/StatusPill";
import ConeDetailDrawer from "../components/ConeDetailDrawer";
import AskQuestionFab from "../components/AskQuestionFab";
import type { LayerTime } from "../lib/layers/dwdRadar";
import { listReports } from "../lib/api";
import { getReporterId } from "../lib/reporter";

const DEFAULT_VISIBILITY: LayerVisibility = {
  cones: true,
  radar: false,
  lightning: false,
  ir: false,
};

const WINDOW_MS: Record<WindowKey, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

export default function MapPage() {
  const [currentTime, setCurrentTime] = useState<LayerTime>("live");
  const [windowKey, setWindowKey] = useState<WindowKey>("6h");
  const [timeMode, setTimeMode] = useState(false);
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY);
  const [questionsAvailable, setQuestionsAvailable] = useState(0);
  const [askTargetReportId, setAskTargetReportId] = useState<string | null>(null);
  const [activeConeId, setActiveConeId] = useState<string | null>(null);
  const conn = useConnStatus();
  const { recordOk, recordError } = conn;
  const refreshAskStateRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const reporterId = getReporterId();

    async function loadAskState() {
      const startedAt = performance.now();
      const { data, error } = await listReports({ reporter_id: reporterId, limit: 100 });
      if (cancelled) return;
      if (error || !data) {
        recordError();
        return;
      }
      recordOk(performance.now() - startedAt);

      const available = data.profile
        ? Math.max(0, (data.profile.questions_earned ?? 0) - (data.profile.questions_used ?? 0))
        : 0;
      setQuestionsAvailable(available);

      const ownMatch = data.reports.find(
        (r) => r.reporter_id === reporterId && r.verified?.verdict === "match",
      );
      setAskTargetReportId(ownMatch?.id ?? null);
    }

    refreshAskStateRef.current = loadAskState;
    loadAskState();
    const interval = setInterval(loadAskState, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [recordOk, recordError]);

  const handleAnswered = useCallback(() => {
    refreshAskStateRef.current();
  }, []);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0f1115]">
      <MapView
        currentTime={currentTime}
        layerVisibility={visibility}
        onConeClick={setActiveConeId}
        activeReportId={activeConeId}
        windowMs={WINDOW_MS[windowKey]}
      />

      {/* Top-left: combined VYou identity + connection status. */}
      <div
        className="absolute left-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 py-1 pl-1 pr-2 shadow-[0_4px_18px_-6px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          to="/about"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[12px] font-semibold tracking-[0.01em] text-white"
          aria-label="About VYou"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          VYou
        </Link>
        <StatusPill status={conn.status} lastOkAt={conn.lastOkAt} />
      </div>

      {/* Top-right: Reports link. */}
      <Link
        to="/reports"
        className="absolute right-3 z-10 inline-flex items-center rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-xl transition-colors hover:bg-black/65"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        Reports
      </Link>

      <div
        aria-hidden={timeMode}
        className={`transition-opacity duration-200 ${timeMode ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <LayersDrawer visibility={visibility} onChange={setVisibility} />
      </div>

      {/* Bottom: dual-state cluster. CTA + clock by default; time slider in time-mode. */}
      <div
        className="absolute inset-x-0 z-10 flex justify-center px-4"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div
          aria-hidden={timeMode}
          className={`flex items-center gap-2 transition-all duration-200 ${
            timeMode ? "pointer-events-none translate-y-1 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <Link
            to="/capture"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold tracking-tight text-black shadow-[0_10px_40px_-10px_rgba(16,185,129,0.55),0_4px_16px_-4px_rgba(0,0,0,0.6)] ring-1 ring-black/5 transition-all hover:bg-white/95 active:scale-[0.97]"
            style={{ height: 52 }}
          >
            <PlusIcon />
            <span>Add Cone</span>
          </Link>
          <AskQuestionFab
            reportId={askTargetReportId}
            questionsAvailable={questionsAvailable}
            onAnswered={handleAnswered}
          />
          <button
            type="button"
            onClick={() => setTimeMode(true)}
            aria-label="Show time controls"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-colors hover:bg-black/70 hover:text-white active:scale-[0.96]"
            style={{ width: 52, height: 52 }}
          >
            <ClockIcon />
          </button>
        </div>
      </div>

      {timeMode && (
        <TimeSlider
          value={currentTime}
          onChange={setCurrentTime}
          windowKey={windowKey}
          onWindowChange={setWindowKey}
          onClose={() => setTimeMode(false)}
        />
      )}

      <ConeDetailDrawer reportId={activeConeId} onClose={() => setActiveConeId(null)} />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
