import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MapView, { type LayerVisibility } from "../components/MapView";
import LayerSwitcher from "../components/MapControls/LayerSwitcher";
import TimeSlider from "../components/MapControls/TimeSlider";
import type { LayerTime } from "../lib/layers/dwdRadar";
import { supabase } from "../lib/supabase";
import { getReporterId } from "../lib/reporter";

const DEFAULT_VISIBILITY: LayerVisibility = {
  cones: true,
  radar: true,
  lightning: true,
  ir: false,
};

export default function MapPage() {
  const [currentTime, setCurrentTime] = useState<LayerTime>("live");
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY);
  const [questionsAvailable, setQuestionsAvailable] = useState(0);
  const [askTargetReportId, setAskTargetReportId] = useState<string | null>(null);

  // Surface "Ask" only when the local reporter has earned > used questions AND
  // owns a verified-match report to anchor the question to. /research is
  // anchored on report_id, so we route to the most-recent qualifying report.
  useEffect(() => {
    let cancelled = false;
    const reporterId = getReporterId();

    async function loadAskState() {
      const profilePromise = supabase
        .from("profiles")
        .select("questions_earned, questions_used")
        .eq("reporter_id", reporterId)
        .maybeSingle();
      const recentMatchPromise = supabase
        .from("verified_reports")
        .select("report_id, created_at, reports!inner(reporter_id)")
        .eq("verdict", "match")
        .eq("reports.reporter_id", reporterId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const [{ data: profile }, { data: match }] = await Promise.all([
        profilePromise,
        recentMatchPromise,
      ]);
      if (cancelled) return;

      const available = profile
        ? Math.max(0, (profile.questions_earned ?? 0) - (profile.questions_used ?? 0))
        : 0;
      setQuestionsAvailable(available);
      setAskTargetReportId((match as { report_id: string } | null)?.report_id ?? null);
    }

    loadAskState();
    const interval = setInterval(loadAskState, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const showAsk = questionsAvailable >= 1 && askTargetReportId;

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <MapView currentTime={currentTime} layerVisibility={visibility} />
      <Link
        to="/about"
        className="absolute left-4 z-10 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        VYou
      </Link>
      <Link
        to="/reports"
        className="absolute right-4 z-10 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        Reports
      </Link>
      {showAsk && (
        <Link
          to={`/report/${askTargetReportId}`}
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black shadow-lg active:scale-95"
          style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          {questionsAvailable} {questionsAvailable === 1 ? "question" : "questions"} · Ask
        </Link>
      )}
      <LayerSwitcher visibility={visibility} onChange={setVisibility} />
      <TimeSlider value={currentTime} onChange={setCurrentTime} />
      <Link
        to="/capture"
        className="absolute right-6 z-10 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black shadow-lg active:scale-95"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        Report
      </Link>
    </div>
  );
}
