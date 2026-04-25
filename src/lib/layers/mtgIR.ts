import type maplibregl from "maplibre-gl";
import type { LayerTime } from "./dwdRadar";
import { supabaseFunctionsUrl } from "../supabase";

// Tiles are served by the mtg-tile edge function, which caches each tile in
// the public mtg-tiles storage bucket. URL is content-addressed by the time
// bucket so browser + CDN caches dedupe across viewers and pans.

const MTG_IR_BUCKET_MS = 10 * 60 * 1000;

export function mtgIRTileUrl(time: LayerTime): string {
  const t = time === "live" ? new Date() : time;
  const bucket = floorToBucket(t, MTG_IR_BUCKET_MS);
  return `${supabaseFunctionsUrl}/mtg-tile/ir/{z}/{x}/{y}.png?t=${bucket.toISOString()}`;
}

export function mtgIRSource(time: LayerTime): maplibregl.RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [mtgIRTileUrl(time)],
    tileSize: 512,
    maxzoom: 5,
    attribution: "© EUMETSAT — MTG FCI IR 10.5µm",
  };
}

export const MTG_IR_SOURCE_ID = "mtg-ir";
export const MTG_IR_LAYER_ID = "mtg-ir-layer";

export const mtgIRLayer: maplibregl.RasterLayerSpecification = {
  id: MTG_IR_LAYER_ID,
  type: "raster",
  source: MTG_IR_SOURCE_ID,
  layout: { visibility: "none" },
  paint: { "raster-opacity": 0.45 },
};

export function setMtgIRTime(map: maplibregl.Map, time: LayerTime): void {
  const source = map.getSource(MTG_IR_SOURCE_ID) as
    | (maplibregl.RasterTileSource & { setTiles?: (tiles: string[]) => void })
    | undefined;
  if (source && typeof source.setTiles === "function") {
    source.setTiles([mtgIRTileUrl(time)]);
  }
}

function floorToBucket(d: Date, stepMs: number): Date {
  return new Date(Math.floor(d.getTime() / stepMs) * stepMs);
}
