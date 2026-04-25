import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";
import { buildSessionStats } from "../_shared/cost.ts";
import { requireInvite } from "../_shared/invite.ts";
import { fetchOpenMeteo, openMeteoSummary } from "../_shared/feeds.ts";
import { extractJson } from "../_shared/extractJson.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DEEP_RESEARCHER_AGENT_ID = Deno.env.get("DEEP_RESEARCHER_AGENT_ID");
const DEEP_RESEARCHER_ENVIRONMENT_ID = Deno.env.get("DEEP_RESEARCHER_ENVIRONMENT_ID");
const DEEP_RESEARCHER_PLANNER_SKILL_ID = Deno.env.get("DEEP_RESEARCHER_PLANNER_SKILL_ID");
const DEEP_RESEARCHER_PLANNER_SKILL_VERSION = Deno.env.get("DEEP_RESEARCHER_PLANNER_SKILL_VERSION");
const DEEP_RESEARCHER_MODEL = "claude-opus-4-7";

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEEP_RESEARCHER_AGENT_ID || !DEEP_RESEARCHER_ENVIRONMENT_ID) {
  console.error("[research] missing required env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEP_RESEARCHER_AGENT_ID, DEEP_RESEARCHER_ENVIRONMENT_ID");
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
    console.error("[research] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const invite = await requireInvite(req, supabase, { countAsUse: true });
  if (!invite.ok) return jsonResponse({ error: invite.error }, invite.status);

  let report_id: string | undefined;
  let question: string | undefined;
  let reporter_id: string | undefined;
  let user_lat: number | undefined;
  let user_lon: number | undefined;
  try {
    const body = await req.json();
    report_id = body.report_id;
    question = (body.question ?? "").toString().trim();
    reporter_id = body.reporter_id;
    user_lat = typeof body.user_lat === "number" ? body.user_lat : undefined;
    user_lon = typeof body.user_lon === "number" ? body.user_lon : undefined;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!report_id) return jsonResponse({ error: "report_id required" }, 400);
  if (!question) return jsonResponse({ error: "question required" }, 400);
  if (question.length > 500) return jsonResponse({ error: "question must be <=500 chars" }, 400);

  const { data: report, error: reportErr } = await supabase
    .from("reports_v")
    .select("id, reporter_id, photo_url, lat, lon, heading_degrees, captured_at, caption, status")
    .eq("id", report_id)
    .single();
  if (reportErr) return jsonResponse({ error: `report lookup: ${reportErr.message}` }, 404);

  const { data: classification } = await supabase
    .from("classifications")
    .select("id, phenomenon, features, hail_size_cm, confidence")
    .eq("report_id", report_id)
    .eq("agent", "classifier")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: verified } = await supabase
    .from("verified_reports")
    .select("id, verdict, rationale, confidence, radar_frame_url, created_at")
    .eq("report_id", report_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Earn-a-Question gate: only enforce when the profiles table exists AND the
  // caller passed a reporter_id. If profiles isn't migrated yet, the function
  // skips the gate so the UI can still demo end-to-end.
  let ledgerUsable = false;
  let questionsAvailable = 0;
  if (reporter_id) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("questions_earned, questions_used")
      .eq("reporter_id", reporter_id)
      .maybeSingle();
    if (!profileErr) {
      ledgerUsable = true;
      if (profile) {
        questionsAvailable = (profile.questions_earned ?? 0) - (profile.questions_used ?? 0);
        if (questionsAvailable <= 0) {
          return jsonResponse({ error: "no questions available — verify a report to earn one" }, 402);
        }
      } else {
        return jsonResponse({ error: "no questions available — verify a report to earn one" }, 402);
      }
    } else {
      console.warn("[research] profiles read failed; running ungated", profileErr.message);
    }
  }

  // Nearby verified reports — last 24h, ~5 km radius. We pull more rows than
  // needed and filter by haversine in JS to avoid a PostGIS RPC for one query.
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: nearbyVerifiedRaw } = await supabase
    .from("verified_reports")
    .select("id, report_id, verdict, rationale, confidence, created_at, reports_v!inner(lat, lon, captured_at, photo_url)")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(80);

  type NearbyRow = {
    id: string;
    report_id: string;
    verdict: string;
    rationale: string | null;
    confidence: string | null;
    created_at: string;
    distance_km: number;
    lat: number;
    lon: number;
    captured_at: string;
  };
  const nearby: NearbyRow[] = [];
  for (const r of (nearbyVerifiedRaw ?? []) as Array<Record<string, unknown>>) {
    // PostgREST embeds the joined row under the relation name. Older REST
    // versions return it as an object; some return an array. Handle both.
    const joined = (r as { reports_v?: unknown }).reports_v;
    const view = Array.isArray(joined) ? (joined[0] as Record<string, unknown> | undefined) : (joined as Record<string, unknown> | undefined);
    if (!view || typeof view.lat !== "number" || typeof view.lon !== "number") continue;
    const d = haversineKm(report.lat, report.lon, view.lat, view.lon);
    if (d > 5) continue;
    if (r.report_id === report_id) continue; // exclude the subject of the question
    nearby.push({
      id: r.id as string,
      report_id: r.report_id as string,
      verdict: r.verdict as string,
      rationale: (r.rationale as string | null) ?? null,
      confidence: (r.confidence as string | null) ?? null,
      created_at: r.created_at as string,
      distance_km: Math.round(d * 100) / 100,
      lat: view.lat,
      lon: view.lon,
      captured_at: view.captured_at as string,
    });
    if (nearby.length >= 20) break;
  }

  const queryLat = typeof user_lat === "number" ? user_lat : report.lat;
  const queryLon = typeof user_lon === "number" ? user_lon : report.lon;
  const openMeteo = await fetchOpenMeteo({ lat: queryLat, lon: queryLon, forecast_hours: 2 });

  const session = await anthropic.beta.sessions.create({
    agent: DEEP_RESEARCHER_AGENT_ID!,
    environment_id: DEEP_RESEARCHER_ENVIRONMENT_ID!,
    title: `research ${report_id.slice(0, 8)}`,
  });
  console.log(`[research] session ${session.id} for report ${report_id}`);

  const stream = await anthropic.beta.sessions.events.stream(session.id);
  const promptText = buildPrompt({
    question: question!,
    report,
    classification,
    verified,
    nearby,
    openMeteoText: openMeteoSummary(openMeteo),
    queryLat,
    queryLon,
  });

  await anthropic.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          { type: "text", text: promptText },
        ],
      },
    ],
  });

  let transcript = "";
  let stopReason: string | undefined;
  const DEADLINE_MS = 90_000;
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
        console.warn(`[research] aborting session ${session.id} — events=${eventCount} elapsed=${Date.now() - startedAt}ms`);
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
    try {
      const retrieved = await anthropic.beta.sessions.retrieve(session.id);
      // deno-lint-ignore no-explicit-any
      finalUsage = (retrieved as any)?.usage ?? null;
      // deno-lint-ignore no-explicit-any
      finalStats = (retrieved as any)?.stats ?? null;
    } catch (e) {
      console.warn(`[research] retrieve-for-usage failed ${session.id}:`, (e as Error)?.message);
    }
  } finally {
    anthropic.beta.sessions.archive(session.id).catch((e) => console.warn(`[research] archive failed ${session.id}:`, e?.message));
  }

  const sessionStats = buildSessionStats({
    session_id: session.id,
    agent_id: DEEP_RESEARCHER_AGENT_ID!,
    skill_id: DEEP_RESEARCHER_PLANNER_SKILL_ID,
    skill_version: DEEP_RESEARCHER_PLANNER_SKILL_VERSION,
    model: DEEP_RESEARCHER_MODEL,
    usage: finalUsage,
    stats: finalStats,
    timed_out: timedOut,
  });

  if (timedOut) {
    return jsonResponse({ error: "research timed out", session_id: session.id, session_stats: sessionStats }, 504);
  }

  const parsed = parseBrief(transcript);
  if (!parsed) {
    const tail = transcript.slice(-400).replace(/\s+/g, " ").trim();
    console.warn(
      `[research] unparseable brief session=${session.id} transcript_len=${transcript.length} tail=${tail}`,
    );
    return jsonResponse({ error: "agent did not return parseable response", transcript, session_stats: sessionStats }, 502);
  }

  const briefRow = await insertBrief({
    report_id,
    verified_report_id: verified?.id ?? null,
    reporter_id: reporter_id ?? null,
    question: question!,
    content: parsed.content,
    sources: parsed.sources,
    session_stats: sessionStats,
  });

  if (ledgerUsable && reporter_id) {
    // Re-read current questions_used and bump by 1. Race-tolerable at cohort
    // scale; the Supabase REST surface has no atomic increment.
    const { data: cur } = await supabase
      .from("profiles")
      .select("questions_used")
      .eq("reporter_id", reporter_id)
      .maybeSingle();
    const next = (cur?.questions_used ?? 0) + 1;
    const { error: incErr } = await supabase
      .from("profiles")
      .update({ questions_used: next, updated_at: new Date().toISOString() })
      .eq("reporter_id", reporter_id);
    if (incErr) console.warn("[research] questions_used increment failed:", incErr.message);
  }

  return jsonResponse({ brief: briefRow, session_id: session.id });
}

// deno-lint-ignore no-explicit-any
async function insertBrief(fields: Record<string, any>): Promise<any> {
  const { data, error } = await supabase
    .from("briefs")
    .insert(fields)
    .select("id, report_id, verified_report_id, question, content, sources, created_at")
    .single();
  if (error) throw new Error(`briefs insert: ${error.message}`);
  return data;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function buildPrompt(args: {
  question: string;
  report: Record<string, unknown>;
  classification: Record<string, unknown> | null;
  verified: Record<string, unknown> | null;
  nearby: Array<Record<string, unknown>>;
  openMeteoText: string;
  queryLat: number;
  queryLon: number;
}): string {
  const r = args.report;
  const nearbyBlock = args.nearby.length
    ? args.nearby.map((n) => `- ${n.created_at} · verdict=${n.verdict} · ${n.distance_km}km · captured_at=${n.captured_at}${n.rationale ? ` · "${(n.rationale as string).slice(0, 160)}"` : ""}`).join("\n")
    : "(no verified reports within 5 km in the last 24h)";

  return `User question: "${args.question}"

Question lat/lon: ${args.queryLat.toFixed(4)}, ${args.queryLon.toFixed(4)}

Subject report (the verified report this question is anchored to):
- id: ${r.id}
- location: ${(r.lat as number).toFixed(4)}, ${(r.lon as number).toFixed(4)}
- heading: ${Math.round((r.heading_degrees as number) ?? 0)}°
- captured_at: ${r.captured_at}
- caption: ${r.caption ?? "(none)"}

Classifier record:
${args.classification ? JSON.stringify(args.classification, null, 2) : "(no classification — treat the verdict and weather sources as the load-bearing evidence)"}

Reconciliation verdict:
${args.verified ? JSON.stringify(args.verified, null, 2) : "(no reconciliation yet — community evidence is thin)"}

Nearby verified reports (last 24h, within 5 km, max 20):
${nearbyBlock}

Open-Meteo current + 2h forecast at the question lat/lon:
${args.openMeteoText}

Compose a brief that answers the user's question per the deep-researcher-planner skill — voice, trigger pattern, and anti-patterns. Return JSON: { "content": "<short markdown answer, 2-5 sentences>", "sources": [{ "label": "<short chip text>", "kind": "weather"|"community"|"satellite"|"radar", "ref": "<field name, layer name, or report id>" }, ...] }.`;
}

function parseBrief(text: string): { content: string; sources: Array<Record<string, unknown>> } | null {
  const trimmed = text.trim();
  // Shared extractor walks every balanced {...} candidate from the end and
  // requires `content` so we don't return a schema-rehearsal fragment that
  // happened to parse but lacks the answer text.
  const obj = extractJson(trimmed, { requireKeys: ["content"] });
  if (obj && typeof obj.content === "string") {
    return {
      content: obj.content,
      sources: Array.isArray(obj.sources) ? obj.sources : [],
    };
  }
  // Last-ditch: take the whole transcript as the content with no sources —
  // the model spoke prose instead of JSON; surface the prose rather than 502.
  if (trimmed.length > 0) return { content: trimmed, sources: [] };
  return null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
