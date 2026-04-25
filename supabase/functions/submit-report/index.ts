// submit-report — invite-gated insert into reports.
//
// Body: {
//   reporter_id: string, photo_url: string, lon: number, lat: number,
//   heading_degrees: number, location_accuracy_m?: number | null,
//   captured_at: string, caption?: string | null, status?: string
// }
//
// Returns: { id }

import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireInvite } from "../_shared/invite.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[submit-report] missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
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
    console.error("[submit-report] unhandled", message, err);
    return jsonResponse({ error: message }, 500);
  }
});

type Body = {
  reporter_id?: string;
  photo_url?: string;
  lon?: number;
  lat?: number;
  heading_degrees?: number;
  location_accuracy_m?: number | null;
  captured_at?: string;
  caption?: string | null;
  status?: string;
};

async function handle(req: Request): Promise<Response> {
  const invite = await requireInvite(req, supabase);
  if (!invite.ok) return jsonResponse({ error: invite.error }, invite.status);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const required: (keyof Body)[] = ["reporter_id", "photo_url", "lon", "lat", "heading_degrees", "captured_at"];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null) {
      return jsonResponse({ error: `${k} required` }, 400);
    }
  }
  if (typeof body.lon !== "number" || typeof body.lat !== "number") {
    return jsonResponse({ error: "lon/lat must be numbers" }, 400);
  }
  if (typeof body.heading_degrees !== "number" || body.heading_degrees < 0 || body.heading_degrees >= 360) {
    return jsonResponse({ error: "heading_degrees out of range" }, 400);
  }

  const status = body.status && ["pending", "accepted", "rejected", "review"].includes(body.status)
    ? body.status
    : "accepted";

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: body.reporter_id,
      photo_url: body.photo_url,
      location: `POINT(${body.lon} ${body.lat})`,
      heading_degrees: body.heading_degrees,
      location_accuracy_m: body.location_accuracy_m ?? null,
      captured_at: body.captured_at,
      caption: body.caption ? body.caption.slice(0, 280) : null,
      status,
    })
    .select("id")
    .single();

  if (error) return jsonResponse({ error: `insert: ${error.message}` }, 500);
  return jsonResponse({ id: data.id });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
