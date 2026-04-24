import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";
import { buildSessionStats, CLASSIFIER_MODEL } from "../_shared/cost.ts";
import { requireInvite } from "../_shared/invite.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CLASSIFIER_AGENT_ID = Deno.env.get("CLASSIFIER_AGENT_ID");
const CLASSIFIER_ENVIRONMENT_ID = Deno.env.get("CLASSIFIER_ENVIRONMENT_ID");
const SEVERE_WEATHER_REPORTING_SKILL_ID = Deno.env.get("SEVERE_WEATHER_REPORTING_SKILL_ID");
const SEVERE_WEATHER_REPORTING_SKILL_VERSION = Deno.env.get("SEVERE_WEATHER_REPORTING_SKILL_VERSION");

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLASSIFIER_AGENT_ID || !CLASSIFIER_ENVIRONMENT_ID) {
  console.error("[classify] missing required env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLASSIFIER_AGENT_ID, CLASSIFIER_ENVIRONMENT_ID");
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
    console.error("[classify] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const invite = await requireInvite(req, supabase);
  if (!invite.ok) return jsonResponse({ error: invite.error }, invite.status);

  let report_id: string | undefined;
  try {
    const body = await req.json();
    report_id = body.report_id;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!report_id) return jsonResponse({ error: "report_id required" }, 400);

  // Idempotency short-circuit: if a classification already exists for this
  // report, return it rather than opening a second paid session.
  const { data: existingClassification } = await supabase
    .from("classifications")
    .select("id, phenomenon, features, confidence, hail_size_cm, session_stats")
    .eq("report_id", report_id)
    .eq("agent", "classifier")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingClassification) {
    return jsonResponse({ classification: existingClassification, cached: true });
  }

  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .select("id, photo_url")
    .eq("id", report_id)
    .single();
  if (reportErr) return jsonResponse({ error: `report lookup: ${reportErr.message}` }, 404);
  if (!report?.photo_url) return jsonResponse({ error: "report has no photo_url" }, 422);

  const session = await anthropic.beta.sessions.create({
    agent: CLASSIFIER_AGENT_ID!,
    environment_id: CLASSIFIER_ENVIRONMENT_ID!,
    title: `classify ${report_id.slice(0, 8)}`,
  });
  console.log(`[classify] session ${session.id} for report ${report_id}`);

  const stream = await anthropic.beta.sessions.events.stream(session.id);
  await anthropic.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [
          { type: "image", source: { type: "url", url: report.photo_url } },
          { type: "text", text: "Classify this sky photo per the output contract." },
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
        console.warn(`[classify] aborting session ${session.id} — events=${eventCount} elapsed=${Date.now() - startedAt}ms`);
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
    // Retrieve BEFORE archive — usage/stats finalise when the session hits
    // idle/terminated; archive-first was racy and produced null-usage rows.
    try {
      const retrieved = await anthropic.beta.sessions.retrieve(session.id);
      // deno-lint-ignore no-explicit-any
      finalUsage = (retrieved as any)?.usage ?? null;
      // deno-lint-ignore no-explicit-any
      finalStats = (retrieved as any)?.stats ?? null;
    } catch (e) {
      console.warn(`[classify] retrieve-for-usage failed ${session.id}:`, (e as Error)?.message);
    }
  } finally {
    anthropic.beta.sessions.archive(session.id).catch((e) => console.warn(`[classify] archive failed ${session.id}:`, e?.message));
  }

  const sessionStats = buildSessionStats({
    session_id: session.id,
    agent_id: CLASSIFIER_AGENT_ID!,
    skill_id: SEVERE_WEATHER_REPORTING_SKILL_ID,
    skill_version: SEVERE_WEATHER_REPORTING_SKILL_VERSION,
    model: CLASSIFIER_MODEL,
    usage: finalUsage,
    stats: finalStats,
    timed_out: timedOut,
  });

  // Timeout path: persist a row so the Lane B cost query sees the costliest
  // runs. phenomenon=null + confidence=null is the UI signal for "no verdict".
  if (timedOut) {
    const row = await upsertClassification({
      report_id,
      agent: "classifier",
      phenomenon: null,
      features: null,
      hail_size_cm: null,
      confidence: null,
      session_stats: sessionStats,
    });
    return jsonResponse({ classification: row, timed_out: true, session_id: session.id }, 504);
  }

  const parsed = extractJson(transcript);
  if (!parsed) {
    return jsonResponse({ error: "agent did not return parseable JSON", transcript }, 502);
  }

  const classification = await upsertClassification({
    report_id,
    agent: "classifier",
    phenomenon: typeof parsed.phenomenon === "string" ? parsed.phenomenon : null,
    features: Array.isArray(parsed.features) ? parsed.features : null,
    hail_size_cm: typeof parsed.hail_size_cm === "number" ? parsed.hail_size_cm : null,
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : null,
    session_stats: sessionStats,
  });

  return jsonResponse({ classification, session_id: session.id });
}

// deno-lint-ignore no-explicit-any
async function upsertClassification(fields: Record<string, any>): Promise<any> {
  const { data, error } = await supabase
    .from("classifications")
    .insert(fields)
    .select("id, phenomenon, features, confidence, hail_size_cm, session_stats")
    .single();
  if (error) throw new Error(`classifications insert: ${error.message}`);
  return data;
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
