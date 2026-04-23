import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

const MUNICH: [number, number] = [11.5820, 48.1351];

type Props = {
  center?: [number, number];
  zoom?: number;
  className?: string;
};

export default function MapView({ center = MUNICH, zoom = 9, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
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
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
