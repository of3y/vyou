import type { Feature, Polygon } from "geojson";

const EARTH_RADIUS_KM = 6371;

function destination(lon: number, lat: number, bearingDeg: number, distanceKm: number): [number, number] {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );

  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI];
}

export function coneFeature(
  lon: number,
  lat: number,
  headingDeg: number,
  opts: { spreadDeg?: number; rangeKm?: number; steps?: number; properties?: Record<string, unknown> } = {},
): Feature<Polygon> {
  const spread = opts.spreadDeg ?? 30;
  const range = opts.rangeKm ?? 10;
  const steps = opts.steps ?? 12;

  const half = spread / 2;
  const arc: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = headingDeg - half + (spread * i) / steps;
    arc.push(destination(lon, lat, bearing, range));
  }

  const ring: [number, number][] = [[lon, lat], ...arc, [lon, lat]];

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: opts.properties ?? {},
  };
}
