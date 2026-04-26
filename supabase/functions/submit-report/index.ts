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
import { fetchOpenMeteo, mtgFrameForReport } from "../_shared/feeds.ts";
import { radolanFrameForReport } from "../_shared/radolan.ts";

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

  // Hardened-plan v2 §2 — per-reporter submit rate limit. With Fix B the
  // classify→reconcile auto-fire amplifies submission cost; without a cap a
  // single tester running a script could burn the cohort's Anthropic budget
  // in an hour. 30/hr is comfortable headroom for any genuine human use.
  const SUBMIT_LIMIT = 30;
  const WINDOW_MS = 60 * 60 * 1000;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count: recentCount, error: rateErr } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", body.reporter_id!)
    .gte("submitted_at", since);
  if (rateErr) {
    console.warn(`[submit-report] rate-limit count failed: ${rateErr.message}`);
    // Fail open rather than block real users on a transient DB error; the
    // invite cap remains as the outer cost guard.
  } else if ((recentCount ?? 0) >= SUBMIT_LIMIT) {
    return jsonResponse(
      {
        error: `You've submitted ${recentCount} sky photos in the last hour — give it a breather and try again soon.`,
      },
      429,
    );
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

  // Hardened-plan v2 Fix A — capture weather-state references at submit
  // time so the verified-report card and the post-Reconciliation brief
  // have a stable, auditable snapshot even after the live radar rolls
  // forward. Three of the four sources are URL-only computations (no
  // network); only Open-Meteo actually fetches. We persist as a
  // background task via EdgeRuntime.waitUntil so the response stays fast
  // — context-write failures are non-fatal (reconcile can refetch).
  const ctxTask = persistReportContext({
    report_id: data.id,
    lat: body.lat,
    lon: body.lon,
    captured_at: body.captured_at,
  }).catch((e) => console.warn("[submit-report] context persist failed:", (e as Error)?.message));
  edgeWaitUntil(ctxTask);

  return jsonResponse({ id: data.id });
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function edgeWaitUntil(p: Promise<unknown>): void {
  // EdgeRuntime is a Deno-Deploy global on Supabase Edge Functions; in
  // local-tests / non-edge contexts it's undefined and we just let the
  // promise run to completion or get GC'd with the request.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(p);
  }
}

async function persistReportContext(args: {
  report_id: string;
  lat: number;
  lon: number;
  captured_at: string;
}): Promise<void> {
  const radar = radolanFrameForReport({ lon: args.lon, lat: args.lat, captured_at: args.captured_at });
  const mtgIr = mtgFrameForReport({ lat: args.lat, lon: args.lon, captured_at: args.captured_at, layer: "mtg_fd:ir105_hrfi" });
  const mtgLi = mtgFrameForReport({ lat: args.lat, lon: args.lon, captured_at: args.captured_at, layer: "mtg_fd:li_afa" });
  const meteoSnap = await fetchOpenMeteo({ lat: args.lat, lon: args.lon, forecast_hours: 12 });

  const rows = [
    {
      report_id: args.report_id,
      source: "radolan",
      frame_url: radar.url,
      frame_time_iso: radar.frame_time_iso,
      payload: { bbox_3857: radar.bbox_3857 },
    },
    {
      report_id: args.report_id,
      source: "mtg_ir",
      frame_url: mtgIr.url,
      frame_time_iso: mtgIr.time,
      payload: null,
    },
    {
      report_id: args.report_id,
      source: "mtg_li",
      frame_url: mtgLi.url,
      frame_time_iso: mtgLi.time,
      payload: null,
    },
    {
      report_id: args.report_id,
      source: "open_meteo",
      frame_url: meteoSnap.url,
      frame_time_iso: null,
      payload: meteoSnap.ok
        ? { current: meteoSnap.current, current_units: meteoSnap.current_units, hourly: meteoSnap.hourly, hourly_units: meteoSnap.hourly_units }
        : { error: meteoSnap.error },
    },
  ];

  const { error: ctxErr } = await supabase.from("report_context").insert(rows);
  if (ctxErr) {
    console.warn(`[submit-report] report_context insert failed: ${ctxErr.message}`);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
