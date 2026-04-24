import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { getReporterId } from "../lib/reporter";
import { inviteHeaders } from "../lib/invite";

type Step = "permissions" | "camera" | "heading" | "submit";

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
  const [compassAccuracy, setCompassAccuracy] = useState<number | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
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
    const handler = (e: DeviceOrientationEvent) => {
      const ios = e as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
        webkitCompassAccuracy?: number;
      };
      const value = typeof ios.webkitCompassHeading === "number"
        ? ios.webkitCompassHeading
        : typeof e.alpha === "number"
        ? 360 - e.alpha
        : null;
      if (value !== null && !Number.isNaN(value)) setLiveHeading(value);
      if (typeof ios.webkitCompassAccuracy === "number" && ios.webkitCompassAccuracy >= 0) {
        setCompassAccuracy(ios.webkitCompassAccuracy);
      }
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [step]);

  async function requestPermissions() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined") {
        const orientation = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission;
        if (typeof orientation === "function") {
          const result = await orientation();
          if (result !== "granted") {
            toast("Orientation permission denied — manual heading only");
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

      const { data, error } = await supabase
        .from("reports")
        .insert({
          reporter_id: reporterId,
          photo_url: publicUrl.publicUrl,
          location: `POINT(${capture.lon} ${capture.lat})`,
          heading_degrees: heading,
          location_accuracy_m: capture.accuracyM,
          captured_at: capture.capturedAt,
          caption: caption.trim() || null,
          status: "accepted",
        })
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Report submitted");
      supabase.functions
        .invoke("classify", { body: { report_id: data.id }, headers: inviteHeaders() })
        .catch((e) => {
          console.warn("[VYou] classify invoke failed (will retry on report view)", e);
        });
      navigate(`/report/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Submit failed: ${message}`);
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
        <span className="text-xs uppercase tracking-wider text-white/40">{step}</span>
      </header>

      <main className="flex-1 overflow-hidden">
        {step === "permissions" && <PermissionsStep onGrant={requestPermissions} />}
        {step === "camera" && (
          <CameraStep
            liveHeading={liveHeading}
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
      </main>
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
  compassAccuracyDeg,
}: {
  onCaptured: (c: Capture) => void;
  liveHeading: number | null;
  compassAccuracyDeg: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

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
      toast.error("Could not encode photo");
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
      toast.error(explainGeoError(err));
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

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
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
      <button
        onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
        className="absolute right-6 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur active:scale-90"
        style={{ bottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
        aria-label="Flip camera"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      </button>
      <button
        onClick={shoot}
        disabled={!ready}
        className="absolute left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border-4 border-white bg-white/20 active:scale-90 disabled:opacity-40"
        style={{ bottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        aria-label="Take photo"
      />
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
