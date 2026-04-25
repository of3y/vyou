import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { inviteHeaders } from "../lib/invite";
import { getReporterId } from "../lib/reporter";
import { getReport } from "../lib/api";
import type { Brief } from "../lib/types";

const POLL_INTERVAL_MS = 2500;
const RESEARCH_POLL_TIMEOUT_MS = 90_000;

type Props = {
  reportId: string | null;
  questionsAvailable: number;
  onAnswered?: () => void;
};

export default function AskQuestionFab({ reportId, questionsAvailable, onAnswered }: Props) {
  const canAsk = Boolean(reportId) && questionsAvailable >= 1;
  const [open, setOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const reset = useCallback(() => {
    setAskText("");
    setBrief(null);
    setError(null);
    setPending(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Defer reset so the close animation doesn't flash empty content.
    setTimeout(reset, 200);
  }, [reset]);

  const submit = useCallback(async () => {
    const q = askText.trim();
    if (!q || !reportId) return;
    // Capture into a local const so the narrowing survives the nested poll()
    // declaration — TS widens prop captures back to (string | null) inside
    // function declarations across an await boundary.
    const rid: string = reportId;
    setError(null);
    setPending(true);
    setBrief(null);

    const reporterId = getReporterId();
    let userLat: number | undefined;
    let userLon: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          return reject(new Error("no geolocation"));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 4000,
          maximumAge: 60_000,
        });
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
          report_id: reportId,
          question: q,
          reporter_id: reporterId,
          user_lat: userLat,
          user_lon: userLon,
        },
        headers: inviteHeaders(),
      })
      .then(async ({ data, error: invokeError }) => {
        if (invokeError && invokeError.name !== "FunctionsFetchError") {
          let serverMessage: string | null = null;
          const ctx = (invokeError as { context?: Response }).context;
          if (ctx && typeof ctx.clone === "function") {
            try {
              const body = await ctx.clone().json();
              if (body && typeof body === "object" && "error" in body) {
                serverMessage = String((body as { error: unknown }).error);
              }
            } catch {
              // fall through
            }
          }
          if (cancelRef.current) return;
          setError(`Could not start the answer: ${serverMessage ?? invokeError.message}`);
          setPending(false);
          return;
        }
        const payload = data as { brief?: Brief } | null;
        if (payload?.brief) {
          respondedSync = true;
          if (cancelRef.current) return;
          setBrief(payload.brief);
          setPending(false);
          onAnswered?.();
        }
      })
      .catch((e) => console.warn("[ask-fab] research invoke failed (polling continues)", e));

    const startedAt = Date.now();
    async function poll() {
      if (respondedSync || cancelRef.current) return;
      const { data } = await getReport(rid, reporterId);
      const fresh = data?.brief;
      if (fresh) {
        if (cancelRef.current) return;
        setBrief(fresh);
        setPending(false);
        onAnswered?.();
        return;
      }
      if (Date.now() - startedAt > RESEARCH_POLL_TIMEOUT_MS) {
        if (cancelRef.current) return;
        setError("DR is taking a while — your question is saved and we'll show the answer when ready.");
        setPending(false);
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
  }, [askText, reportId, onAnswered]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask a question"
        className={`relative inline-flex items-center gap-2 rounded-full border px-5 text-[14px] font-semibold tracking-tight shadow-[0_4px_16px_-4px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-colors active:scale-[0.96] ${
          canAsk
            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
            : "border-white/10 bg-black/55 text-white/70 hover:bg-black/70"
        }`}
        style={{ height: 52 }}
      >
        <AskIcon />
        <span>Ask</span>
        {questionsAvailable > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-400 px-[5px] text-[10px] font-bold text-black ring-2 ring-[#0f1115]">
            {questionsAvailable}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="m-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#13161c] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            style={{ marginBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {brief ? (
              <AnswerView brief={brief} onClose={close} />
            ) : pending ? (
              <ThinkingView onClose={close} error={error} />
            ) : !canAsk ? (
              <LockedView
                onClose={close}
                hasReport={Boolean(reportId)}
                questionsAvailable={questionsAvailable}
              />
            ) : (
              <ComposeView
                askText={askText}
                onAskTextChange={setAskText}
                onCancel={close}
                onSubmit={submit}
                questionsAvailable={questionsAvailable}
                error={error}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ComposeView({
  askText,
  onAskTextChange,
  onCancel,
  onSubmit,
  questionsAvailable,
  error,
}: {
  askText: string;
  onAskTextChange: (s: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  questionsAvailable: number;
  error: string | null;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/50">Ask a question</p>
        <span className="text-[10px] uppercase tracking-wider text-white/40">
          {questionsAvailable} {questionsAvailable === 1 ? "question" : "questions"} left
        </span>
      </div>
      <textarea
        value={askText}
        onChange={(e) => onAskTextChange(e.target.value)}
        placeholder="e.g. Where in Munich is best for an outdoor lunch in the next 2 hours?"
        rows={3}
        maxLength={500}
        autoFocus
        className="mt-3 w-full resize-none rounded-md border border-white/10 bg-black/40 p-3 text-sm text-white/90 placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-white/40 transition-colors hover:text-white/70"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30">{askText.length}/500</span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!askText.trim()}
            className="rounded-full bg-sky-500/20 px-4 py-2 text-xs font-medium text-sky-100 ring-1 ring-sky-500/30 transition-opacity active:scale-95 disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </section>
  );
}

function LockedView({
  onClose,
  hasReport,
  questionsAvailable,
}: {
  onClose: () => void;
  hasReport: boolean;
  questionsAvailable: number;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-emerald-200/70">Earn a question</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 active:scale-95"
        >
          Close
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        {hasReport && questionsAvailable < 1
          ? "Out of questions. Add another cone to earn one."
          : "Add a cone to earn a question."}
      </p>
      <a
        href="/capture"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-lg active:scale-95"
      >
        Add Cone
      </a>
    </section>
  );
}

function ThinkingView({ onClose, error }: { onClose: () => void; error: string | null }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/50">Composing your answer</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 active:scale-95"
        >
          Hide
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
        <span>Deep Researcher is thinking…</span>
      </div>
      <p className="mt-1 text-[10px] text-white/30">Usually 10–60s. You can close this — we'll keep working.</p>
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </section>
  );
}

function AnswerView({ brief, onClose }: { brief: Brief; onClose: () => void }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/50">Answer</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 active:scale-95"
        >
          Close
        </button>
      </div>
      {brief.question && (
        <p className="mt-3 text-xs italic text-white/50">"{brief.question}"</p>
      )}
      <p className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-white/90">
        {brief.content}
      </p>
    </section>
  );
}

function AskIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.24c-.74.36-1.6.96-1.6 1.76V14" />
      <path d="M12 17.25v.01" />
    </svg>
  );
}
