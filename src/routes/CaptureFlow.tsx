import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { getReporterId } from "../lib/reporter";

type Step = "permissions" | "camera" | "heading" | "submit";

type Capture = {
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
  const [caption, setCaption] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (step !== "heading") return;
    const handler = (e: DeviceOrientationEvent) => {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const value = typeof ios === "number" ? ios : typeof e.alpha === "number" ? 360 - e.alpha : null;
      if (value !== null && !Number.isNaN(value)) setLiveHeading(value);
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [step]);

  async function requestPermissions() {
    try {
      const orientation = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission;
      if (typeof orientation === "function") {
        const result = await orientation();
        if (result !== "granted") {
          toast("Orientation permission denied — manual heading only");
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
      const { data, error } = await supabase
        .from("reports")
        .insert({
          reporter_id: getReporterId(),
          photo_url: null,
          location: `POINT(${capture.lon} ${capture.lat})`,
          heading_degrees: heading,
          heading_accuracy_m: capture.accuracyM,
          captured_at: capture.capturedAt,
          caption: caption.trim() || null,
          status: "accepted",
        })
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Report submitted");
      navigate(`/report/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Submit failed: ${message}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="text-sm text-white/60">
          ← Map
        </Link>
        <span className="text-xs uppercase tracking-wider text-white/40">{step}</span>
      </header>

      <main className="flex-1 overflow-hidden">
        {step === "permissions" && <PermissionsStep onGrant={requestPermissions} />}
        {step === "camera" && (
          <CameraStep
            onCaptured={(c) => {
              setCapture(c);
              setStep("heading");
            }}
          />
        )}
        {step === "heading" && capture && (
          <HeadingStep
            liveHeading={liveHeading}
            heading={heading}
            onHeading={setHeading}
            photoUrl={capture.blobUrl}
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

function CameraStep({ onCaptured }: { onCaptured: (c: Capture) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
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
  }, []);

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
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      onCaptured({
        blobUrl,
        capturedAt,
        lon: position.coords.longitude,
        lat: position.coords.latitude,
        accuracyM: position.coords.accuracy ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Location unavailable";
      toast.error(`Location failed: ${message}`);
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

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      <button
        onClick={shoot}
        disabled={!ready}
        className="absolute bottom-8 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border-4 border-white bg-white/20 active:scale-90 disabled:opacity-40"
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
  onConfirm,
}: {
  liveHeading: number | null;
  heading: number;
  onHeading: (h: number) => void;
  photoUrl: string;
  onConfirm: () => void;
}) {
  const hasMagnetometer = liveHeading !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="h-1/3 w-full overflow-hidden bg-black">
        <img src={photoUrl} alt="Captured sky" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-6 p-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-wider text-white/40">Facing direction</p>
          <p className="text-5xl font-semibold tabular-nums">{Math.round(heading)}°</p>
          <p className="text-xs text-white/50">
            {hasMagnetometer
              ? `Device compass: ${Math.round(liveHeading)}° — tap "Use compass" to snap`
              : "No compass detected — adjust the slider to point at the sky you photographed"}
          </p>
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
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex gap-4">
        <img src={photoUrl} alt="Captured sky" className="h-24 w-24 rounded-lg object-cover" />
        <div className="flex flex-col justify-center text-sm">
          <p className="text-white/60">Heading</p>
          <p className="text-xl font-semibold">{Math.round(heading)}°</p>
        </div>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-white/60">Caption (optional, ≤ 280 chars)</span>
        <textarea
          value={caption}
          onChange={(e) => onCaption(e.target.value.slice(0, 280))}
          rows={3}
          className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
          placeholder="What do you see?"
        />
      </label>
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="mt-auto rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold text-black active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit report"}
      </button>
    </div>
  );
}
