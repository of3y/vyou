// get-report — invite-gated read of one report's full payload.
//
// Returns:
//   {
//     report: reports_v row,
//     classification: row | null,
//     verified: row | null,
//     brief: row | null,
//     profile: { reporter_id, questions_earned, questions_used } | null
//   }
//
// Body: { id: string, reporter_id?: string }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireInvite } from "../_shared/invite.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[get-report] missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

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
    console.error("[get-report] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const invite = await requireInvite(req, supabase);
  if (!invite.ok) return jsonResponse({ error: invite.error }, invite.status);

  let body: { id?: string; reporter_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!body.id) return jsonResponse({ error: "id required" }, 400);

  const { data: report, error: repErr } = await supabase
    .from("reports_v")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();
  if (repErr) return jsonResponse({ error: `report: ${repErr.message}` }, 500);
  if (!report) return jsonResponse({ error: "report not found" }, 404);

  const [clsRes, briefRes] = await Promise.all([
    supabase
      .from("classifications")
      .select("*")
      .eq("agent", "classifier")
      .eq("report_id", body.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("briefs")
      .select("id, report_id, verified_report_id, question, content, sources, created_at")
      .eq("report_id", body.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const classification = clsRes.error ? null : clsRes.data;

  let verified: unknown = null;
  if (classification) {
    const { data: ver } = await supabase
      .from("verified_reports")
      .select("*")
      .eq("classification_id", (classification as { id: string }).id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    verified = ver ?? null;
  }

  let profile: { reporter_id: string; questions_earned: number; questions_used: number } | null = null;
  if (body.reporter_id) {
    const { data } = await supabase
      .from("profiles")
      .select("reporter_id, questions_earned, questions_used")
      .eq("reporter_id", body.reporter_id)
      .maybeSingle();
    if (data) profile = data;
  }

  return jsonResponse({
    report,
    classification: classification ?? null,
    verified,
    brief: briefRes.error ? null : (briefRes.data ?? null),
    profile,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
