import { Link } from "react-router-dom";
import { getReport } from "./api";
import { getReporterId } from "./reporter";
import { notify } from "./notify";
import { prettyPhenomenon } from "./format";

// Background poll that survives route changes — kicked off on submit so the
// "Classified" toast still fires even if the user has navigated away from the
// thanks page. Toast renders globally because <Toaster> lives at app root.
const TIMEOUT_MS = 90_000;
const INTERVAL_MS = 3_000;

const inFlight = new Set<string>();

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
        // Hardened-plan v2 §2 Fix C — distinct rejection toast when the
        // classifier flips `safe: false`. The submission is dropped from the
        // shared map server-side; the toast tells the reporter why and offers
        // a Retake CTA so the loop closes cleanly. Out-of-scope and
        // tester-selfie reads are still safe=true and surface as a normal
        // "Classified" toast.
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
