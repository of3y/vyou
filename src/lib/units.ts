import { useSyncExternalStore } from "react";

export type TempUnit = "c" | "f";
export type SpeedUnit = "kmh" | "mph";

export type UnitPrefs = {
  temp: TempUnit;
  speed: SpeedUnit;
};

const STORAGE_KEY = "vyou.units.v1";
const DEFAULT_PREFS: UnitPrefs = { temp: "c", speed: "kmh" };

function load(): UnitPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UnitPrefs>;
    return {
      temp: parsed.temp === "f" ? "f" : "c",
      speed: parsed.speed === "mph" ? "mph" : "kmh",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

let current: UnitPrefs = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getUnits(): UnitPrefs {
  return current;
}

export function setUnits(next: Partial<UnitPrefs>): void {
  current = { ...current, ...next };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // storage full or disabled — ignore, in-memory state still updates
    }
  }
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useUnits(): UnitPrefs {
  return useSyncExternalStore(subscribe, getUnits, getUnits);
}

export function formatTemp(celsius: number, unit: TempUnit = current.temp): string {
  if (unit === "f") return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

export function formatSpeed(kmh: number, unit: SpeedUnit = current.speed): string {
  if (unit === "mph") return `${Math.round(kmh * 0.621371)} mph`;
  return `${Math.round(kmh)} km/h`;
}
