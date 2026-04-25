import type maplibregl from "maplibre-gl";

export type LayerTime = Date | "live";

const DWD_WMS_BASE =
  "https://maps.dwd.de/geoserver/dwd/wms?service=WMS&request=GetMap" +
  "&layers=dwd:Niederschlagsradar&styles=&format=image/png&transparent=true" +
  "&version=1.1.1&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256";

const DWD_RADAR_STEP_MS = 5 * 60 * 1000;

export function dwdRadarTileUrl(time: LayerTime): string {
  if (time === "live") return DWD_WMS_BASE;
  const bucket = floorToBucket(time, DWD_RADAR_STEP_MS);
  return `${DWD_WMS_BASE}&time=${bucket.toISOString()}`;
}

export function dwdRadarSource(time: LayerTime): maplibregl.RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [dwdRadarTileUrl(time)],
    tileSize: 256,
    attribution: "© DWD RADOLAN",
  };
}

export const DWD_RADAR_SOURCE_ID = "dwd-radar";
export const DWD_RADAR_LAYER_ID = "dwd-radar-layer";

export const dwdRadarLayer: maplibregl.RasterLayerSpecification = {
  id: DWD_RADAR_LAYER_ID,
  type: "raster",
  source: DWD_RADAR_SOURCE_ID,
  paint: { "raster-opacity": 0.55 },
};

export function setDwdRadarTime(map: maplibregl.Map, time: LayerTime): void {
  const source = map.getSource(DWD_RADAR_SOURCE_ID) as
    | (maplibregl.RasterTileSource & { setTiles?: (tiles: string[]) => void })
    | undefined;
  if (source && typeof source.setTiles === "function") {
    source.setTiles([dwdRadarTileUrl(time)]);
  }
}

function floorToBucket(d: Date, stepMs: number): Date {
  return new Date(Math.floor(d.getTime() / stepMs) * stepMs);
}
