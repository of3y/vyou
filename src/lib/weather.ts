// Client-side Open-Meteo lookup for the time + location of a cone. Returns
// always in metric units; the unit-preference layer formats for display.

export type WeatherSnapshot = {
  weather_code: number;
  temperature_c: number;
  wind_kmh: number;
  is_day: boolean;
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeatherAt(args: {
  lat: number;
  lon: number;
  capturedAt: string;
}): Promise<WeatherSnapshot | null> {
  const captured = new Date(args.capturedAt);
  if (Number.isNaN(captured.getTime())) return null;

  const ageHours = (Date.now() - captured.getTime()) / 3600000;
  const params = new URLSearchParams({
    latitude: args.lat.toFixed(4),
    longitude: args.lon.toFixed(4),
    timezone: "UTC",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  });

  const fields = "temperature_2m,wind_speed_10m,weather_code,is_day";

  if (ageHours < 1) {
    params.set("current", fields);
  } else {
    params.set("hourly", fields);
    params.set("past_hours", String(Math.min(168, Math.ceil(ageHours) + 1)));
    params.set("forecast_hours", "1");
  }

  try {
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!res.ok) return null;
    const json = await res.json();

    if (ageHours < 1 && json?.current) {
      return {
        weather_code: numberOr(json.current.weather_code, 0),
        temperature_c: numberOr(json.current.temperature_2m, 0),
        wind_kmh: numberOr(json.current.wind_speed_10m, 0),
        is_day: json.current.is_day === 1,
      };
    }

    if (json?.hourly?.time?.length) {
      const times: string[] = json.hourly.time;
      const targetMs = captured.getTime();
      let bestIdx = 0;
      let bestDelta = Infinity;
      for (let i = 0; i < times.length; i++) {
        // Open-Meteo returns ISO strings without the trailing Z when timezone=UTC.
        const t = new Date(`${times[i]}Z`).getTime();
        const delta = Math.abs(t - targetMs);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIdx = i;
        }
      }
      return {
        weather_code: numberOr(json.hourly.weather_code?.[bestIdx], 0),
        temperature_c: numberOr(json.hourly.temperature_2m?.[bestIdx], 0),
        wind_kmh: numberOr(json.hourly.wind_speed_10m?.[bestIdx], 0),
        is_day: json.hourly.is_day?.[bestIdx] === 1,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
