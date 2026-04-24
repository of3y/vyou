import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CLASSIFIER_AGENT_ID = Deno.env.get("CLASSIFIER_AGENT_ID");
const CLASSIFIER_ENVIRONMENT_ID = Deno.env.get("CLASSIFIER_ENVIRONMENT_ID");

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLASSIFIER_AGENT_ID || !CLASSIFIER_ENVIRONMENT_ID) {
  console.error("[classify] missing required env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLASSIFIER_AGENT_ID, CLASSIFIER_ENVIRONMENT_ID");
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
    console.error("[classify] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  let report_id: string | undefined;
  try {
    const body = await req.json();
    report_id = body.report_id;
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!report_id) return jsonResponse({ error: "report_id required" }, 400);

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
  for await (const event of stream) {
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

  anthropic.beta.sessions.archive(session.id).catch(() => {});

  const parsed = extractJson(transcript);
  if (!parsed) {
    return jsonResponse({ error: "agent did not return parseable JSON", transcript }, 502);
  }

  const { data: classification, error: classErr } = await supabase
    .from("classifications")
    .insert({
      report_id,
      agent: "classifier",
      phenomenon: typeof parsed.phenomenon === "string" ? parsed.phenomenon : null,
      features: Array.isArray(parsed.features) ? parsed.features : null,
      hail_size_cm: typeof parsed.hail_size_cm === "number" ? parsed.hail_size_cm : null,
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : null,
    })
    .select("id, phenomenon, features, confidence, hail_size_cm")
    .single();
  if (classErr) return jsonResponse({ error: `classifications insert: ${classErr.message}` }, 500);

  return jsonResponse({ classification, session_id: session.id });
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
