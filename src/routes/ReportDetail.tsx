import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MapView from "../components/MapView";
import type { Brief, BriefSource, Classification, Confidence, EarnedQuestion, Report, SessionStats, VerifiedReport } from "../lib/types";
import { inviteHeaders } from "../lib/invite";
import { getReport } from "../lib/api";
import { prettyPhenomenon } from "../lib/format";
import { getReporterId } from "../lib/reporter";

const POLL_INTERVAL_MS = 2500;
const CLASSIFY_POLL_TIMEOUT_MS = 90_000;
const RECONCILE_POLL_TIMEOUT_MS = 180_000;
const RESEARCH_POLL_TIMEOUT_MS = 60_000;

// Module-scoped: survives component remount within the same browser session,
// keyed by classification id. Server-side idempotency is the durable guard.
const reconcileDispatchSet = new Set<string>();
const classifyDispatchSet = new Set<string>();

// Identity-stable setters for poll loops (Hardened-plan v2 §2 Fix B prereq).
// The poll fetches the same row every 2.5s; without this, every tick swaps
// the object identity and the React tree underneath thrashes — that was the
// root of the 16:01 5-second reconcile-flicker bug. Keep the previous
// reference when the row's id matches.
function setClassificationStable(
  setter: React.Dispatch<React.SetStateAction<Classification | null>>,
  next: Classification,
): void {
  setter((prev) => (prev?.id === next.id ? prev : next));
}
function setVerifiedStable(
  setter: React.Dispatch<React.SetStateAction<VerifiedReport | null>>,
  next: VerifiedReport,
): void {
  setter((prev) => (prev?.id === next.id ? prev : next));
}
function setBriefStable(
  setter: React.Dispatch<React.SetStateAction<Brief | null>>,
  next: Brief,
): void {
  setter((prev) => (prev?.id === next.id ? prev : next));
}

const DEV_DEBUG =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"));

// `?debug=1` (or any presence of the `debug` flag) flips the Reconciliation
// card from hidden to visible. The debug flag is also what shows the cost
// footer; keeping the same flag for both keeps the URL hygiene tidy.
const SHOW_DEBUG =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedReport | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyRequested, setVerifyRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await getReport(id, getReporterId());
      if (error || !data) {
        setError(error ?? "Could not load report");
        return;
      }
      setReport(data.report);
      if (data.classification) setClassification(data.classification);
      if (data.verified) setVerified(data.verified);
      if (data.brief) setBrief(data.brief);
    })();
  }, [id]);

  const [classifyAttempt, setClassifyAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function tick() {
      if (cancelled) return;
      const { data } = await getReport(id!, getReporterId());
      if (cancelled) return;
      if (data?.classification) {
        setClassificationStable(setClassification, data.classification);
        return;
      }
      // On first poll pass, dispatch classify if no existing row and we
      // haven't already dispatched it in this browser session. Classify is
      // idempotent server-side (keyed on report_id), so a double-dispatch
      // with the CaptureFlow fire-and-forget invoke is safe — the second
      // call returns the cached classification.
      const dispatchKey = id!;
      if (!classifyDispatchSet.has(dispatchKey)) {
        classifyDispatchSet.add(dispatchKey);
        supabase.functions
          .invoke("classify", { body: { report_id: id }, headers: inviteHeaders() })
          .catch((e) => {
            // FunctionsFetchError on iOS PWA is expected for long calls;
            // polling will still pick up the server-written row.
            console.warn("[classify] invoke fetch failed (polling continues)", e);
          });
      }
      if (Date.now() - startedAt > CLASSIFY_POLL_TIMEOUT_MS) {
        setClassifyError("Classifier did not respond within 90s.");
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [id, classifyAttempt]);

  function retryClassify() {
    if (!id) return;
    classifyDispatchSet.delete(id);
    setClassifyError(null);
    setClassifyAttempt((n) => n + 1);
  }

  // Module-scoped guard so a remount (iOS bfcache eviction, back-nav, tab
  // restore) does not re-fire reconcile for a classification we already
  // dispatched in this browser session. Server-side idempotency is the
  // durable guard; this prevents the visible "spinner restarts" UX bug.
  const dispatchedReconcileFor = useRef<Set<string>>(reconcileDispatchSet);

  // On classification change: one-shot check for an existing verified_report.
  // If present, render it. Never auto-invoke — the Verify button below is the
  // only trigger for a paid reconcile session. Visiting a report (old or new)
  // costs zero until the visitor taps the button.
  useEffect(() => {
    if (!classification) return;
    let cancelled = false;
    const cid = classification.id;

    const skipPhenomena = new Set(["out_of_scope", "tester_selfie"]);
    if (classification.phenomenon && skipPhenomena.has(classification.phenomenon)) {
      setVerified({
        id: "local",
        verdict: "inconclusive",
        rationale: "This image is outside the severe-weather reporting scope, so the radar comparison does not apply.",
        confidence: "low",
        radar_frame_url: null,
        session_stats: null,
        created_at: new Date().toISOString(),
      } as unknown as VerifiedReport);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      // get-report returns the latest verified row alongside the report; if
      // we already received it via the initial load we'd have set state. This
      // recheck handles the case where classification arrives before verified.
      const { data } = await getReport(report?.id ?? cid, getReporterId());
      if (cancelled) return;
      if (data?.verified && data.verified.classification_id === cid) {
        setVerifiedStable(setVerified, data.verified);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classification, report?.id]);

  const [verifyAttempt, setVerifyAttempt] = useState(0);

  // Polling loop runs only after the visitor explicitly taps Verify. It
  // invokes the edge function and then polls verified_reports until the
  // server writes a row. verifyAttempt drives re-dispatch on Try again —
  // each retry clears the dispatch guard for this classification id so
  // the invoke actually fires again, not just the poller.
  useEffect(() => {
    if (!verifyRequested || !classification) return;
    let cancelled = false;
    const startedAt = Date.now();
    const cid = classification.id;

    if (verifyAttempt > 0) dispatchedReconcileFor.current.delete(cid);

    if (!dispatchedReconcileFor.current.has(cid)) {
      dispatchedReconcileFor.current.add(cid);
      supabase.functions
        .invoke("reconcile", {
          body: { classification_id: cid },
          headers: inviteHeaders(),
        })
        .then(async ({ data, error }) => {
          if (cancelled) return;
          if (error) {
            // Surface the server-side message verbatim when available — generic
            // "non-2xx status" is unactionable. error.context (FunctionsHttpError)
            // carries the original response we can re-read for the body.
            let serverMessage: string | null = null;
            const ctx = (error as { context?: Response }).context;
            if (ctx && typeof ctx.clone === "function") {
              try {
                const body = await ctx.clone().json();
                if (body && typeof body === "object" && "error" in body) {
                  serverMessage = String((body as { error: unknown }).error);
                }
              } catch {
                // ignore — fall through to error.message
              }
            }
            // FunctionsFetchError is the iOS PWA long-poll quirk; keep silent
            // and let the row poller recover.
            if (error.name === "FunctionsFetchError" && !serverMessage) return;
            setVerifyError(serverMessage ?? `Reconciliation could not start: ${error.message}`);
            return;
          }
          const payload = data as { verified_report?: VerifiedReport; timed_out?: boolean } | null;
          if (payload?.verified_report) setVerifiedStable(setVerified, payload.verified_report);
        })
        .catch((e) => {
          if (!cancelled) {
            console.warn("[reconcile] invoke fetch failed (polling continues)", e);
            setVerifyError(
              e instanceof Error
                ? `Network error reaching reconcile: ${e.message}`
                : "Network error reaching reconcile.",
            );
          }
        });
    }

    async function poll() {
      if (cancelled) return;
      const { data } = await getReport(report?.id ?? cid, getReporterId());
      if (cancelled) return;
      if (data?.verified && data.verified.classification_id === cid) {
        setVerifiedStable(setVerified, data.verified);
        return;
      }
      if (Date.now() - startedAt > RECONCILE_POLL_TIMEOUT_MS) {
        setVerifyError(
          "Reconciliation didn't respond within 3 minutes. The classifier session likely died upstream — try again.",
        );
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [verifyRequested, classification, verifyAttempt]);

  function startVerification() {
    setVerifyError(null);
    setVerifyRequested(true);
    setVerifyAttempt((n) => n + 1);
  }

  // ---------------- Earn-a-Question + Ask wiring ----------------
  const [profile, setProfile] = useState<EarnedQuestion | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastEarnedRef = useRef<number | null>(null);

  // Poll the local profile row to detect questions_earned increments. Cheap:
  // single-row select keyed on the local reporter_id, every few seconds while
  // the page is open. The trigger fires server-side on the verified_reports
  // insert; this is just the change-detector for the toast.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reporterId = getReporterId();
    if (DEV_DEBUG) console.info("[profile-poll] reporter_id", reporterId);

    async function tick() {
      if (cancelled) return;
      try {
        // get-report returns the profile keyed on reporter_id alongside the
        // report payload; one invoke replaces the direct profiles read.
        const { data, error } = await getReport(id!, reporterId);
        if (cancelled) return;
        if (error) {
          // Migration not applied or transient RLS/network hiccup. Mark as
          // missing so the UI falls through to the always-allow path; keep
          // polling so we recover when the underlying issue clears.
          setProfileMissing(true);
        } else {
          setProfileMissing(false);
          const profileRow = data?.profile ?? null;
          const next: EarnedQuestion = profileRow
            ? (profileRow as EarnedQuestion)
            : { reporter_id: reporterId, questions_earned: 0, questions_used: 0 };
          setProfile((prev) => {
            const prevEarned = lastEarnedRef.current ?? prev?.questions_earned ?? next.questions_earned;
            if (next.questions_earned > prevEarned) {
              setToast("1 question earned");
            }
            lastEarnedRef.current = next.questions_earned;
            return next;
          });
        }
      } catch (e) {
        // iOS PWA backgrounding can abort an in-flight fetch with a thrown
        // error rather than the supabase-js error envelope. Without this
        // catch the async function unwinds and the reschedule below would
        // never run — silently killing the polling loop until reload.
        console.warn("[profile-poll] tick threw", e);
      } finally {
        if (!cancelled) timer = setTimeout(tick, 4000);
      }
    }
    tick();

    function onVisible() {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      tick();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const [askText, setAskText] = useState("");
  const [askPending, setAskPending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);

  // The initial useEffect on `id` already seeds brief from getReport. No
  // separate read needed — research-poll below picks up new briefs.

  const submitQuestion = useCallback(async () => {
    if (!id) return;
    const q = askText.trim();
    if (!q) return;
    setAskError(null);
    setAskPending(true);
    const reporterId = getReporterId();
    let userLat: number | undefined;
    let userLon: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("no geolocation"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, maximumAge: 60_000 });
      });
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
    } catch {
      // Falls back to the report lat/lon server-side; expected on desktop.
    }

    let respondedSync = false;
    supabase.functions
      .invoke("research", {
        body: {
          report_id: id,
          question: q,
          reporter_id: reporterId,
          user_lat: userLat,
          user_lon: userLon,
        },
        headers: inviteHeaders(),
      })
      .then(async ({ data, error }) => {
        if (error && error.name !== "FunctionsFetchError") {
          // Unwrap the server-side error body — supabase-js's error.message
          // is the generic "Edge Function returned a non-2xx status code"
          // which hides the actual reason (invite exhausted, no questions
          // available, internal session failure, etc).
          let serverMessage: string | null = null;
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.clone === "function") {
            try {
              const body = await ctx.clone().json();
              if (body && typeof body === "object" && "error" in body) {
                serverMessage = String((body as { error: unknown }).error);
              }
            } catch {
              // fall through to error.message
            }
          }
          setAskError(`Could not start the answer: ${serverMessage ?? error.message}`);
          setAskPending(false);
          return;
        }
        const payload = data as { brief?: Brief } | null;
        if (payload?.brief) {
          respondedSync = true;
          setBriefStable(setBrief, payload.brief);
          setAskPending(false);
          setAskText("");
        }
      })
      .catch((e) => console.warn("[research] invoke fetch failed (polling continues)", e));

    const startedAt = Date.now();
    async function poll() {
      if (respondedSync) return;
      const { data } = await getReport(id!, reporterId);
      const fresh = data?.brief;
      if (fresh && (!brief || fresh.id !== brief.id)) {
        setBriefStable(setBrief, fresh);
        setAskPending(false);
        setAskText("");
        return;
      }
      if (Date.now() - startedAt > RESEARCH_POLL_TIMEOUT_MS) {
        setAskError("DR is taking a while — your question is saved and we'll show the answer when ready.");
        setAskPending(false);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
  }, [askText, id, brief]);

  const questionsAvailable = profile ? profile.questions_earned - profile.questions_used : 0;
  const ungated = profileMissing;

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-red-400">
        <p>Could not load report.</p>
        <p className="text-xs text-white/40">{error}</p>
        <Link to="/" className="rounded-full bg-white/10 px-4 py-2 text-sm">Back to map</Link>
      </div>
    );
  }

  if (!report) {
    return <div className="flex h-dvh items-center justify-center text-white/60">Loading report…</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 active:scale-95"
          aria-label="Home"
        >
          <span aria-hidden>🏠</span>
          <span>Home</span>
        </Link>
        <span className="text-xs uppercase tracking-wider text-white/40">Report</span>
      </header>
      <div className="aspect-[16/9] w-full sm:aspect-[2/1]">
        <MapView center={[report.lon, report.lat]} zoom={12} />
      </div>
      <main className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
        {report.photo_url && (
          <section>
            <button
              type="button"
              onClick={() => setEnlarged(true)}
              className="relative block w-full overflow-hidden rounded-lg border border-white/10 bg-black active:scale-[0.99]"
              aria-label="Enlarge photo"
            >
              <img
                src={report.photo_url}
                alt="Submitted sky photo"
                className="w-full"
                loading="lazy"
              />
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70 backdrop-blur">
                Tap to enlarge
              </span>
            </button>
          </section>
        )}
        <ClassificationCard classification={classification} error={classifyError} onRetry={retryClassify} />
        <QuestionCard
          questionsAvailable={questionsAvailable}
          ungated={ungated}
          brief={brief}
          askText={askText}
          onAskTextChange={setAskText}
          onSubmit={submitQuestion}
          pending={askPending}
          error={askError}
          hasClassification={!!classification}
          verifyRequested={verifyRequested}
          verified={verified}
          verifyError={verifyError}
          onVerify={startVerification}
        />
        {SHOW_DEBUG && (
          <details className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm" open>
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-white/50">
              Debug · Reconciliation
            </summary>
            <div className="mt-3 space-y-3">
              <p className="break-all font-mono text-[10px] text-white/40">
                reporter_id: {getReporterId()}
                {profile && (
                  <> · earned {profile.questions_earned} · used {profile.questions_used}</>
                )}
                {profileMissing && <> · profileMissing=true</>}
              </p>
              <VerifiedCard
                verified={verified}
                error={verifyError}
                hasClassification={!!classification}
                requested={verifyRequested}
                onVerify={startVerification}
              />
            </div>
          </details>
        )}
        <section>
          <p className="text-white/50">Heading</p>
          <p className="text-xl font-semibold tabular-nums">{Math.round(report.heading_degrees)}°</p>
        </section>
        <section>
          <p className="text-white/50">Location</p>
          <p className="tabular-nums">{report.lat.toFixed(5)}, {report.lon.toFixed(5)}</p>
        </section>
        <section>
          <p className="text-white/50">Captured</p>
          <p>{new Date(report.captured_at).toLocaleString()}</p>
        </section>
        {report.caption && (
          <section>
            <p className="text-white/50">Caption</p>
            <p>{report.caption}</p>
          </section>
        )}
      </main>
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-medium text-emerald-950 shadow-lg">
            {toast}
          </div>
        </div>
      )}
      {enlarged && report.photo_url && (
        <button
          type="button"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          aria-label="Close enlarged photo"
        >
          <img
            src={report.photo_url}
            alt="Submitted sky photo (enlarged)"
            className="max-h-full max-w-full object-contain"
          />
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

function ClassificationCard({
  classification,
  error,
  onRetry,
}: {
  classification: Classification | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-medium text-red-100 active:scale-95"
        >
          Retry
        </button>
      </section>
    );
  }
  if (!classification) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/50">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Classifying with Opus 4.7…
        </span>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-[10px] uppercase tracking-wider">
          <span className="text-white/60">Evidence · </span>Photo classifier
        </p>
        <ConfidencePill value={classification.confidence} />
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {prettyPhenomenon(classification.phenomenon)}
      </p>
      <p className="mt-1 text-[11px] text-white/40">
        One of three agents grounding this report. Verify against radar to add Reconciliation + Open-Meteo evidence and earn a Deep Researcher question.
      </p>
      {classification.hail_size_cm !== null && (
        <p className="mt-1 text-xs text-white/50">Estimated hail size: {classification.hail_size_cm} cm</p>
      )}
      {classification.features && classification.features.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-white/70">
          {classification.features.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-white/30">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
      <CostFooter stats={classification.session_stats} label="Classifier" />
    </section>
  );
}

function VerifiedCard({
  verified,
  error,
  hasClassification,
  requested,
  onVerify,
}: {
  verified: VerifiedReport | null;
  error: string | null;
  hasClassification: boolean;
  requested: boolean;
  onVerify: () => void;
}) {
  if (!hasClassification) return null;
  if (error) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
        <span>{error}</span>
        <button
          type="button"
          onClick={onVerify}
          className="rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-medium text-red-100 active:scale-95"
        >
          Retry
        </button>
      </section>
    );
  }
  if (!verified && !requested) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <div>
          <p className="text-white/50 text-xs uppercase tracking-wider">Reconciliation</p>
          <p className="mt-1 text-white/70">
            Compare this photo against DWD radar to verify the classification. Opens a paid Opus 4.7 session.
          </p>
        </div>
        <button
          type="button"
          onClick={onVerify}
          className="self-start rounded-full bg-sky-500/20 px-4 py-2 text-xs font-medium text-sky-100 ring-1 ring-sky-500/30 active:scale-95"
        >
          Verify against radar
        </button>
      </section>
    );
  }
  if (!verified) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/50">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Reconciling against DWD RADOLAN…
        </span>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs uppercase tracking-wider">Reconciliation</p>
        <VerdictPill verdict={verified.verdict} />
      </div>
      {verified.rationale && (
        <p className="mt-2 text-sm leading-relaxed text-white/80">{verified.rationale}</p>
      )}
      {verified.radar_frame_url && (
        <figure className="mt-3 overflow-hidden rounded-md border border-white/10 bg-black/40">
          <img
            src={verified.radar_frame_url}
            alt="DWD RADOLAN radar frame compared against the report"
            className="block w-full"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <figcaption className="flex items-center justify-between px-2 py-1 text-[10px] text-white/40">
            <span>DWD RADOLAN frame</span>
            <a
              href={verified.radar_frame_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Open in new tab
            </a>
          </figcaption>
        </figure>
      )}
      <CostFooter stats={verified.session_stats} label="Reconciliation" />
    </section>
  );
}

function ConfidencePill({ value }: { value: Confidence | null }) {
  const tone: Record<Confidence | "unknown", string> = {
    high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-red-500/15 text-red-300 border-red-500/30",
    unknown: "bg-white/5 text-white/40 border-white/10",
  };
  const v = value ?? "unknown";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${tone[v]}`}>
      {v} confidence
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: VerifiedReport["verdict"] }) {
  const tone: Record<VerifiedReport["verdict"], string> = {
    match: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    mismatch: "bg-red-500/15 text-red-300 border-red-500/30",
    inconclusive: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${tone[verdict]}`}>
      {verdict}
    </span>
  );
}

function QuestionCard({
  questionsAvailable,
  ungated,
  brief,
  askText,
  onAskTextChange,
  onSubmit,
  pending,
  error,
  hasClassification,
  verifyRequested,
  verified,
  verifyError,
  onVerify,
}: {
  questionsAvailable: number;
  ungated: boolean;
  brief: Brief | null;
  askText: string;
  onAskTextChange: (s: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  hasClassification: boolean;
  verifyRequested: boolean;
  verified: VerifiedReport | null;
  verifyError: string | null;
  onVerify: () => void;
}) {
  const canAsk = ungated || questionsAvailable >= 1;

  if (brief) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-white/50 text-xs uppercase tracking-wider">Answer</p>
          {!ungated && (
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              {questionsAvailable} {questionsAvailable === 1 ? "question" : "questions"} left
            </span>
          )}
        </div>
        {brief.question && (
          <p className="mt-2 text-xs italic text-white/50">"{brief.question}"</p>
        )}
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/90">{brief.content}</p>
        <SourcesRow sources={brief.sources} />
      </section>
    );
  }

  if (pending) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Composing your answer…
        </span>
        {error && <p className="mt-2 text-amber-300">{error}</p>}
      </section>
    );
  }

  if (!canAsk) {
    const verifying = verifyRequested && !verified;
    const verdictMatched = verified?.verdict === "match";
    const verdictNotMatched = verified && verified.verdict !== "match";
    const earningLedger = verdictMatched && questionsAvailable < 1;

    return (
      <section className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-emerald-200/70 text-xs uppercase tracking-wider">Earn a question</p>
          {verified && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
              {verified.verdict}
            </span>
          )}
        </div>

        {!verifyRequested && !verified && hasClassification && (
          <>
            <p className="text-white/80 leading-relaxed">
              Verify this sky photo against DWD radar + Open-Meteo + MTG satellite to earn one Deep Researcher question. Ask anything weather-grounded — best park for lunch, whether to head up the mountain, will the sunset hold.
            </p>
            <button
              type="button"
              onClick={onVerify}
              className="self-start rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black shadow-lg active:scale-95"
            >
              Verify against radar
            </button>
            <p className="text-[10px] text-white/30">~10–60s · uses Reconciliation CMA</p>
          </>
        )}

        {!hasClassification && !verifyRequested && (
          <p className="text-white/60 text-xs">Waiting for the photo classifier to land before you can verify.</p>
        )}

        {verifying && (
          <div className="flex items-center gap-3 text-white/70">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Reconciling photo against radar + Open-Meteo + MTG…</span>
          </div>
        )}

        {earningLedger && (
          <div className="flex flex-col gap-2 text-white/70">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>Match verified — earning your question.</span>
            </div>
            <button
              type="button"
              onClick={() => location.reload()}
              className="self-start rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 active:scale-95"
            >
              Stuck? Refresh
            </button>
          </div>
        )}

        {verdictNotMatched && (
          <>
            <p className="text-white/80">
              Reconciliation came back <strong>{verified.verdict}</strong>. The photo and the weather signal didn't line up clearly enough to grant a question. A clearer sky shot from outdoors usually does it.
            </p>
            <Link
              to="/capture"
              className="self-start rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black active:scale-95"
            >
              Take another sky photo
            </Link>
          </>
        )}

        {verifyError && (
          <>
            <p className="text-amber-200 text-xs">{verifyError}</p>
            <button
              type="button"
              onClick={onVerify}
              className="self-start rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/90 active:scale-95"
            >
              Try again
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs uppercase tracking-wider">Ask a question</p>
        {!ungated && (
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            {questionsAvailable} {questionsAvailable === 1 ? "question" : "questions"} left
          </span>
        )}
      </div>
      <textarea
        value={askText}
        onChange={(e) => onAskTextChange(e.target.value)}
        placeholder="e.g. Where in Munich is best for an outdoor lunch in the next 2 hours?"
        rows={3}
        maxLength={500}
        className="w-full resize-none rounded-md border border-white/10 bg-black/40 p-3 text-sm text-white/90 placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30">{askText.length}/500</span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!askText.trim()}
          className="rounded-full bg-sky-500/20 px-4 py-2 text-xs font-medium text-sky-100 ring-1 ring-sky-500/30 active:scale-95 disabled:opacity-40"
        >
          Ask
        </button>
      </div>
      {error && <p className="text-xs text-amber-300">{error}</p>}
    </section>
  );
}

function SourcesRow({ sources }: { sources: BriefSource[] | null }) {
  if (!sources || sources.length === 0) return null;
  const tone: Record<BriefSource["kind"], string> = {
    weather: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    community: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    satellite: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    radar: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  };
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
      {sources.map((s, i) => (
        <span
          key={`${s.label}-${i}`}
          className={`rounded-full border px-2 py-0.5 text-[10px] ${tone[s.kind] ?? "bg-white/5 text-white/60 border-white/10"}`}
          title={s.ref}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function CostFooter({ stats, label }: { stats: SessionStats | null; label: string }) {
  if (!DEV_DEBUG || !stats) return null;
  const cost = stats.cost_usd != null ? `$${stats.cost_usd.toFixed(4)}` : "—";
  const duration = stats.duration_ms != null ? `${(stats.duration_ms / 1000).toFixed(1)}s` : "—";
  return (
    <p className="mt-3 border-t border-white/5 pt-2 font-mono text-[10px] text-white/30">
      {label} · {stats.model} · {cost} · {duration} · {stats.session_id.slice(0, 12)}…
    </p>
  );
}

