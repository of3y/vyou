import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import MapPage from "./routes/MapPage";
import CaptureFlow from "./routes/CaptureFlow";
import ReportDetail from "./routes/ReportDetail";
import AboutPage from "./routes/AboutPage";
import IOSInstallHint from "./components/IOSInstallHint";
import InviteBanner from "./components/InviteBanner";
import { captureInviteFromUrl } from "./lib/invite";

export default function App() {
  useEffect(() => {
    captureInviteFromUrl();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/capture" element={<CaptureFlow />} />
        <Route path="/report/:id" element={<ReportDetail />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <InviteBanner />
      <IOSInstallHint />
    </>
  );
}
