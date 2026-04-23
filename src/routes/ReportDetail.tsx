import { Link, useParams } from "react-router-dom";

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Report {id}</h1>
      <p className="max-w-md text-sm text-white/60">
        Photo, mini-map cone, Classifier output, Reconciliation judgment. Wiring lands after the capture flow is green.
      </p>
      <Link to="/" className="rounded-full bg-white/10 px-4 py-2 text-sm">
        Back to map
      </Link>
    </div>
  );
}
