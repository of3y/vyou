import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";
import { buildSessionStats, RECONCILIATION_MODEL } from "../_shared/cost.ts";
import { radolanFrameForReport } from "../_shared/radolan.ts";
import { requireInvite } from "../_shared/invite.ts";
import { extractJson } from "../_shared/extractJson.ts";
import { fetchMtgFrame, fetchOpenMeteo, openMeteoSummary } from "../_shared/feeds.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RECONCILIATION_AGENT_ID = Deno.env.get("RECONCILIATION_AGENT_ID");
const RECONCILIATION_ENVIRONMENT_ID = Deno.env.get("RECONCILIATION_ENVIRONMENT_ID");
const SEVERE_WEATHER_REPORTING_SKILL_ID = Deno.env.get("SEVERE_WEATHER_REPORTING_SKILL_ID");
const SEVERE_WEATHER_REPORTING_SKILL_VERSION = Deno.env.get("SEVERE_WEATHER_REPORTING_SKILL_VERSION");

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RECONCILIATION_AGENT_ID || !RECONCILIATION_ENVIRONMENT_ID) {
  console.error("[reconcile] missing required env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECONCILIATION_AGENT_ID, RECONCILIATION_ENVIRONMENT_ID");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY! });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vyou-invite",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    return await handle(req);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[reconcile] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const invite = await requireInvite(req, supabase, { countAsUse: true });
  if (!invite.ok) return jsonResponse({ error: invite.error }, invite.status);

  let classification_id: string | undefined;
  try {
    const body = await req.json();
    classification_id = body.classification_id;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!classification_id) return jsonResponse({ error: "classification_id required" }, 400);

  // Idempotency short-circuit: if a verdict already exists, return it.
  // The unique constraint on verified_reports(classification_id) is the
  // durable guard; this pre-check avoids opening a paid session unnecessarily.
  // Force-re-run was previously available via `force: true` but has been
  // removed from the public surface — any client (including the cohort
  // /reports view) sending force now hits this cache path and gets the
  // existing row back. Re-runs are an admin operation; do them with the
  // service-role key from a script, not from the browser.
  const { data: existing } = await supabase
    .from("verified_reports")
    .select("*")
    .eq("classification_id", classification_id)
    .maybeSingle();
  if (existing) {
    return jsonResponse({ verified_report: existing, cached: true });
  }

  const { data: classification, error: clsErr } = await supabase
    .from("classifications")
    .select("id, report_id, phenomenon, features, hail_size_cm, confidence")
    .eq("id", classification_id)
    .single();
  if (clsErr) return jsonResponse({ error: `classification lookup: ${clsErr.message}` }, 404);

  const { data: report, error: reportErr } = await supabase
    .from("reports_v")
    .select("id, photo_url, lat, lon, heading_degrees, captured_at")
    .eq("id", classification.report_id)
    .single();
  if (reportErr) return jsonResponse({ error: `report lookup: ${reportErr.message}` }, 404);
  if (!report?.photo_url) return jsonResponse({ error: "report has no photo_url" }, 422);

  const radar = radolanFrameForReport({
    lon: report.lon,
    lat: report.lat,
    captured_at: report.captured_at,
  });

  // Anthropic's URL-image fetcher respects robots.txt, and DWD's maps.dwd.de
  // disallows /geoserver/. Fetch the PNG server-side and pass it inline as
  // base64. Edge functions are service operators of DWD's open-data API, not
  // crawlers, so this is the right shape regardless of the robots.txt issue.
  let radarImageBase64: string | null = null;
  try {
    const radarRes = await fetch(radar.url);
    if (radarRes.ok) {
      const buf = new Uint8Array(await radarRes.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      radarImageBase64 = btoa(bin);
    } else {
      console.warn(`[reconcile] radar fetch ${radarRes.status}: ${radar.url}`);
    }
  } catch (e) {
    console.warn(`[reconcile] radar fetch failed: ${(e as Error).message}`);
  }

  const classifierRecord = {
    phenomenon: classification.phenomenon,
    features: classification.features,
    hail_size_cm: classification.hail_size_cm,
    confidence: classification.confidence,
  };

  // Fetch the auxiliary feeds in parallel; any failure degrades to a
  // "feed unavailable" line in the prompt rather than blocking the verdict.
  const [openMeteo, mtgIr, mtgLi] = await Promise.all([
    fetchOpenMeteo({ lat: report.lat, lon: report.lon }),
    fetchMtgFrame({
      lat: report.lat,
      lon: report.lon,
      captured_at: report.captured_at,
      layer: "mtg_fd:ir105_hrfi",
    }),
    fetchMtgFrame({
      lat: report.lat,
      lon: report.lon,
      captured_at: report.captured_at,
      layer: "mtg_fd:li_afa",
    }),
  ]);

  const session = await anthropic.beta.sessions.create({
    agent: RECONCILIATION_AGENT_ID!,
    environment_id: RECONCILIATION_ENVIRONMENT_ID!,
    title: `reconcile ${classification_id.slice(0, 8)}`,
  });
  console.log(`[reconcile] session ${session.id} for classification ${classification_id}`);

  const stream = await anthropic.beta.sessions.events.stream(session.id);
  // deno-lint-ignore no-explicit-any
  const userContent: any[] = [
    { type: "image", source: { type: "url", url: report.photo_url } },
  ];
  const imageLabels: string[] = ["image 1: community photo"];
  if (radarImageBase64) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: radarImageBase64 },
    });
    imageLabels.push(`image ${imageLabels.length + 1}: DWD RADOLAN frame (${radar.frame_time_iso})`);
  }
  if (mtgIr.fetched && mtgIr.base64) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: mtgIr.base64 },
    });
    imageLabels.push(`image ${imageLabels.length + 1}: MTG FCI IR 10.5 µm (${mtgIr.time})`);
  }
  if (mtgLi.fetched && mtgLi.base64) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: mtgLi.base64 },
    });
    imageLabels.push(`image ${imageLabels.length + 1}: MTG Lightning Imager Accumulated Flash Area (${mtgLi.time})`);
  }

  const evidenceLines: string[] = [];
  evidenceLines.push(openMeteoSummary(openMeteo));
  evidenceLines.push(
    mtgIr.fetched
      ? `MTG FCI IR 10.5 µm tile attached as image (frame time ${mtgIr.time}).`
      : `MTG FCI IR 10.5 µm: feed unavailable (${mtgIr.error ?? "unknown"}).`,
  );
  evidenceLines.push(
    mtgLi.fetched
      ? `MTG Lightning Imager Accumulated Flash Area tile attached as image (frame time ${mtgLi.time}).`
      : `MTG Lightning Imager Accumulated Flash Area: feed unavailable (${mtgLi.error ?? "unknown"}).`,
  );

  userContent.push({
    type: "text",
    text: `Attached images:
${imageLabels.map((l) => `- ${l}`).join("\n")}
${radarImageBase64 ? "" : "\nNote: the DWD radar frame could not be fetched server-side; reconcile based on the classifier record alone, defaulting to inconclusive when radar evidence is required.\n"}
Report metadata:
- location: ${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}
- heading: ${Math.round(report.heading_degrees)}°
- captured_at: ${report.captured_at}
- radar frame time: ${radar.frame_time_iso}

Auxiliary evidence (do not block on missing feeds):
${evidenceLines.join("\n\n")}

Classifier record:
${JSON.stringify(classifierRecord, null, 2)}

Reconcile per the output contract.`,
  });

  await anthropic.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: userContent }],
  });

  let transcript = "";
  let stopReason: string | undefined;
  // Reconcile sends two images (photo + radar WMS frame) so cold sessions
  // genuinely run longer than the single-image classifier. 150s gives the
  // model headroom; the client polls 180s to absorb DB write latency.
  const DEADLINE_MS = 150_000;
  const MAX_EVENTS = 200;
  const startedAt = Date.now();
  const deadline = startedAt + DEADLINE_MS;
  let eventCount = 0;
  let timedOut = false;
  // deno-lint-ignore no-explicit-any
  let finalUsage: any = null;
  // deno-lint-ignore no-explicit-any
  let finalStats: any = null;

  try {
    for await (const event of stream) {
      eventCount++;
      if (Date.now() > deadline || eventCount > MAX_EVENTS) {
        timedOut = true;
        console.warn(`[reconcile] aborting session ${session.id} — events=${eventCount} elapsed=${Date.now() - startedAt}ms`);
        break;
      }
      if (event.type === "agent.message") {
        for (const block of event.content ?? []) {
          if (block.type === "text") transcript += block.text;
        }
      }
      if (event.type === "session.status_terminated") break;
      if (event.type === "session.status_idle") {
        stopReason = event.stop_reason?.type;
        if (stopReason !== "requires_action") break;
      }
    }
    // Retrieve BEFORE archive — usage/stats are finalised when the session is
    // idle or terminated; archiving first was racy and produced null rows.
    try {
      const retrieved = await anthropic.beta.sessions.retrieve(session.id);
      // deno-lint-ignore no-explicit-any
      finalUsage = (retrieved as any)?.usage ?? null;
      // deno-lint-ignore no-explicit-any
      finalStats = (retrieved as any)?.stats ?? null;
    } catch (e) {
      console.warn(`[reconcile] retrieve-for-usage failed ${session.id}:`, (e as Error)?.message);
    }
  } finally {
    anthropic.beta.sessions.archive(session.id).catch((e) => console.warn(`[reconcile] archive failed ${session.id}:`, e?.message));
  }

  const elapsedMs = Date.now() - startedAt;
  const feeds = {
    radar: radarImageBase64 !== null,
    open_meteo: openMeteo !== null,
    mtg_ir: mtgIr.fetched,
    mtg_li: mtgLi.fetched,
  };
  const sessionStats = buildSessionStats({
    session_id: session.id,
    agent_id: RECONCILIATION_AGENT_ID!,
    skill_id: SEVERE_WEATHER_REPORTING_SKILL_ID,
    skill_version: SEVERE_WEATHER_REPORTING_SKILL_VERSION,
    model: RECONCILIATION_MODEL,
    usage: finalUsage,
    stats: finalStats,
    timed_out: timedOut,
    events_count: eventCount,
    elapsed_ms: elapsedMs,
    stop_reason: stopReason ?? null,
    transcript_chars: transcript.length,
    feeds,
  });
  console.log(
    `[reconcile] session=${session.id} elapsed_ms=${elapsedMs} events=${eventCount} stop=${stopReason ?? "n/a"} transcript_chars=${transcript.length} timed_out=${timedOut} feeds=${JSON.stringify(feeds)}`,
  );

  // Timeout path: persist a row with session_stats so cost receipts are not
  // lost for the costliest runs. Verdict is `inconclusive` with a marker
  // rationale — the UI renders this as a clean inconclusive card.
  if (timedOut) {
    const row = await insertVerifiedReport({
      report_id: classification.report_id,
      classification_id: classification.id,
      radar_frame_url: radar.url,
      verdict: "inconclusive",
      rationale: "Reconciliation timed out (>90s or >200 events). The radar frame and classifier record were not fully compared.",
      confidence: "low",
      session_stats: sessionStats,
    });
    return jsonResponse({ verified_report: row, timed_out: true, session_id: session.id }, 504);
  }

  const parsed = extractJson(transcript, { requireKeys: ["verdict"] });
  if (!parsed) {
    // Log the tail of the transcript so prod incidents are diagnosable from
    // the function logs alone — the 502 body carries the full transcript for
    // the UI but logs are cheaper to grep at scale.
    const tail = transcript.slice(-400).replace(/\s+/g, " ").trim();
    console.warn(
      `[reconcile] unparseable JSON session=${session.id} transcript_len=${transcript.length} tail=${tail}`,
    );
    return jsonResponse({ error: "agent did not return parseable JSON", transcript }, 502);
  }

  const verdict = ["match", "mismatch", "inconclusive"].includes(parsed.verdict as string)
    ? (parsed.verdict as string)
    : "inconclusive";
  const confidence = ["low", "medium", "high"].includes(parsed.confidence as string)
    ? (parsed.confidence as string)
    : null;

  const row = await insertVerifiedReport({
    report_id: classification.report_id,
    classification_id: classification.id,
    radar_frame_url: radar.url,
    verdict,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : null,
    confidence,
    session_stats: sessionStats,
  });

  return jsonResponse({ verified_report: row, session_id: session.id });
}

// deno-lint-ignore no-explicit-any
async function insertVerifiedReport(fields: Record<string, any>): Promise<any> {
  const { data, error } = await supabase
    .from("verified_reports")
    .insert(fields)
    .select("id, verdict, rationale, confidence, radar_frame_url, created_at")
    .single();
  if (!error) return data;

  // unique_violation: another invocation landed the row between the
  // pre-check and this insert. Return the row that won.
  if (error.code === "23505") {
    const { data: winner } = await supabase
      .from("verified_reports")
      .select("id, verdict, rationale, confidence, radar_frame_url, created_at")
      .eq("classification_id", fields.classification_id)
      .maybeSingle();
    if (winner) return winner;
  }
  throw new Error(`verified_reports insert: ${error.message}`);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

