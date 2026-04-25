import { useState } from "react";
import { Link } from "react-router-dom";
import MapView, { type LayerVisibility } from "../components/MapView";
import LayerSwitcher from "../components/MapControls/LayerSwitcher";
import TimeSlider from "../components/MapControls/TimeSlider";
import type { LayerTime } from "../lib/layers/dwdRadar";

const DEFAULT_VISIBILITY: LayerVisibility = {
  cones: true,
  radar: true,
  lightning: true,
  ir: false,
};

export default function MapPage() {
  const [currentTime, setCurrentTime] = useState<LayerTime>("live");
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY);

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
