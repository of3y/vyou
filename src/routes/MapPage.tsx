import { Link } from "react-router-dom";
import MapView from "../components/MapView";

export default function MapPage() {
  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <MapView />
      <Link
        to="/capture"
        className="absolute right-6 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black shadow-lg active:scale-95"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        Report
      </Link>
      <Link
        to="/about"
        className="absolute left-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        VYou
      </Link>
      <Link
        to="/reports"
        className="absolute right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        Reports
      </Link>
    </div>
  );
}
