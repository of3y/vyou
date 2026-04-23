import { Link } from "react-router-dom";

export default function CaptureFlow() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Capture flow</h1>
      <p className="max-w-md text-sm text-white/60">
        Four-step skeleton: permission gate → camera capture → heading confirm → submit. Wiring lands in the 19:30 build slot.
      </p>
      <Link to="/" className="rounded-full bg-white/10 px-4 py-2 text-sm">
        Back to map
      </Link>
    </div>
  );
}
