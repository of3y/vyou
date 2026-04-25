// list-reports — invite-gated read of recent reports for the map + reports list.
//
// Returns:
//   {
//     reports: [{ id, reporter_id, lon, lat, heading_degrees, status,
//                 captured_at, submitted_at, photo_url, caption,
//                 classification, verified }],
//     profile: { reporter_id, questions_earned, questions_used } | null
//   }
//
// Body: { reporter_id?: string, since_ms?: number, limit?: number }
//
// reporter_id is optional — when present we attach the matching profiles row
// so MapPage can compute questions_available without a second invoke.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireInvite } from "../_shared/invite.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[list-reports] missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vyou-invite",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_LIMIT = 100;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[list-reports] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const invite = await requireInvite(req, supabase);
  if (!invite.ok) return jsonResponse({ error: invite.error }, invite.status);

  let body: { reporter_id?: string; since_ms?: number; limit?: number } = {};
  try {
    if (req.headers.get("content-length") !== "0") body = await req.json();
  } catch {
    // empty body is fine — defaults apply
  }
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), 500);
  const sinceIso = new Date(Date.now() - (body.since_ms ?? DEFAULT_LOOKBACK_MS)).toISOString();

  const { data: reports, error: repErr } = await supabase
    .from("reports_v")
    .select("*")
    .gte("captured_at", sinceIso)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (repErr) return jsonResponse({ error: `reports: ${repErr.message}` }, 500);

  const reportRows = reports ?? [];
  const ids = reportRows.map((r: { id: string }) => r.id);

  let classifications: Array<{ id: string; report_id: string; created_at: string; [k: string]: unknown }> = [];
  let verifieds: Array<{ id: string; report_id: string; classification_id: string; created_at: string; [k: string]: unknown }> = [];

  if (ids.length > 0) {
    const [clsRes, verRes] = await Promise.all([
      supabase
        .from("classifications")
        .select("*")
        .eq("agent", "classifier")
        .in("report_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("verified_reports")
        .select("*")
        .in("report_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    if (clsRes.error) return jsonResponse({ error: `classifications: ${clsRes.error.message}` }, 500);
    if (verRes.error) return jsonResponse({ error: `verified: ${verRes.error.message}` }, 500);
    classifications = clsRes.data ?? [];
    verifieds = verRes.data ?? [];
  }

  const clsByReport = new Map<string, typeof classifications[number]>();
  for (const c of classifications) {
    if (!clsByReport.has(c.report_id)) clsByReport.set(c.report_id, c);
  }
  const verByClassification = new Map<string, typeof verifieds[number]>();
  for (const v of verifieds) {
    if (!verByClassification.has(v.classification_id)) verByClassification.set(v.classification_id, v);
  }

  const merged = reportRows.map((r: { id: string }) => {
    const cls = clsByReport.get(r.id) ?? null;
    const ver = cls ? (verByClassification.get(cls.id) ?? null) : null;
    return { ...r, classification: cls, verified: ver };
  });

  let profile: { reporter_id: string; questions_earned: number; questions_used: number } | null = null;
  if (body.reporter_id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("reporter_id, questions_earned, questions_used")
      .eq("reporter_id", body.reporter_id)
      .maybeSingle();
    if (!error && data) profile = data;
  }

  return jsonResponse({ reports: merged, profile });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
