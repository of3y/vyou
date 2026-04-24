import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";
import { buildSessionStats } from "../_shared/cost.ts";
import { radolanFrameForReport } from "../_shared/radolan.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RECONCILIATION_AGENT_ID = Deno.env.get("RECONCILIATION_AGENT_ID");
const RECONCILIATION_ENVIRONMENT_ID = Deno.env.get("RECONCILIATION_ENVIRONMENT_ID");
const RECONCILIATION_MODEL = Deno.env.get("RECONCILIATION_MODEL") ?? "claude-opus-4-7";
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  let classification_id: string | undefined;
  try {
    const body = await req.json();
    classification_id = body.classification_id;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!classification_id) return jsonResponse({ error: "classification_id required" }, 400);

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

  const classifierRecord = {
    phenomenon: classification.phenomenon,
    features: classification.features,
    hail_size_cm: classification.hail_size_cm,
    confidence: classification.confidence,
  };

  const session = await anthropic.beta.sessions.create({
    agent: RECONCILIATION_AGENT_ID!,
    environment_id: RECONCILIATION_ENVIRONMENT_ID!,
    title: `reconcile ${classification_id.slice(0, 8)}`,
  });
  console.log(`[reconcile] session ${session.id} for classification ${classification_id}`);

  const stream = await anthropic.beta.sessions.events.stream(session.id);
  await anthropic.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          { type: "image", source: { type: "url", url: report.photo_url } },
          { type: "image", source: { type: "url", url: radar.url } },
          {
            type: "text",
            text: `Community photo (image 1) and DWD RADOLAN frame (image 2) for the same report.

Report metadata:
- location: ${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}
- heading: ${Math.round(report.heading_degrees)}°
- captured_at: ${report.captured_at}
- radar frame time: ${radar.frame_time_iso}

Classifier record:
${JSON.stringify(classifierRecord, null, 2)}

Reconcile per the output contract.`,
          },
        ],
      },
    ],
  });

  let transcript = "";
  let stopReason: string | undefined;
  const DEADLINE_MS = 90_000;
  const MAX_EVENTS = 200;
  const deadline = Date.now() + DEADLINE_MS;
  let eventCount = 0;
  let timedOut = false;
  try {
    for await (const event of stream) {
      eventCount++;
      if (Date.now() > deadline || eventCount > MAX_EVENTS) {
        timedOut = true;
        console.warn(`[reconcile] aborting session ${session.id} — events=${eventCount}`);
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
  } finally {
    // Best-effort final-stats pull so session_stats carries cost receipts.
    anthropic.beta.sessions.archive(session.id).catch((e) => console.warn(`[reconcile] archive failed ${session.id}:`, e?.message));
  }

  let finalUsage: Record<string, unknown> | null = null;
  let finalStats: Record<string, unknown> | null = null;
  try {
    const retrieved = await anthropic.beta.sessions.retrieve(session.id);
    // deno-lint-ignore no-explicit-any
    finalUsage = (retrieved as any)?.usage ?? null;
    // deno-lint-ignore no-explicit-any
    finalStats = (retrieved as any)?.stats ?? null;
  } catch (e) {
    console.warn(`[reconcile] retrieve-for-usage failed ${session.id}:`, (e as Error)?.message);
  }

  const sessionStats = buildSessionStats({
    session_id: session.id,
    agent_id: RECONCILIATION_AGENT_ID!,
    skill_id: SEVERE_WEATHER_REPORTING_SKILL_ID,
    skill_version: SEVERE_WEATHER_REPORTING_SKILL_VERSION,
    model: RECONCILIATION_MODEL,
    // deno-lint-ignore no-explicit-any
    usage: finalUsage as any,
    // deno-lint-ignore no-explicit-any
    stats: finalStats as any,
  });

  if (timedOut) {
    return jsonResponse({ error: "reconciliation timed out", session_id: session.id, events: eventCount }, 504);
  }

  const parsed = extractJson(transcript);
  if (!parsed) {
    return jsonResponse({ error: "agent did not return parseable JSON", transcript }, 502);
  }

  const verdict = ["match", "mismatch", "inconclusive"].includes(parsed.verdict as string)
    ? (parsed.verdict as string)
    : "inconclusive";
  const confidence = ["low", "medium", "high"].includes(parsed.confidence as string)
    ? (parsed.confidence as string)
    : null;

  const { data: verified, error: vrErr } = await supabase
    .from("verified_reports")
    .insert({
      report_id: classification.report_id,
      classification_id: classification.id,
      radar_frame_url: radar.url,
      verdict,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : null,
      confidence,
      session_stats: sessionStats,
    })
    .select("id, verdict, rationale, confidence, radar_frame_url, created_at")
    .single();
  if (vrErr) return jsonResponse({ error: `verified_reports insert: ${vrErr.message}` }, 500);

  return jsonResponse({ verified_report: verified, session_id: session.id });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function extractJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}
