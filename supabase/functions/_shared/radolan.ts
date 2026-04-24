// DWD RADOLAN WMS frame URL for a point + time. Matches the map-layer source in MapView.tsx.
// RADOLAN cadence is ~5 minutes, so we round capture time down to the nearest slot.

const DWD_WMS = "https://maps.dwd.de/geoserver/dwd/wms";
const LAYER = "dwd:Niederschlagsradar";

// 128 km half-extent in EPSG:3857 metres gives a ~256 km bbox centered on the report.
// Large enough to catch the parent storm cell if there is one, small enough to not blur the signal.
const HALF_EXTENT_M = 128_000;

export type RadolanFrame = {
  url: string;
  frame_time_iso: string;
  bbox_3857: [number, number, number, number];
};

export function radolanFrameForReport(args: {
  lon: number;
  lat: number;
  captured_at: string;
}): RadolanFrame {
  const [x, y] = toMercator(args.lon, args.lat);
  const bbox: [number, number, number, number] = [
    x - HALF_EXTENT_M,
    y - HALF_EXTENT_M,
    x + HALF_EXTENT_M,
    y + HALF_EXTENT_M,
  ];
  const frameTime = floorToFiveMinutes(new Date(args.captured_at));
  const params = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    layers: LAYER,
    styles: "",
    format: "image/png",
    transparent: "false",
    version: "1.1.1",
    srs: "EPSG:3857",
    bbox: bbox.join(","),
    width: "512",
    height: "512",
    time: frameTime.toISOString(),
  });
  return {
    url: `${DWD_WMS}?${params.toString()}`,
    frame_time_iso: frameTime.toISOString(),
    bbox_3857: bbox,
  };
}

function toMercator(lon: number, lat: number): [number, number] {
  const R = 20037508.34 / 180;
  const x = lon * R;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * R;
  return [x, y];
}

function floorToFiveMinutes(d: Date): Date {
  const ms = d.getTime();
  const fiveMin = 5 * 60 * 1000;
  return new Date(Math.floor(ms / fiveMin) * fiveMin);
}
