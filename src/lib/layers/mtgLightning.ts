import type maplibregl from "maplibre-gl";
import type { LayerTime } from "./dwdRadar";

const EUMETVIEW_BASE =
  "https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetMap" +
  "&format=image/png&transparent=true&version=1.1.1&srs=EPSG:3857" +
  "&bbox={bbox-epsg-3857}&width=256&height=256&layers=mtg_fd:li_afa&styles=";

const MTG_LIGHTNING_BUCKET_MS = 5 * 60 * 1000;

export function mtgLightningTileUrl(time: LayerTime): string {
  const t = time === "live" ? new Date() : time;
  const bucket = floorToBucket(t, MTG_LIGHTNING_BUCKET_MS);
  return `${EUMETVIEW_BASE}&time=${bucket.toISOString()}`;
}

export function mtgLightningSource(
  time: LayerTime,
): maplibregl.RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [mtgLightningTileUrl(time)],
    tileSize: 256,
    attribution: "© EUMETSAT — MTG LI Accumulated Flash Area",
  };
}

export const MTG_LIGHTNING_SOURCE_ID = "mtg-lightning";
export const MTG_LIGHTNING_LAYER_ID = "mtg-lightning-layer";

export const mtgLightningLayer: maplibregl.RasterLayerSpecification = {
  id: MTG_LIGHTNING_LAYER_ID,
  type: "raster",
  source: MTG_LIGHTNING_SOURCE_ID,
  paint: { "raster-opacity": 0.8 },
};

export function setMtgLightningTime(map: maplibregl.Map, time: LayerTime): void {
  const source = map.getSource(MTG_LIGHTNING_SOURCE_ID) as
    | (maplibregl.RasterTileSource & { setTiles?: (tiles: string[]) => void })
    | undefined;
  if (source && typeof source.setTiles === "function") {
    source.setTiles([mtgLightningTileUrl(time)]);
  }
}

function floorToBucket(d: Date, stepMs: number): Date {
  return new Date(Math.floor(d.getTime() / stepMs) * stepMs);
}
