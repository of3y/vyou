import type maplibregl from "maplibre-gl";
import type { LayerTime } from "./dwdRadar";
import { supabaseFunctionsUrl } from "../supabase";

const MTG_LIGHTNING_BUCKET_MS = 5 * 60 * 1000;

export function mtgLightningTileUrl(time: LayerTime): string {
  const t = time === "live" ? new Date() : time;
  const bucket = floorToBucket(t, MTG_LIGHTNING_BUCKET_MS);
  return `${supabaseFunctionsUrl}/mtg-tile/lightning/{z}/{x}/{y}.png?t=${bucket.toISOString()}`;
}

export function mtgLightningSource(
  time: LayerTime,
): maplibregl.RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [mtgLightningTileUrl(time)],
    tileSize: 512,
    maxzoom: 4,
    attribution: "© EUMETSAT — MTG LI Accumulated Flash Area",
  };
}

export const MTG_LIGHTNING_SOURCE_ID = "mtg-lightning";
export const MTG_LIGHTNING_LAYER_ID = "mtg-lightning-layer";

export const mtgLightningLayer: maplibregl.RasterLayerSpecification = {
  id: MTG_LIGHTNING_LAYER_ID,
  type: "raster",
  source: MTG_LIGHTNING_SOURCE_ID,
  layout: { visibility: "none" },
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
