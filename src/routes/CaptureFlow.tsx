import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notify } from "../lib/notify";
import { supabase } from "../lib/supabase";
import { submitReport } from "../lib/api";
import { getReporterId } from "../lib/reporter";
import { inviteHeaders } from "../lib/invite";
import { trackClassification } from "../lib/pendingClassification";
import {
  absoluteAlphaFromCompassHeading,
  cameraBearingFromDeviceOrientation,
} from "../lib/heading";

type Step = "permissions" | "camera" | "heading" | "submit" | "thanks";

type Capture = {
  blob: Blob;
  blobUrl: string;
  capturedAt: string;
  lon: number;
  lat: number;
  accuracyM: number | null;
};

export default function CaptureFlow() {
  const [step, setStep] = useState<Step>("permissions");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [liveHeading, setLiveHeading] = useState<number | null>(null);
  const [tilt, setTilt] = useState<{ beta: number; gamma: number } | null>(null);
  const [compassAccuracy, setCompassAccuracy] = useState<number | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Revoke the capture blob URL when it's replaced (retake) or the flow unmounts.
  useEffect(() => {
    const url = capture?.blobUrl;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [capture?.blobUrl]);

  useEffect(() => {
    if (step !== "camera" && step !== "heading") return;
    if (typeof DeviceOrientationEvent === "undefined") return;
    let sawAbsolute = false;
    const handler = (e: DeviceOrientationEvent, allowEventAlpha: boolean) => {
      const ios = e as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
        webkitCompassAccuracy?: number;
      };
      const beta = typeof e.beta === "number" && !Number.isNaN(e.beta) ? e.beta : 0;
      const gamma = typeof e.gamma === "number" && !Number.isNaN(e.gamma) ? e.gamma : 0;
      setTilt({ beta, gamma });
      let alpha: number | null = null;
      if (typeof ios.webkitCompassHeading === "number" && !Number.isNaN(ios.webkitCompassHeading)) {
        alpha = absoluteAlphaFromCompassHeading(ios.webkitCompassHeading);
      } else if (allowEventAlpha && typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
        alpha = e.alpha;
      }
      if (alpha !== null) {
        setLiveHeading(cameraBearingFromDeviceOrientation(alpha, beta, gamma));
      }
      if (typeof ios.webkitCompassAccuracy === "number" && ios.webkitCompassAccuracy >= 0) {
        setCompassAccuracy(ios.webkitCompassAccuracy);
      }
    };
    const absoluteHandler = (e: DeviceOrientationEvent) => {
      sawAbsolute = true;
      handler(e, true);
    };
    const relativeHandler = (e: DeviceOrientationEvent) => {
      // On Android, prefer absolute when both fire. iOS never fires absolute,
      // so relative is the only channel there (webkitCompassHeading absolutizes it).
      if (sawAbsolute) return;
      handler(e, e.absolute === true);
    };
    window.addEventListener("deviceorientationabsolute", absoluteHandler as EventListener, true);
    window.addEventListener("deviceorientation", relativeHandler, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", absoluteHandler as EventListener, true);
      window.removeEventListener("deviceorientation", relativeHandler, true);
    };
  }, [step]);

  async function requestPermissions() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined") {
        const orientation = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission;
        if (typeof orientation === "function") {
          const result = await orientation();
          if (result !== "granted") {
            notify.message("Orientation permission denied — manual heading only");
          }
        }
      }
      setStep("camera");
    } catch {
      setStep("camera");
    }
  }

  async function submit() {
    if (!capture) return;
    setSubmitting(true);
    try {
      const reporterId = getReporterId();
      const storagePath = `${reporterId}/${capture.capturedAt}-${crypto.randomUUID()}.jpg`;

      const upload = await supabase.storage
        .from("photos")
        .upload(storagePath, capture.blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });
      if (upload.error) throw upload.error;

      const { data: publicUrl } = supabase.storage.from("photos").getPublicUrl(storagePath);

      const { data, error } = await submitReport({
        reporter_id: reporterId,
        photo_url: publicUrl.publicUrl,
        lon: capture.lon,
        lat: capture.lat,
        heading_degrees: heading,
        location_accuracy_m: capture.accuracyM,
        captured_at: capture.capturedAt,
        caption: caption.trim() || null,
        status: "accepted",
      });

      if (error || !data) throw new Error(error ?? "submit failed");
      supabase.functions
        .invoke("classify", { body: { report_id: data.id }, headers: inviteHeaders() })
        .catch((e) => {
          console.warn("[VYou] classify invoke failed (will retry on report view)", e);
        });
      trackClassification(data.id);
      setSubmittedReportId(data.id);
      setSubmitting(false);
      setStep("thanks");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      notify.error(`Submit failed: ${message}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link to="/" className="text-sm text-white/60">
          ← Map
        </Link>
        <span className="text-xs uppercase tracking-wider text-white/40">
          {step === "thanks" ? "submitted" : step}
        </span>
      </header>

      <main className="flex-1 overflow-hidden">
        {step === "permissions" && <PermissionsStep onGrant={requestPermissions} />}
        {step === "camera" && (
          <CameraStep
            liveHeading={liveHeading}
            tilt={tilt}
            compassAccuracyDeg={compassAccuracy}
            onCaptured={(c) => {
              setCapture(c);
              if (liveHeading !== null) {
                setHeading(liveHeading);
                setStep("submit");
              } else {
                setStep("heading");
              }
            }}
          />
        )}
        {step === "heading" && capture && (
          <HeadingStep
            liveHeading={liveHeading}
            heading={heading}
            onHeading={setHeading}
            photoUrl={capture.blobUrl}
            gpsAccuracyM={capture.accuracyM}
            compassAccuracyDeg={compassAccuracy}
            onConfirm={() => setStep("submit")}
          />
        )}
        {step === "submit" && capture && (
          <SubmitStep
            photoUrl={capture.blobUrl}
            heading={heading}
            caption={caption}
            onCaption={setCaption}
            onSubmit={submit}
            submitting={submitting}
          />
        )}
        {step === "thanks" && submittedReportId && (
          <ThanksStep
            photoUrl={capture?.blobUrl}
            onBackToMap={() => navigate("/")}
            onAsk={() => navigate(`/report/${submittedReportId}`)}
          />
        )}
      </main>
    </div>
  );
}

function ThanksStep({
  photoUrl,
  onBackToMap,
  onAsk,
}: {
  photoUrl?: string;
  onBackToMap: () => void;
  onAsk: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-between gap-6 px-6 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        {photoUrl && (
          <div className="relative h-36 w-36 overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
            <img src={photoUrl} alt="Submitted sky" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}
        <div className="space-y-2">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Thanks for the sky</h1>
          <p className="mx-auto max-w-sm text-[14px] leading-relaxed text-white/60">
            Your cone is on the map. Opus is reading it now —
            we'll ping you the moment the classification lands.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/65">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Classifying in the background
        </span>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onBackToMap}
          className="rounded-full bg-white px-8 py-3 text-[14px] font-semibold text-black shadow-[0_10px_30px_-10px_rgba(255,255,255,0.4)] active:scale-[0.98]"
        >
          Back to map
        </button>
        <button
          onClick={onAsk}
          className="rounded-full border border-white/15 bg-white/[0.04] px-8 py-3 text-[14px] font-semibold text-white backdrop-blur active:scale-[0.98]"
        >
          Ask a question about this sky
        </button>
      </div>
    </div>
  );
}

function PermissionsStep({ onGrant }: { onGrant: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Grant permissions</h1>
      <p className="max-w-md text-sm text-white/60">
        VYou needs camera, location, and device orientation to turn your sky photo into a directional cone on the shared map.
        On iOS, Safari will prompt for each in turn.
      </p>
      <p className="max-w-md text-xs text-white/40">
        Tip: hold the phone upright (portrait) when taking the photo — the heading is most
        reliable that way. You can adjust it manually on the next step.
      </p>
      <button
        onClick={onGrant}
        className="rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold text-black active:scale-95"
      >
        Continue
      </button>
    </div>
  );
}

function CameraStep({
  onCaptured,
  liveHeading,
  tilt,
  compassAccuracyDeg,
}: {
  onCaptured: (c: Capture) => void;
  liveHeading: number | null;
  tilt: { beta: number; gamma: number } | null;
  compassAccuracyDeg: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(orientation: landscape)").matches;
  });
  const [landscapeDismissed, setLandscapeDismissed] = useState(false);

  // Re-show the disclaimer on every portrait→landscape transition so testers
  // who rotated mid-capture get the heads-up — heading math is most reliable
  // when the device is held upright.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(orientation: landscape)");
    const update = (e: MediaQueryList | MediaQueryListEvent) => {
      const next = e.matches;
      setIsLandscape(next);
      if (next) setLandscapeDismissed(false);
    };
    update(mq);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Older Safari fallback.
    const legacyHandler = (e: MediaQueryListEvent) => update(e);
    mq.addListener(legacyHandler);
    return () => mq.removeListener(legacyHandler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  async function shoot() {
    if (!videoRef.current || !ready) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      notify.error("Could not encode photo");
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const capturedAt = new Date().toISOString();

    try {
      const position = await getPositionWithFallback();
      onCaptured({
        blob,
        blobUrl,
        capturedAt,
        lon: position.coords.longitude,
        lat: position.coords.latitude,
        accuracyM: position.coords.accuracy ?? null,
      });
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      notify.error(explainGeoError(err));
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-red-400">
        <p>Camera error: {error}</p>
        <p className="text-xs text-white/40">Browser needs camera permission; try reloading and accepting the prompt.</p>
      </div>
    );
  }

  const compassT = compassTier(compassAccuracyDeg);

  // Target pose: phone held upright in portrait (beta ≈ 90°, gamma ≈ 0°).
  // Tolerance is per-axis so the globe can hint at *which* axis is off, not
  // just that the phone is tilted. If the orientation sensor never fired
  // (or permission was denied) we don't gate capture — heading-step manual
  // entry still works.
  const TILT_TOLERANCE = 10;
  const pitchOff = tilt ? tilt.beta - 90 : 0;
  const rollOff = tilt ? tilt.gamma : 0;
  const tiltOK = !tilt || (Math.abs(pitchOff) < TILT_TOLERANCE && Math.abs(rollOff) < TILT_TOLERANCE);
  const showRedEdge = !!tilt && !tiltOK;
  const canShoot = ready && tiltOK && !isLandscape;

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            boxShadow: "inset 0 0 50px 8px rgba(239, 68, 68, 0.28)",
            opacity: showRedEdge ? 1 : 0,
          }}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-xs backdrop-blur ${trustPillClasses(compassT)}`}
          style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <span className="opacity-60">Heading</span>
          <span className="tabular-nums text-base font-semibold">
            {liveHeading !== null ? `${Math.round(liveHeading)}°` : "—"}
          </span>
          <TrustDot tier={compassT} />
          <span className="tabular-nums opacity-70">{compassLabel(compassAccuracyDeg)}</span>
        </div>
        <div
          className="pointer-events-none absolute right-3"
          style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
          <TiltGlobe pitchOff={pitchOff} rollOff={rollOff} tolerance={TILT_TOLERANCE} active={!!tilt} />
        </div>
        {isLandscape && !landscapeDismissed && (
          <div
            className="absolute left-3 right-3 z-10 rounded-xl border border-amber-400/70 bg-amber-500/95 px-4 py-3 text-xs text-amber-950 shadow-lg"
            style={{ top: "calc(3.75rem + env(safe-area-inset-top))" }}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-semibold">Landscape detected</p>
                <p className="mt-1 leading-snug">
                  Heading is most accurate when the phone is held upright. If you stay in
                  landscape, double-check the live heading above against the direction you're
                  pointing, and adjust on the next step if needed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLandscapeDismissed(true)}
                className="rounded-full bg-amber-950/15 px-2 py-0.5 text-[11px] font-semibold text-amber-950"
                aria-label="Dismiss landscape notice"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        className="relative flex shrink-0 items-center justify-between gap-4 bg-black px-6 pt-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="h-11 w-11" aria-hidden />
        <button
          onClick={shoot}
          disabled={!canShoot}
          className="h-16 w-16 shrink-0 rounded-full border-4 border-white bg-white/20 active:scale-90 disabled:opacity-40"
          aria-label="Take photo"
        />
        <button
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur active:scale-90"
          aria-label="Flip camera"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function TiltGlobe({
  pitchOff,
  rollOff,
  tolerance,
  active,
}: {
  pitchOff: number;
  rollOff: number;
  tolerance: number;
  active: boolean;
}) {
  const SIZE = 64;
  const C = SIZE / 2;
  const R = C - 8;

  const ok = active && Math.abs(pitchOff) < tolerance && Math.abs(rollOff) < tolerance;
  const upBad = active && pitchOff < -tolerance;
  const downBad = active && pitchOff > tolerance;
  const leftBad = active && rollOff < -tolerance;
  const rightBad = active && rollOff > tolerance;

  // Wireframe rotates with the device pose so the sphere reads as a real
  // gyroscope: pitch tips the equator, roll spins the polar axis.
  const VIS_CLAMP = tolerance * 2.2;
  const cl = (v: number) => Math.max(-VIS_CLAMP, Math.min(VIS_CLAMP, v));
  const tiltX = cl(pitchOff);
  const tiltZ = cl(rollOff);

  const stroke = ok
    ? "rgba(110, 231, 183, 0.95)"
    : active
    ? "rgba(255, 255, 255, 0.85)"
    : "rgba(255, 255, 255, 0.55)";
  const strokeFaint = ok ? "rgba(110, 231, 183, 0.45)" : "rgba(255, 255, 255, 0.3)";
  const arrowColor = (bad: boolean) =>
    ok ? "rgba(110, 231, 183, 0.95)" : bad ? "rgba(248, 113, 113, 0.95)" : "rgba(255,255,255,0.3)";
  const glow = ok
    ? "drop-shadow(0 0 6px rgba(16,185,129,0.85)) drop-shadow(0 0 14px rgba(16,185,129,0.5))"
    : "drop-shadow(0 1px 2px rgba(0,0,0,0.6))";

  // Latitude rings: ellipses squashed by |cos(pitch)|, then the whole sphere
  // rotated by roll. Negative y on the screen is "up", so positive pitch (top
  // tipped away) lifts the equator visually.
  const latRy = (offsetDeg: number) => {
    const phi = (offsetDeg * Math.PI) / 180;
    return Math.abs(Math.cos(phi));
  };
  const latCy = (offsetDeg: number) => {
    const phi = ((offsetDeg + tiltX * 1.6) * Math.PI) / 180;
    return Math.sin(phi);
  };

  return (
    <div className="rounded-full p-[5px]" style={{ background: "rgba(0,0,0,0.35)", filter: glow }} aria-hidden>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <g transform={`rotate(${tiltZ} ${C} ${C})`} fill="none" strokeLinecap="round">
          {/* outer sphere outline */}
          <circle cx={C} cy={C} r={R} stroke={stroke} strokeWidth="1.1" />
          {/* equator + two latitudes, perspective-flattened by pitch */}
          {[0, -30, 30].map((lat) => (
            <ellipse
              key={lat}
              cx={C}
              cy={C + latCy(lat) * R * 0.55}
              rx={R}
              ry={R * latRy(lat + tiltX * 1.6)}
              stroke={lat === 0 ? stroke : strokeFaint}
              strokeWidth={lat === 0 ? 1 : 0.7}
            />
          ))}
          {/* meridians: polar ellipse + a 60° rotated one */}
          <ellipse cx={C} cy={C} rx={R * Math.abs(Math.sin((tiltX * 1.6 * Math.PI) / 180)) || 0.001} ry={R} stroke={strokeFaint} strokeWidth="0.7" />
          <g transform={`rotate(60 ${C} ${C})`}>
            <ellipse
              cx={C}
              cy={C}
              rx={R * Math.abs(Math.sin(((tiltX * 1.6 + 60) * Math.PI) / 180)) || 0.001}
              ry={R}
              stroke={strokeFaint}
              strokeWidth="0.7"
            />
          </g>
          {/* polar axis line */}
          <line x1={C} y1={C - R} x2={C} y2={C + R} stroke={stroke} strokeWidth="0.9" />
          {/* level dot at the projected "north pole" of upright orientation */}
          {active && ok && <circle cx={C} cy={C} r="1.6" fill="rgba(167,243,208,1)" />}
        </g>
        {/* fixed-frame chevrons sit outside the rotating sphere */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2">
          <polyline points={`${C - 3},5 ${C},1.5 ${C + 3},5`} stroke={arrowColor(upBad)} />
          <polyline points={`${C - 3},${SIZE - 5} ${C},${SIZE - 1.5} ${C + 3},${SIZE - 5}`} stroke={arrowColor(downBad)} />
          <polyline points={`5,${C - 3} 1.5,${C} 5,${C + 3}`} stroke={arrowColor(leftBad)} />
          <polyline points={`${SIZE - 5},${C - 3} ${SIZE - 1.5},${C} ${SIZE - 5},${C + 3}`} stroke={arrowColor(rightBad)} />
        </g>
      </svg>
    </div>
  );
}

function HeadingStep({
  liveHeading,
  heading,
  onHeading,
  photoUrl,
  gpsAccuracyM,
  compassAccuracyDeg,
  onConfirm,
}: {
  liveHeading: number | null;
  heading: number;
  onHeading: (h: number) => void;
  photoUrl: string;
  gpsAccuracyM: number | null;
  compassAccuracyDeg: number | null;
  onConfirm: () => void;
}) {
  const hasMagnetometer = liveHeading !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="h-1/3 w-full overflow-hidden bg-black">
        <img src={photoUrl} alt="Captured sky" className="h-full w-full object-cover" />
      </div>
      <div
        className="flex flex-1 flex-col justify-between gap-6 p-6"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-wider text-white/40">Facing direction</p>
          <p className="text-5xl font-semibold tabular-nums">{Math.round(heading)}°</p>
          <p className="text-xs text-white/50">
            {hasMagnetometer
              ? `Device compass: ${Math.round(liveHeading)}° — tap "Use compass" to snap`
              : "No compass detected — adjust the slider to point at the sky you photographed"}
          </p>
          <TrustChips gpsAccuracyM={gpsAccuracyM} compassAccuracyDeg={compassAccuracyDeg} />
        </div>

        <div className="flex flex-col gap-3">
          {hasMagnetometer && (
            <button
              onClick={() => onHeading(liveHeading)}
              className="rounded-full bg-white/10 px-4 py-2 text-sm"
            >
              Use compass ({Math.round(liveHeading)}°)
            </button>
          )}
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={heading}
            onChange={(e) => onHeading(Number(e.target.value))}
            className="w-full"
            aria-label="Heading degrees"
          />
          <div className="flex justify-between text-xs text-white/40">
            <span>N 0°</span>
            <span>E 90°</span>
            <span>S 180°</span>
            <span>W 270°</span>
            <span>N 360°</span>
          </div>
        </div>

        <button
          onClick={onConfirm}
          className="rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold text-black active:scale-95"
        >
          Confirm heading
        </button>
      </div>
    </div>
  );
}

function SubmitStep({
  photoUrl,
  heading,
  caption,
  onCaption,
  onSubmit,
  submitting,
}: {
  photoUrl: string;
  heading: number;
  caption: string;
  onCaption: (c: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="relative overflow-hidden rounded-lg border border-white/10 bg-black active:scale-[0.99]"
          aria-label="Enlarge photo"
        >
          <img src={photoUrl} alt="Captured sky" className="max-h-[40dvh] w-full object-contain" />
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70 backdrop-blur">
            Tap to enlarge
          </span>
        </button>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 self-start">
          <span className="text-white/50">Heading</span>
          <span className="tabular-nums font-semibold">{Math.round(heading)}°</span>
        </div>
        <textarea
          value={caption}
          onChange={(e) => onCaption(e.target.value.slice(0, 280))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          rows={2}
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck
          enterKeyHint="done"
          name="caption"
          className="rounded-lg border border-white/10 bg-white/5 p-3"
          placeholder="Caption (optional)"
        />
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold text-black active:scale-95 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
      {enlarged && (
        <button
          type="button"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          aria-label="Close enlarged photo"
        >
          <img src={photoUrl} alt="Captured sky (enlarged)" className="max-h-full max-w-full object-contain" />
          <span
            className="absolute right-4 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
            style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
          >
            Tap to close
          </span>
        </button>
      )}
    </div>
  );
}

function TrustChips({
  gpsAccuracyM,
  compassAccuracyDeg,
}: {
  gpsAccuracyM: number | null;
  compassAccuracyDeg: number | null;
}) {
  const gps = gpsTier(gpsAccuracyM);
  const compass = compassTier(compassAccuracyDeg);
  return (
    <div className="flex justify-center gap-2 pt-2">
      <Chip label="GPS" value={gpsLabel(gpsAccuracyM)} tier={gps} />
      <Chip label="Compass" value={compassLabel(compassAccuracyDeg)} tier={compass} />
    </div>
  );
}

type Tier = "high" | "medium" | "low" | "unknown";

function trustPillClasses(tier: Tier): string {
  switch (tier) {
    case "high":
      return "border-2 border-emerald-400 bg-emerald-500/20 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]";
    case "medium":
      return "border border-amber-400/70 bg-amber-500/20 text-amber-50";
    case "low":
      return "border border-red-400/70 bg-red-500/20 text-red-50";
    case "unknown":
    default:
      return "border border-white/10 bg-black/60 text-white/90";
  }
}

function TrustDot({ tier }: { tier: Tier }) {
  const color: Record<Tier, string> = {
    high: "bg-emerald-400",
    medium: "bg-amber-400",
    low: "bg-red-400",
    unknown: "bg-white/30",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${color[tier]}`} aria-hidden />;
}

function Chip({ label, value, tier }: { label: string; value: string; tier: Tier }) {
  const tone: Record<Tier, string> = {
    high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-red-500/15 text-red-300 border-red-500/30",
    unknown: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${tone[tier]}`}>
      <span className="text-white/50">{label}</span> <span className="tabular-nums">{value}</span>
    </span>
  );
}

function gpsTier(acc: number | null): Tier {
  if (acc == null) return "unknown";
  if (acc <= 25) return "high";
  if (acc <= 100) return "medium";
  return "low";
}

function gpsLabel(acc: number | null): string {
  if (acc == null) return "—";
  return `±${Math.round(acc)} m`;
}

function compassTier(acc: number | null): Tier {
  if (acc == null) return "unknown";
  if (acc <= 10) return "high";
  if (acc <= 25) return "medium";
  return "low";
}

function compassLabel(acc: number | null): string {
  if (acc == null) return "n/a";
  return `±${Math.round(acc)}°`;
}

async function getPositionWithFallback(): Promise<GeolocationPosition> {
  const tryOnce = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, options),
    );

  try {
    return await tryOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  } catch (highErr) {
    console.warn("[VYou] high-accuracy geolocation failed, retrying with low accuracy", highErr);
    return await tryOnce({ enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
  }
}

function explainGeoError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as GeolocationPositionError;
    if (e.code === e.PERMISSION_DENIED) return "Location permission denied. Tap 'aA' → Website Settings → Location: Allow, then reload.";
    if (e.code === e.POSITION_UNAVAILABLE) return "Location unavailable — GPS/WiFi could not fix position. Try near a window or outdoors.";
    if (e.code === e.TIMEOUT) return "Location timed out. Move to a window or try again outdoors.";
    return `Location error (code ${e.code}): ${e.message}`;
  }
  return err instanceof Error ? err.message : "Unknown location error";
}
