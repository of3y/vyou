import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { listReports } from "../lib/api";
import { coneFeature } from "../lib/cone";
import {
  DWD_RADAR_LAYER_ID,
  DWD_RADAR_SOURCE_ID,
  dwdRadarLayer,
  dwdRadarSource,
  setDwdRadarTime,
  type LayerTime,
} from "../lib/layers/dwdRadar";
import {
  MTG_IR_LAYER_ID,
  MTG_IR_SOURCE_ID,
  mtgIRLayer,
  mtgIRSource,
  setMtgIRTime,
} from "../lib/layers/mtgIR";
import {
  MTG_LIGHTNING_LAYER_ID,
  MTG_LIGHTNING_SOURCE_ID,
  mtgLightningLayer,
  mtgLightningSource,
  setMtgLightningTime,
} from "../lib/layers/mtgLightning";

const MUNICH: [number, number] = [11.582, 48.1351];

const CONE_WINDOW_MS = 2 * 60 * 60 * 1000;
const CONE_FETCH_LOOKBACK_MS = 4 * 60 * 60 * 1000;

const CONE_FILL_LAYER_ID = "report-cones-fill";
const CONE_OUTLINE_LAYER_ID = "report-cones-outline";
const CONE_SOURCE_ID = "report-cones";

const BASEMAP_SOURCE_ID = "carto-dark";
const BASEMAP_LAYER_ID = "carto-dark-layer";

export type LayerVisibility = {
  cones: boolean;
  radar: boolean;
  lightning: boolean;
  ir: boolean;
};

const DEFAULT_VISIBILITY: LayerVisibility = {
  cones: true,
  radar: true,
  lightning: false,
  ir: false,
};

type Props = {
  center?: [number, number];
  zoom?: number;
  className?: string;
  currentTime?: LayerTime;
  layerVisibility?: LayerVisibility;
};

type ReportRow = {
  id: string;
  lon: number;
  lat: number;
  heading_degrees: number;
  status: string;
  captured_at: string;
};

type TimedConeFeature = Feature<Polygon, { id: string; status: string; captured_at: number }>;

async function fetchConeFeatures(): Promise<TimedConeFeature[]> {
  const { data, error } = await listReports({
    since_ms: CONE_FETCH_LOOKBACK_MS,
    limit: 500,
  });

  if (error || !data) {
    console.error("[VYou] fetch reports failed", error);
    return [];
  }

  return data.reports
    .filter((r) => r.status === "accepted" || r.status === "pending")
    .map((r) => {
      const row: ReportRow = {
        id: r.id,
        lon: r.lon,
        lat: r.lat,
        heading_degrees: r.heading_degrees,
        status: r.status,
        captured_at: r.captured_at,
      };
      const f = coneFeature(row.lon, row.lat, row.heading_degrees, {
        properties: { id: row.id, status: row.status, captured_at: Date.parse(row.captured_at) },
      });
      return f as TimedConeFeature;
    });
}

function filterCones(features: TimedConeFeature[], time: LayerTime): FeatureCollection<Polygon> {
  const upper = time === "live" ? Date.now() : time.getTime();
  const lower = upper - CONE_WINDOW_MS;
  return {
    type: "FeatureCollection",
    features: features.filter(
      (f) => f.properties.captured_at >= lower && f.properties.captured_at <= upper,
    ),
  };
}

function visibilityValue(on: boolean): "visible" | "none" {
  return on ? "visible" : "none";
}

export default function MapView({
  center,
  zoom,
  className,
  currentTime,
  layerVisibility,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialCenter = useRef(center ?? MUNICH);
  const initialZoom = useRef(zoom ?? 9);
  const conesRef = useRef<TimedConeFeature[]>([]);
  const loadedRef = useRef(false);

  const time: LayerTime = currentTime ?? "live";
  const visibility = useMemo<LayerVisibility>(
    () => layerVisibility ?? DEFAULT_VISIBILITY,
    [layerVisibility],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          [BASEMAP_SOURCE_ID]: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
          },
          [DWD_RADAR_SOURCE_ID]: dwdRadarSource(time),
          [MTG_LIGHTNING_SOURCE_ID]: mtgLightningSource(time),
          [MTG_IR_SOURCE_ID]: mtgIRSource(time),
        },
        layers: [
          { id: BASEMAP_LAYER_ID, type: "raster", source: BASEMAP_SOURCE_ID },
          { ...mtgIRLayer, layout: { visibility: visibilityValue(visibility.ir) } },
          { ...dwdRadarLayer, layout: { visibility: visibilityValue(visibility.radar) } },
          {
            ...mtgLightningLayer,
            layout: { visibility: visibilityValue(visibility.lightning) },
          },
        ],
      },
      center: initialCenter.current,
      zoom: initialZoom.current,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("error", (e) => {
      const url = (e?.error as { url?: string } | undefined)?.url ?? "";
      // mtg-tile proxy returns a fallback PNG on upstream miss, so most
      // errors here are noise. Keep filtering raw EUMETView in case a
      // future layer is wired direct.
      if (url.includes("/functions/v1/mtg-tile/")) return;
      if (url.includes("view.eumetsat.int/geoserver/wms")) return;
      console.error(e?.error ?? e);
    });

    map.on("load", async () => {
      map.addSource(CONE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: CONE_FILL_LAYER_ID,
        type: "fill",
        source: CONE_SOURCE_ID,
        layout: { visibility: visibilityValue(visibility.cones) },
        paint: { "fill-color": "#10b981", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: CONE_OUTLINE_LAYER_ID,
        type: "line",
        source: CONE_SOURCE_ID,
        layout: { visibility: visibilityValue(visibility.cones) },
        paint: { "line-color": "#10b981", "line-width": 1.5, "line-opacity": 0.8 },
      });

      conesRef.current = await fetchConeFeatures();
      const source = map.getSource(CONE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(filterCones(conesRef.current, time));
      loadedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const lon = center?.[0];
  const lat = center?.[1];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lon == null || lat == null) return;
    map.setCenter([lon, lat]);
  }, [lon, lat]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || zoom == null) return;
    map.setZoom(zoom);
  }, [zoom]);

  // Push time changes to all time-indexed layers + cone filter.
  const timeKey = time === "live" ? "live" : time.toISOString();
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    setDwdRadarTime(map, time);
    setMtgIRTime(map, time);
    setMtgLightningTime(map, time);
    const source = map.getSource(CONE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(filterCones(conesRef.current, time));
  }, [timeKey]);

  // Push visibility changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      try {
        map.setLayoutProperty(CONE_FILL_LAYER_ID, "visibility", visibilityValue(visibility.cones));
        map.setLayoutProperty(
          CONE_OUTLINE_LAYER_ID,
          "visibility",
          visibilityValue(visibility.cones),
        );
        map.setLayoutProperty(DWD_RADAR_LAYER_ID, "visibility", visibilityValue(visibility.radar));
        map.setLayoutProperty(
          MTG_LIGHTNING_LAYER_ID,
          "visibility",
          visibilityValue(visibility.lightning),
        );
        map.setLayoutProperty(MTG_IR_LAYER_ID, "visibility", visibilityValue(visibility.ir));
      } catch {
        // Layers may not yet exist if load hasn't fired; the load handler
        // sets initial visibility, so this is safe to ignore.
      }
    };
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [visibility.cones, visibility.radar, visibility.lightning, visibility.ir]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
