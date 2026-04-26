import type { LayerVisibility } from "../components/MapView";
import type { WindowKey } from "../components/MapControls/TimeSlider";

const KEY = "vyou.mapPrefs.v1";
const VALID_WINDOWS: readonly WindowKey[] = ["1h", "6h", "24h", "1w"] as const;

export type MapPrefs = {
  windowKey: WindowKey;
  visibility: LayerVisibility;
};

export const DEFAULT_PREFS: MapPrefs = {
  windowKey: "6h",
  visibility: { cones: true, radar: false, lightning: false, ir: false },
};

// Persisted across navigation so returning to the map doesn't snap settings
// back to defaults. currentTime is intentionally NOT persisted — "live" is
// always the right default on a fresh map view; users who want a historical
// scrub re-engage time-mode each time. Storage failures (private mode,
// quota) fall through to defaults rather than throw.
export function loadPrefs(): MapPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<MapPrefs>;
    return {
      windowKey: VALID_WINDOWS.includes(parsed.windowKey as WindowKey)
        ? (parsed.windowKey as WindowKey)
        : DEFAULT_PREFS.windowKey,
      visibility: {
        cones: typeof parsed.visibility?.cones === "boolean" ? parsed.visibility.cones : DEFAULT_PREFS.visibility.cones,
        radar: typeof parsed.visibility?.radar === "boolean" ? parsed.visibility.radar : DEFAULT_PREFS.visibility.radar,
        lightning: typeof parsed.visibility?.lightning === "boolean" ? parsed.visibility.lightning : DEFAULT_PREFS.visibility.lightning,
        ir: typeof parsed.visibility?.ir === "boolean" ? parsed.visibility.ir : DEFAULT_PREFS.visibility.ir,
      },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: MapPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Quota or private-mode block — silently drop.
  }
}
