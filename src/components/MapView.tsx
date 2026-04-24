import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";
import { supabase } from "../lib/supabase";
import { coneFeature } from "../lib/cone";

const MUNICH: [number, number] = [11.582, 48.1351];

type Props = {
  center?: [number, number];
  zoom?: number;
  className?: string;
};

type ReportRow = {
  id: string;
  lon: number;
  lat: number;
  heading_degrees: number;
  status: string;
};

async function fetchConeFeatures(): Promise<FeatureCollection<Polygon>> {
  const { data, error } = await supabase
    .from("reports_v")
    .select("id, lon, lat, heading_degrees, status")
    .in("status", ["accepted", "pending"])
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[VYou] fetch reports failed", error);
    return { type: "FeatureCollection", features: [] };
  }

  const features = (data as ReportRow[]).map((r) =>
    coneFeature(r.lon, r.lat, r.heading_degrees, {
      properties: { id: r.id, status: r.status },
    }),
  );
  return { type: "FeatureCollection", features };
}

export default function MapView({ center, zoom, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialCenter = useRef(center ?? MUNICH);
  const initialZoom = useRef(zoom ?? 9);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
          radolan: {
            type: "raster",
            tiles: [
              "https://maps.dwd.de/geoserver/dwd/wms?service=WMS&request=GetMap&layers=dwd:Niederschlagsradar&styles=&format=image/png&transparent=true&version=1.1.1&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256",
            ],
            tileSize: 256,
            attribution: "© DWD RADOLAN",
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
          { id: "radolan", type: "raster", source: "radolan", paint: { "raster-opacity": 0.55 } },
        ],
      },
      center: initialCenter.current,
      zoom: initialZoom.current,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      "top-right",
    );
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", async () => {
      map.addSource("report-cones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "report-cones-fill",
        type: "fill",
        source: "report-cones",
        paint: {
          "fill-color": "#10b981",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "report-cones-outline",
        type: "line",
        source: "report-cones",
        paint: {
          "line-color": "#10b981",
          "line-width": 1.5,
          "line-opacity": 0.8,
        },
      });

      const features = await fetchConeFeatures();
      const source = map.getSource("report-cones") as maplibregl.GeoJSONSource | undefined;
      source?.setData(features);
    });

    mapRef.current = map;

    return () => {
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

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
