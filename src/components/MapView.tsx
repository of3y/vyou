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

// Display window scales with the time picker (1H / 6H / 24H / 1W). Fetch
// lookback covers the longest window so window changes don't require a refetch.
const DEFAULT_WINDOW_MS = 6 * 60 * 60 * 1000;
const CONE_FETCH_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

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
  radar: false,
  lightning: false,
  ir: false,
};

type Props = {
  center?: [number, number];
  zoom?: number;
  className?: string;
  currentTime?: LayerTime;
  layerVisibility?: LayerVisibility;
  onConeClick?: (reportId: string) => void;
  onBackgroundClick?: () => void;
  activeReportId?: string | null;
  windowMs?: number;
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

function filterCones(
  features: TimedConeFeature[],
  time: LayerTime,
  windowMs: number,
): FeatureCollection<Polygon> {
  const upper = time === "live" ? Date.now() : time.getTime();
  const lower = upper - windowMs;
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
  onConeClick,
  onBackgroundClick,
  activeReportId,
  windowMs,
}: Props) {
  const effectiveWindowMs = windowMs ?? DEFAULT_WINDOW_MS;
  const onConeClickRef = useRef(onConeClick);
  onConeClickRef.current = onConeClick;
  const onBackgroundClickRef = useRef(onBackgroundClick);
  onBackgroundClickRef.current = onBackgroundClick;
  const activeFidRef = useRef<string | number | null>(null);
  const setActiveRef = useRef<((fid: string | number | null) => void) | null>(null);
  const dimmedFidsRef = useRef<Set<string | number>>(new Set());
  const savedCameraRef = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);
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
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

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
        generateId: true,
      });

      map.addLayer({
        id: CONE_FILL_LAYER_ID,
        type: "fill",
        source: CONE_SOURCE_ID,
        layout: { visibility: visibilityValue(visibility.cones) },
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "dimmed"], false], "#64748b",
            "#34d399",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "active"], false], 0.55,
            ["boolean", ["feature-state", "hover"], false], 0.4,
            ["boolean", ["feature-state", "dimmed"], false], 0.06,
            0.22,
          ],
        },
      });
      map.addLayer({
        id: CONE_OUTLINE_LAYER_ID,
        type: "line",
        source: CONE_SOURCE_ID,
        layout: { visibility: visibilityValue(visibility.cones) },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "active"], false], "#a7f3d0",
            ["boolean", ["feature-state", "dimmed"], false], "#475569",
            "#34d399",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "active"], false], 2.5,
            ["boolean", ["feature-state", "hover"], false], 2,
            ["boolean", ["feature-state", "dimmed"], false], 0.75,
            1.25,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "active"], false], 1,
            ["boolean", ["feature-state", "hover"], false], 1,
            ["boolean", ["feature-state", "dimmed"], false], 0.4,
            0.9,
          ],
        },
      });

      conesRef.current = await fetchConeFeatures();
      const source = map.getSource(CONE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(filterCones(conesRef.current, time, effectiveWindowMs));
      loadedRef.current = true;

      let hoverFid: string | number | null = null;
      const setHover = (fid: string | number | null) => {
        if (hoverFid === fid) return;
        if (hoverFid !== null) {
          map.setFeatureState({ source: CONE_SOURCE_ID, id: hoverFid }, { hover: false });
        }
        hoverFid = fid;
        if (fid !== null) {
          map.setFeatureState({ source: CONE_SOURCE_ID, id: fid }, { hover: true });
        }
      };

      const dimOthers = (activeFid: string | number) => {
        const features = map.querySourceFeatures(CONE_SOURCE_ID);
        const next = new Set<string | number>();
        for (const f of features) {
          if (f.id === undefined || f.id === activeFid) continue;
          map.setFeatureState({ source: CONE_SOURCE_ID, id: f.id }, { dimmed: true });
          next.add(f.id);
        }
        dimmedFidsRef.current = next;
      };
      const clearDimmed = () => {
        for (const fid of dimmedFidsRef.current) {
          map.setFeatureState({ source: CONE_SOURCE_ID, id: fid }, { dimmed: false });
        }
        dimmedFidsRef.current.clear();
      };

      const setActive = (fid: string | number | null) => {
        if (activeFidRef.current === fid) return;
        if (activeFidRef.current !== null) {
          map.setFeatureState({ source: CONE_SOURCE_ID, id: activeFidRef.current }, { active: false });
        }
        activeFidRef.current = fid;
        if (fid !== null) {
          map.setFeatureState({ source: CONE_SOURCE_ID, id: fid }, { active: true });
          dimOthers(fid);
        } else {
          clearDimmed();
        }
      };
      setActiveRef.current = setActive;

      const handleConeClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        const id = f?.properties?.id;
        const fid = f?.id;
        if (typeof id !== "string") return;
        if (fid !== undefined) setActive(fid);

        // Stash the previous camera so closing the drawer restores the view.
        if (!savedCameraRef.current) {
          savedCameraRef.current = {
            center: map.getCenter().toArray() as [number, number],
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
          };
        }

        // Frame the cone polygon in the upper half of the viewport — push it
        // up by padding the bottom by the drawer height (50vh).
        const geom = f?.geometry;
        if (geom && geom.type === "Polygon") {
          const ring = geom.coordinates[0] as [number, number][];
          let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
          for (const [lng, lat] of ring) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
          const drawerH = Math.round(window.innerHeight * 0.5);
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            {
              padding: { top: 96, right: 64, bottom: drawerH + 48, left: 64 },
              duration: 750,
              maxZoom: 13.5,
              essential: true,
            },
          );
        }

        onConeClickRef.current?.(id);
      };
      map.on("click", CONE_FILL_LAYER_ID, handleConeClick);
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: [CONE_FILL_LAYER_ID] });
        if (hits.length === 0) onBackgroundClickRef.current?.();
      });
      map.on("mousemove", CONE_FILL_LAYER_ID, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const fid = e.features?.[0]?.id;
        if (fid !== undefined) setHover(fid);
      });
      map.on("mouseleave", CONE_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        setHover(null);
      });
    });

    mapRef.current = map;

    // MapLibre only auto-resizes on window resize. Vaul opening/closing the
    // drawer (and any other layout shift around the map container) does not
    // fire a window resize, so the canvas stays at its stale dimensions and
    // the map collapses to a small square. ResizeObserver fixes that.
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(containerRef.current!);

    return () => {
      ro.disconnect();
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

  // Lock map gestures while a cone is selected. Tap-to-select another cone
  // still works (clicks aren't affected), but pan/zoom/pitch/rotate gestures
  // are inert so the drawer interaction can't be undermined by accidental
  // map drags.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (activeReportId) {
        map.dragPan.disable();
        map.dragRotate.disable();
        map.touchZoomRotate.disable();
        map.touchPitch.disable();
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
      } else {
        map.dragPan.enable();
        map.dragRotate.enable();
        map.touchZoomRotate.enable();
        map.touchPitch.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
      }
    };
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [activeReportId]);

  // Sync active highlight from the parent. Resolves the report id to the
  // generated feature id by scanning rendered features on the cone layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !setActiveRef.current) return;
    if (!activeReportId) {
      setActiveRef.current(null);
      // Restore the camera the user had before tapping a cone.
      const saved = savedCameraRef.current;
      if (saved) {
        map.easeTo({
          center: saved.center,
          zoom: saved.zoom,
          bearing: saved.bearing,
          pitch: saved.pitch,
          duration: 600,
          essential: true,
        });
        savedCameraRef.current = null;
      }
      return;
    }
    const apply = () => {
      if (!map.getLayer(CONE_FILL_LAYER_ID)) return;
      const features = map.querySourceFeatures(CONE_SOURCE_ID);
      const match = features.find((f) => (f.properties as { id?: string } | null)?.id === activeReportId);
      if (match?.id !== undefined) setActiveRef.current?.(match.id);
    };
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [activeReportId]);

  // Push time changes to all time-indexed layers + cone filter.
  const timeKey = time === "live" ? "live" : time.toISOString();
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    setDwdRadarTime(map, time);
    setMtgIRTime(map, time);
    setMtgLightningTime(map, time);
    const source = map.getSource(CONE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(filterCones(conesRef.current, time, effectiveWindowMs));
  }, [timeKey, effectiveWindowMs]);

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
