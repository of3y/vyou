import { Link } from "react-router-dom";
import MapView from "../components/MapView";

export default function MapPage() {
  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <MapView />
      <Link
        to="/capture"
        className="absolute bottom-6 right-6 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black shadow-lg active:scale-95"
      >
        Report
      </Link>
      <Link to="/about" className="absolute top-4 left-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80">
        VYou
      </Link>
    </div>
  );
}
