import { Link } from "react-router-dom";
import { getReport } from "./api";
import { getReporterId } from "./reporter";
import { notify } from "./notify";
import { prettyPhenomenon } from "./format";
import { supabase } from "./supabase";
import { inviteHeaders } from "./invite";

// Background poll that survives route changes — kicked off on submit so the
// "Classified" toast still fires even if the user has navigated away from the
// thanks page. Toast renders globally because <Toaster> lives at app root.
const TIMEOUT_MS = 90_000;
const INTERVAL_MS = 3_000;

// Phenomena that bypass radar reconciliation, mirrors the server-side gate
// in supabase/functions/classify/index.ts.
const SKIP_RECONCILE_PHENOMENA = new Set(["out_of_scope", "tester_selfie"]);

const inFlight = new Set<string>();
const reconcileFired = new Set<string>();

export function trackClassification(reportId: string): void {
  if (inFlight.has(reportId)) return;
  inFlight.add(reportId);
  const startedAt = Date.now();

  const poll = async () => {
    if (!inFlight.has(reportId)) return;
    if (Date.now() - startedAt > TIMEOUT_MS) {
      inFlight.delete(reportId);
      return;
    }
    try {
      const { data } = await getReport(reportId, getReporterId());
      if (data?.classification) {
        inFlight.delete(reportId);
        // Client-side reconcile fire. The server-side classify→reconcile
        // auto-fire was unreliable on Supabase Edge Functions (waitUntil
        // cut short, synchronous await hit per-call fetch timeout). The
        // client is online and authenticated, so firing reconcile here is
        // strictly more reliable. Reconcile is idempotent on
        // (classification_id) so a redundant server-side success does not
        // double-charge or double-write.
        const cls = data.classification;
        if (
          cls.safe !== false &&
          cls.id &&
          cls.phenomenon &&
          !SKIP_RECONCILE_PHENOMENA.has(cls.phenomenon) &&
          !reconcileFired.has(cls.id) &&
          !data.verified
        ) {
          reconcileFired.add(cls.id);
          supabase.functions
            .invoke("reconcile", {
              body: { classification_id: cls.id },
              headers: inviteHeaders(),
            })
            .catch((e) => console.warn("[VYou] reconcile invoke failed", e));
        }
        if (data.classification.safe === false) {
          notify.warning(
            "Couldn't add this photo — try a clearer view of the sky.",
            {
              duration: 10_000,
              action: (
                <Link
                  to="/capture"
                  className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-black active:scale-95"
                >
                  Retake
                </Link>
              ),
            },
          );
          return;
        }
        notify.success(
          `Classified: ${prettyPhenomenon(data.classification.phenomenon)}`,
          {
            duration: 10_000,
            action: (
              <Link
                to={`/report/${reportId}`}
                className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-black active:scale-95"
              >
                View cone
              </Link>
            ),
          },
        );
        return;
      }
    } catch {
      // Swallow — keep polling until timeout.
    }
    setTimeout(poll, INTERVAL_MS);
  };
  setTimeout(poll, INTERVAL_MS);
}
