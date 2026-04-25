import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MapView from "../components/MapView";
import WeatherChip from "../components/WeatherChip";
import type { Brief, BriefSource, Classification, Confidence, EarnedQuestion, Report, SessionStats, VerifiedReport } from "../lib/types";
import { inviteHeaders } from "../lib/invite";
import { getReport } from "../lib/api";
import { cardinalFromDegrees, prettyPhenomenon } from "../lib/format";
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
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#0f1115] p-6 text-center text-rose-300">
        <p className="text-[15px]">Could not load report.</p>
        <p className="text-[12px] text-white/40">{error}</p>
        <Link
          to="/"
          className="rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white/90 backdrop-blur-xl transition-colors hover:bg-white/[0.14]"
        >
          Back to map
        </Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0f1115] text-white/60">
        <span className="inline-flex items-center gap-2.5 text-[14px]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Loading report…
        </span>
      </div>
    );
  }

  const captured = new Date(report.captured_at);
  const ageMin = Math.max(0, Math.round((Date.now() - captured.getTime()) / 60000));
  const ageLabel = ageMin === 0 ? "Just now" : ageMin === 1 ? "1 min ago" : `${ageMin} min ago`;
  const cardinal = cardinalFromDegrees(report.heading_degrees);
  const headingDeg = Math.round(report.heading_degrees);

  return (
    <div className="flex h-dvh flex-col bg-[#0f1115] text-white">
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0f1115]/85 px-4 py-3 backdrop-blur-xl"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          to="/"
          aria-label="Back to map"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[13px] font-medium text-white/85 backdrop-blur-xl transition-colors hover:bg-white/[0.14] hover:text-white active:scale-[0.95]"
        >
          <BackIcon />
          <span>Map</span>
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Report
        </span>
        <span className="w-[68px]" aria-hidden />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="aspect-[16/9] w-full overflow-hidden sm:aspect-[2/1]">
            <MapView center={[report.lon, report.lat]} zoom={12} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[#0f1115]" />
        </div>

        <div
          className="space-y-5 px-5 pt-5"
          style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        >
          <header className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-white">
              {classification ? prettyPhenomenon(classification.phenomenon) : "Classifying…"}
            </h1>
            <p className="mt-1 text-[13px] text-white/50">
              {ageLabel} · facing {cardinal} · {headingDeg}°
            </p>
            <WeatherChip lat={report.lat} lon={report.lon} capturedAt={report.captured_at} />
          </header>

          {report.photo_url && (
            <button
              type="button"
              onClick={() => setEnlarged(true)}
              className="relative block w-full overflow-hidden rounded-3xl bg-black shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.06] transition-transform active:scale-[0.99]"
              aria-label="Enlarge photo"
            >
              <img
                src={report.photo_url}
                alt="Submitted sky photo"
                className="block w-full"
                loading="lazy"
              />
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/80 backdrop-blur-xl">
                Tap to enlarge
              </span>
            </button>
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
            <details className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/[0.06]" open>
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Debug · Reconciliation
              </summary>
              <div className="mt-4 space-y-3">
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

          <MetaCard
            heading={headingDeg}
            cardinal={cardinal}
            lat={report.lat}
            lon={report.lon}
            capturedAt={report.captured_at}
            caption={report.caption}
          />
        </div>
      </main>

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="rounded-full bg-emerald-500/95 px-4 py-2 text-xs font-medium text-emerald-950 shadow-[0_8px_32px_-8px_rgba(16,185,129,0.5)]">
            {toast}
          </div>
        </div>
      )}

      {enlarged && report.photo_url && (
        <button
          type="button"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
          aria-label="Close enlarged photo"
        >
          <img
            src={report.photo_url}
            alt="Submitted sky photo (enlarged)"
            className="max-h-full max-w-full object-contain"
          />
          <span
            className="absolute right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white/80 backdrop-blur-xl"
            style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
            aria-hidden
          >
            <CloseIcon />
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
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-rose-500/10 p-4 text-[13px] text-rose-200 ring-1 ring-rose-500/25">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-rose-500/20 px-3 py-1 text-[11px] font-medium text-rose-100 ring-1 ring-rose-500/30 transition-colors hover:bg-rose-500/30 active:scale-95"
        >
          Retry
        </button>
      </section>
    );
  }
  if (!classification) {
    return (
      <section className="flex items-center gap-2.5 rounded-3xl bg-white/[0.04] px-4 py-3.5 text-[14px] text-white/65 ring-1 ring-white/[0.06]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Reading the sky with Opus 4.7…
      </section>
    );
  }
  const confidenceCopy: Record<Confidence, string> = {
    high: "Highly confident read",
    medium: "Reasonably confident read",
    low: "Tentative read",
  };
  const confidenceTone: Record<Confidence, string> = {
    high: "text-emerald-300/90",
    medium: "text-amber-300/90",
    low: "text-rose-300/90",
  };
  const confidence = classification.confidence;
  const features = classification.features ?? [];
  const hail = classification.hail_size_cm;

  return (
    <section className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-white/65">In this sky</p>
        {confidence && (
          <span className={`text-[11px] font-medium ${confidenceTone[confidence]}`}>
            {confidenceCopy[confidence]}
          </span>
        )}
      </div>

      {features.length > 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-white/85">
          {joinFeatures(features)}
        </p>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          The classifier didn't surface specific cloud features for this view.
        </p>
      )}

      {hail !== null && hail !== undefined && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-[15px]">
            🧊
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">Hail</p>
            <p className="text-[15px] font-medium text-white/90">~{hail} cm across</p>
          </div>
        </div>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-white/40">
        One of three agents grounding this report. Verify against radar to add Reconciliation + Open-Meteo evidence and earn a Deep Researcher question.
      </p>
      <CostFooter stats={classification.session_stats} label="Classifier" />
    </section>
  );
}

function joinFeatures(features: string[]): string {
  const cleaned = features.map((f) => f.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  return cleaned.map(ensureSentence).join(" ");
}

function ensureSentence(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
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
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-rose-500/10 p-4 text-[13px] text-rose-200 ring-1 ring-rose-500/25">
        <span>{error}</span>
        <button
          type="button"
          onClick={onVerify}
          className="rounded-full bg-rose-500/20 px-3 py-1 text-[11px] font-medium text-rose-100 ring-1 ring-rose-500/30 transition-colors hover:bg-rose-500/30 active:scale-95"
        >
          Retry
        </button>
      </section>
    );
  }
  if (!verified && !requested) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/[0.06]">
        <div>
          <p className="text-[13px] font-medium text-white/65">Reconciliation</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">
            Compare this photo against DWD radar to verify the classification. Opens a paid Opus 4.7 session.
          </p>
        </div>
        <button
          type="button"
          onClick={onVerify}
          className="self-start rounded-full bg-white px-5 text-[13px] font-semibold text-black shadow-lg transition-colors hover:bg-white/90 active:scale-[0.98]"
          style={{ height: 40 }}
        >
          Verify against radar
        </button>
      </section>
    );
  }
  if (!verified) {
    return (
      <section className="flex items-center gap-2.5 rounded-3xl bg-white/[0.04] px-4 py-3.5 text-[14px] text-white/65 ring-1 ring-white/[0.06]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
        Reconciling against DWD RADOLAN…
      </section>
    );
  }
  const verdictMeta: Record<VerifiedReport["verdict"], { icon: string; tone: string; label: string }> = {
    match: {
      icon: "✓",
      tone: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
      label: "Confirmed against radar",
    },
    mismatch: {
      icon: "!",
      tone: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
      label: "Radar disagrees",
    },
    inconclusive: {
      icon: "·",
      tone: "bg-white/[0.06] text-white/60 ring-white/10",
      label: "Radar inconclusive",
    },
  };
  const m = verdictMeta[verified.verdict];
  return (
    <section className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ring-1 ${m.tone}`}
        >
          {m.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-white/90">{m.label}</p>
          {verified.rationale && (
            <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">{verified.rationale}</p>
          )}
        </div>
      </div>
      {verified.radar_frame_url && (
        <figure className="mt-4 overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/[0.06]">
          <img
            src={verified.radar_frame_url}
            alt="DWD RADOLAN radar frame compared against the report"
            className="block w-full"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <figcaption className="flex items-center justify-between px-3 py-1.5 text-[10px] text-white/40">
            <span>DWD RADOLAN frame</span>
            <a
              href={verified.radar_frame_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/55 underline underline-offset-2 transition-colors hover:text-white/80"
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
      <section className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-white/65">Answer</p>
          {!ungated && (
            <span className="text-[11px] font-medium text-white/45">
              {questionsAvailable} {questionsAvailable === 1 ? "question" : "questions"} left
            </span>
          )}
        </div>
        {brief.question && (
          <p className="mt-3 text-[12.5px] italic text-white/50">"{brief.question}"</p>
        )}
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-white/90">{brief.content}</p>
        <SourcesRow sources={brief.sources} />
      </section>
    );
  }

  if (pending) {
    return (
      <section className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-2.5 text-[14px] text-white/65">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
          Composing your answer…
        </div>
        {error && <p className="mt-2 text-[12px] text-amber-300">{error}</p>}
      </section>
    );
  }

  if (!canAsk) {
    const verifying = verifyRequested && !verified;
    const verdictMatched = verified?.verdict === "match";
    const verdictNotMatched = verified && verified.verdict !== "match";
    const earningLedger = verdictMatched && questionsAvailable < 1;
    const verdictTone: Record<VerifiedReport["verdict"], string> = {
      match: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
      mismatch: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
      inconclusive: "bg-white/[0.06] text-white/60 ring-white/10",
    };

    return (
      <section className="flex flex-col gap-4 rounded-3xl bg-gradient-to-b from-emerald-500/[0.08] to-emerald-500/[0.02] p-5 ring-1 ring-emerald-500/15">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-emerald-200/80">Earn a question</p>
          {verified && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ${verdictTone[verified.verdict]}`}
            >
              {verified.verdict}
            </span>
          )}
        </div>

        {!verifyRequested && !verified && hasClassification && (
          <>
            <p className="text-[14px] leading-relaxed text-white/80">
              Verify this sky photo against DWD radar + Open-Meteo + MTG satellite to earn one Deep Researcher question. Ask anything weather-grounded — best park for lunch, whether to head up the mountain, will the sunset hold.
            </p>
            <button
              type="button"
              onClick={onVerify}
              className="flex items-center justify-center rounded-full bg-white text-[14px] font-semibold text-black shadow-lg transition-colors hover:bg-white/90 active:scale-[0.98]"
              style={{ height: 48 }}
            >
              Verify against radar
            </button>
            <p className="text-center text-[11px] text-white/35">~10–60s · uses Reconciliation CMA</p>
          </>
        )}

        {!hasClassification && !verifyRequested && (
          <p className="text-[13px] text-white/60">Waiting for the photo classifier to land before you can verify.</p>
        )}

        {verifying && (
          <div className="flex items-center gap-2.5 text-[14px] text-white/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span>Reconciling photo against radar + Open-Meteo + MTG…</span>
          </div>
        )}

        {earningLedger && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-[14px] text-white/70">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span>Match verified — earning your question.</span>
            </div>
            <button
              type="button"
              onClick={() => location.reload()}
              className="self-start rounded-full border border-white/10 bg-white/[0.08] px-3.5 py-1.5 text-[11px] font-medium text-white/75 backdrop-blur-xl transition-colors hover:bg-white/[0.14] active:scale-95"
            >
              Stuck? Refresh
            </button>
          </div>
        )}

        {verdictNotMatched && (
          <>
            <p className="text-[14px] leading-relaxed text-white/80">
              Reconciliation came back <strong className="font-semibold text-white">{verified.verdict}</strong>. The photo and the weather signal didn't line up clearly enough to grant a question. A clearer sky shot from outdoors usually does it.
            </p>
            <Link
              to="/capture"
              className="flex items-center justify-center rounded-full bg-white text-[14px] font-semibold text-black shadow-lg transition-colors hover:bg-white/90 active:scale-[0.98]"
              style={{ height: 48 }}
            >
              Take another sky photo
            </Link>
          </>
        )}

        {verifyError && (
          <>
            <p className="text-[12.5px] leading-relaxed text-amber-200">{verifyError}</p>
            <button
              type="button"
              onClick={onVerify}
              className="self-start rounded-full border border-white/10 bg-white/[0.08] px-4 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-xl transition-colors hover:bg-white/[0.14] active:scale-95"
            >
              Try again
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-white/65">Ask a question</p>
        {!ungated && (
          <span className="text-[11px] font-medium text-white/45">
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
        className="w-full resize-none rounded-2xl bg-black/30 p-3.5 text-[14px] text-white/90 ring-1 ring-white/[0.06] placeholder:text-white/30 focus:outline-none focus:ring-white/20"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30">{askText.length}/500</span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!askText.trim()}
          className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black shadow-lg transition-opacity hover:bg-white/90 active:scale-[0.98] disabled:bg-white/15 disabled:text-white/40 disabled:shadow-none"
        >
          Ask
        </button>
      </div>
      {error && <p className="text-[12px] text-amber-300">{error}</p>}
    </section>
  );
}

function SourcesRow({ sources }: { sources: BriefSource[] | null }) {
  if (!sources || sources.length === 0) return null;
  const tone: Record<BriefSource["kind"], string> = {
    weather: "bg-sky-500/15 text-sky-200 ring-sky-500/25",
    community: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25",
    satellite: "bg-violet-500/15 text-violet-200 ring-violet-500/25",
    radar: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
  };
  return (
    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
      {sources.map((s, i) => (
        <span
          key={`${s.label}-${i}`}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ${tone[s.kind] ?? "bg-white/[0.06] text-white/60 ring-white/10"}`}
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
    <p className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[10px] text-white/30">
      {label} · {stats.model} · {cost} · {duration} · {stats.session_id.slice(0, 12)}…
    </p>
  );
}

function MetaCard({
  heading,
  cardinal,
  lat,
  lon,
  capturedAt,
  caption,
}: {
  heading: number;
  cardinal: string;
  lat: number;
  lon: number;
  capturedAt: string;
  caption: string | null;
}) {
  return (
    <section className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/[0.06]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        Capture details
      </p>
      <dl className="mt-4 space-y-3.5 text-[14px]">
        <MetaRow label="Heading">
          <span className="tabular-nums text-white/90">{heading}°</span>
          <span className="text-white/45"> · facing {cardinal}</span>
        </MetaRow>
        <MetaRow label="Location">
          <span className="tabular-nums text-white/90">
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </span>
        </MetaRow>
        <MetaRow label="Captured">
          <span className="text-white/90">{new Date(capturedAt).toLocaleString()}</span>
        </MetaRow>
        {caption && (
          <MetaRow label="Caption">
            <span className="text-white/90">{caption}</span>
          </MetaRow>
        )}
      </dl>
    </section>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</dt>
      <dd className="mt-0.5 text-[14px] leading-snug">{children}</dd>
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

