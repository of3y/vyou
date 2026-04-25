// mtg-tile — server-side cache + proxy for EUMETView WMS tiles.
//
// Path:  /functions/v1/mtg-tile/{layer}/{z}/{x}/{y}.png?t=<iso-bucket>
// Layer: "ir" | "lightning"
//
// Why this exists: per the 2026-04-24 decision-log entry, every weather-layer
// provider gets server-side fetch by default. EUMETView's public WMS enforces
// ~20 req/window per client; without a shared cache, N viewers = N × upstream
// load and visible 502 / "cannot decode bitmap" errors when the limiter trips.
//
// On miss we fetch upstream, store in the public mtg-tiles bucket, and serve
// the bytes. On hit we return the cached bytes directly. URLs are content-
// addressed by the time bucket so browser + CDN caches dedupe aggressively.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "mtg-tiles";

const LAYERS: Record<string, { wmsLayer: string; bucketMs: number }> = {
  ir: { wmsLayer: "mtg_fd:ir105_hrfi", bucketMs: 10 * 60 * 1000 },
  lightning: { wmsLayer: "mtg_fd:li_afa", bucketMs: 5 * 60 * 1000 },
};

const EUMETVIEW_BASE =
  "https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetMap" +
  "&format=image/png&transparent=true&version=1.1.1&srs=EPSG:3857" +
  "&width=512&height=512&styles=";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const TRANSPARENT_PNG_512 = Uint8Array.from(
  // 1x1 transparent PNG; MapLibre upscales it. Returned on upstream failure so
  // the map keeps rendering instead of throwing decode errors into the console.
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (err) {
    console.error("[mtg-tile] unhandled", err);
    return tilePngResponse(TRANSPARENT_PNG_512, { fromCache: false, fallback: true });
  }
});

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Path arrives as /mtg-tile/{layer}/{z}/{x}/{y}.png — strip everything up to
  // and including the function name so we get [layer, z, x, y.png].
  const segments = url.pathname.split("/").filter(Boolean);
  const fnIdx = segments.indexOf("mtg-tile");
  const tail = fnIdx >= 0 ? segments.slice(fnIdx + 1) : segments;
  if (tail.length !== 4) return badRequest("expected /{layer}/{z}/{x}/{y}.png");

  const [layerKey, zStr, xStr, yWithExt] = tail;
  const layer = LAYERS[layerKey];
  if (!layer) return badRequest(`unknown layer: ${layerKey}`);

  const z = Number(zStr);
  const x = Number(xStr);
  const y = Number(yWithExt.replace(/\.png$/, ""));
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return badRequest("z/x/y must be integers");
  }
  if (z < 0 || z > 8) return badRequest("z out of range (0–8)");
  const tilesPerSide = 1 << z;
  if (x < 0 || x >= tilesPerSide || y < 0 || y >= tilesPerSide) {
    return badRequest("tile coords out of range for zoom");
  }

  const tParam = url.searchParams.get("t");
  const bucketIso = normalizeBucket(tParam, layer.bucketMs);
  if (!bucketIso) return badRequest("invalid or missing t (ISO timestamp)");

  const cacheKey = `${layerKey}/${bucketIso}/${z}/${x}/${y}.png`;

  const cached = await supabase.storage.from(BUCKET).download(cacheKey);
  if (cached.data) {
    const bytes = new Uint8Array(await cached.data.arrayBuffer());
    return tilePngResponse(bytes, { fromCache: true });
  }

  const bbox = tileBboxEpsg3857(z, x, y);
  const upstreamUrl =
    `${EUMETVIEW_BASE}&layers=${encodeURIComponent(layer.wmsLayer)}` +
    `&bbox=${bbox.join(",")}&time=${bucketIso}`;

  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok || !(upstream.headers.get("content-type") ?? "").startsWith("image/")) {
    console.warn(
      "[mtg-tile] upstream miss",
      JSON.stringify({ layerKey, z, x, y, bucketIso, status: upstream.status }),
    );
    return tilePngResponse(TRANSPARENT_PNG_512, { fromCache: false, fallback: true });
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());

  // Best-effort write — never fail the request if storage is wedged.
  const upload = await supabase.storage.from(BUCKET).upload(cacheKey, bytes, {
    contentType: "image/png",
    upsert: false,
    cacheControl: "31536000",
  });
  if (upload.error && !/exists/i.test(upload.error.message)) {
    console.warn("[mtg-tile] cache write failed", upload.error.message);
  }

  return tilePngResponse(bytes, { fromCache: false });
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function tilePngResponse(
  bytes: Uint8Array,
  meta: { fromCache: boolean; fallback?: boolean },
): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "content-type": "image/png",
      "cache-control": meta.fallback
        ? "public, max-age=30"
        : "public, max-age=600, immutable",
      "x-mtg-tile-source": meta.fallback ? "fallback" : meta.fromCache ? "cache" : "origin",
    },
  });
}

// XYZ tile (Web Mercator, Y origin at top) → EPSG:3857 bbox in metres.
function tileBboxEpsg3857(z: number, x: number, y: number): [number, number, number, number] {
  const EARTH_HALF_CIRC = 20037508.342789244;
  const tilesPerSide = 1 << z;
  const tileWidth = (EARTH_HALF_CIRC * 2) / tilesPerSide;
  const minX = -EARTH_HALF_CIRC + x * tileWidth;
  const maxX = minX + tileWidth;
  const maxY = EARTH_HALF_CIRC - y * tileWidth;
  const minY = maxY - tileWidth;
  return [minX, minY, maxX, maxY];
}

// Snap an arbitrary ISO timestamp to the layer's native repeat-cycle bucket.
// Returns null if the input is unparseable. Caps look-ahead at +60s so a
// client clock skew doesn't create cache keys for the future.
function normalizeBucket(input: string | null, stepMs: number): string | null {
  const raw = input ? new Date(input) : new Date();
  const t = Number.isFinite(raw.getTime()) ? raw.getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  const clamped = Math.min(t, now + 60_000);
  const floored = Math.floor(clamped / stepMs) * stepMs;
  return new Date(floored).toISOString();
}
