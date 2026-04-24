import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import IOSInstallHint from "./components/IOSInstallHint";
import InviteBanner from "./components/InviteBanner";
import { captureInviteFromUrl } from "./lib/invite";

const MapPage = lazy(() => import("./routes/MapPage"));
const CaptureFlow = lazy(() => import("./routes/CaptureFlow"));
const ReportDetail = lazy(() => import("./routes/ReportDetail"));
const ReportsList = lazy(() => import("./routes/ReportsList"));
const AboutPage = lazy(() => import("./routes/AboutPage"));

function RouteFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-black text-sm text-white/50">
      Loading…
    </div>
  );
}

export default function App() {
  useEffect(() => {
    captureInviteFromUrl();
  }, []);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/capture" element={<CaptureFlow />} />
          <Route path="/report/:id" element={<ReportDetail />} />
          <Route path="/reports" element={<ReportsList />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Suspense>
      <InviteBanner />
      <IOSInstallHint />
    </>
  );
}
