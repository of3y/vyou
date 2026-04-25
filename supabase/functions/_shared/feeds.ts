// External weather feeds threaded into Reconciliation and Deep Researcher.
// Three sources, all anonymous:
//   1. Open-Meteo current + short forecast — air state at the report's lat-lon.
//   2. EUMETView WMS GetMap for MTG FCI IR 10.5 µm — cloud-top temperature
//      around the report, full-disc tile clipped to a small bbox.
//   3. EUMETView WMS GetMap for MTG Lightning Imager Accumulated Flash Area —
//      total-lightning context around the report.
//
// All fetches are best-effort. Callers degrade to "feed unavailable" on
// failure rather than blocking the verdict — the brief and the research path
// must still ship if EUMETView is down.

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const EUMETVIEW_WMS = "https://view.eumetsat.int/geoserver/wms";

const OPEN_METEO_CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",
  "precipitation",
  "precipitation_probability",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "uv_index",
].join(",");

const OPEN_METEO_HOURLY_FIELDS = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "cloud_cover",
  "wind_speed_10m",
  "wind_gusts_10m",
  "uv_index",
].join(",");

export type OpenMeteoSnapshot = {
  ok: true;
  url: string;
  current: Record<string, unknown> | null;
  current_units: Record<string, unknown> | null;
  hourly: Record<string, unknown> | null;
  hourly_units: Record<string, unknown> | null;
} | {
  ok: false;
  url: string;
  error: string;
};

export async function fetchOpenMeteo(args: {
  lat: number;
  lon: number;
  forecast_hours?: number;
}): Promise<OpenMeteoSnapshot> {
  const params = new URLSearchParams({
    latitude: args.lat.toFixed(4),
    longitude: args.lon.toFixed(4),
    current: OPEN_METEO_CURRENT_FIELDS,
    timezone: "auto",
  });
  if (args.forecast_hours && args.forecast_hours > 0) {
    params.set("hourly", OPEN_METEO_HOURLY_FIELDS);
    params.set("forecast_hours", String(args.forecast_hours));
  }
  const url = `${OPEN_METEO_URL}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, url, error: `open-meteo ${res.status}` };
    }
    const json = await res.json();
    return {
      ok: true,
      url,
      current: json?.current ?? null,
      current_units: json?.current_units ?? null,
      hourly: json?.hourly ?? null,
      hourly_units: json?.hourly_units ?? null,
    };
  } catch (e) {
    return { ok: false, url, error: (e as Error).message };
  }
}

// MTG full-disc tiles are large; we clip a ~512km box around the point so the
// IR10.5 + LI products carry visible regional cloud + lightning context.
const MTG_HALF_EXTENT_DEG = 4; // ~440 km at mid-latitudes; coarse but visible.

export type MtgFrame = {
  url: string;
  layer: string;
  time: string;
  fetched: boolean;
  error?: string;
  base64?: string;
};

function mtgFrameUrl(args: { lat: number; lon: number; layer: string; time: string }): string {
  const minx = args.lon - MTG_HALF_EXTENT_DEG;
  const maxx = args.lon + MTG_HALF_EXTENT_DEG;
  const miny = args.lat - MTG_HALF_EXTENT_DEG;
  const maxy = args.lat + MTG_HALF_EXTENT_DEG;
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: args.layer,
    styles: "",
    format: "image/png",
    transparent: "true",
    crs: "CRS:84",
    bbox: `${minx},${miny},${maxx},${maxy}`,
    width: "512",
    height: "512",
    time: args.time,
  });
  return `${EUMETVIEW_WMS}?${params.toString()}`;
}

function floorTo(date: Date, minutes: number): Date {
  const ms = minutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

export function mtgFrameForReport(args: {
  lat: number;
  lon: number;
  captured_at: string;
  layer: "mtg_fd:ir105_hrfi" | "mtg_fd:li_afa";
}): { url: string; time: string } {
  const cadenceMin = args.layer === "mtg_fd:ir105_hrfi" ? 10 : 5;
  const t = floorTo(new Date(args.captured_at), cadenceMin).toISOString();
  return {
    url: mtgFrameUrl({ lat: args.lat, lon: args.lon, layer: args.layer, time: t }),
    time: t,
  };
}

export async function fetchMtgFrame(args: {
  lat: number;
  lon: number;
  captured_at: string;
  layer: "mtg_fd:ir105_hrfi" | "mtg_fd:li_afa";
}): Promise<MtgFrame> {
  const { url, time } = mtgFrameForReport(args);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { url, layer: args.layer, time, fetched: false, error: `mtg ${res.status}` };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { url, layer: args.layer, time, fetched: true, base64: btoa(bin) };
  } catch (e) {
    return { url, layer: args.layer, time, fetched: false, error: (e as Error).message };
  }
}

// Compact human-readable summary of the Open-Meteo snapshot for inclusion in
// agent prompts. Numeric — agents read structured tabular data more reliably
// than free prose.
export function openMeteoSummary(snap: OpenMeteoSnapshot): string {
  if (!snap.ok) return `Open-Meteo: feed unavailable (${snap.error}).`;
  const c = snap.current ?? {};
  const u = snap.current_units ?? {};
  const fmt = (k: string) => {
    const v = (c as Record<string, unknown>)[k];
    if (v === undefined || v === null) return "—";
    const unit = (u as Record<string, unknown>)[k];
    return `${v}${unit ? String(unit) : ""}`;
  };
  return [
    `Open-Meteo current (lat/lon @ ${snap.url.match(/latitude=([^&]+)/)?.[1]},${snap.url.match(/longitude=([^&]+)/)?.[1]}):`,
    `  temperature_2m=${fmt("temperature_2m")}, apparent=${fmt("apparent_temperature")}, dew_point_2m=${fmt("dew_point_2m")}`,
    `  relative_humidity_2m=${fmt("relative_humidity_2m")}, uv_index=${fmt("uv_index")}`,
    `  cloud_cover=${fmt("cloud_cover")} (low=${fmt("cloud_cover_low")}, mid=${fmt("cloud_cover_mid")}, high=${fmt("cloud_cover_high")})`,
    `  precipitation=${fmt("precipitation")}, precipitation_probability=${fmt("precipitation_probability")}`,
    `  wind_speed_10m=${fmt("wind_speed_10m")}, gusts=${fmt("wind_gusts_10m")}, direction=${fmt("wind_direction_10m")}`,
  ].join("\n");
}
