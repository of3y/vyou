import { useEffect, useState } from "react";
import { fetchWeatherAt, type WeatherSnapshot } from "../lib/weather";
import { formatSpeed, formatTemp, useUnits } from "../lib/units";

type Props = {
  lat: number;
  lon: number;
  capturedAt: string;
};

export default function WeatherChip({ lat, lon, capturedAt }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const units = useUnits();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWeatherAt({ lat, lon, capturedAt }).then((s) => {
      if (cancelled) return;
      setSnap(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon, capturedAt]);

  if (loading) {
    return (
      <div className="mt-3 inline-flex items-center gap-2.5 rounded-full bg-white/[0.05] px-3 py-1.5 ring-1 ring-white/[0.06]">
        <span className="h-5 w-5 animate-pulse rounded-full bg-white/15" />
        <span className="h-3 w-10 animate-pulse rounded bg-white/10" />
        <span className="h-3 w-px bg-white/10" />
        <span className="h-3 w-14 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  if (!snap) return null;

  return (
    <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-white/[0.05] px-3 py-1.5 text-[13px] text-white/85 ring-1 ring-white/[0.06]">
      <WeatherIcon code={snap.weather_code} isDay={snap.is_day} />
      <span className="font-medium tabular-nums text-white">
        {formatTemp(snap.temperature_c, units.temp)}
      </span>
      <span className="h-3 w-px bg-white/15" aria-hidden />
      <span className="inline-flex items-center gap-1.5 tabular-nums text-white/80">
        <WindIcon />
        {formatSpeed(snap.wind_kmh, units.speed)}
      </span>
    </div>
  );
}

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  const kind = classifyCode(code, isDay);
  switch (kind) {
    case "sun":
      return <SunIcon />;
    case "moon":
      return <MoonIcon />;
    case "partly-day":
      return <PartlyCloudyIcon variant="day" />;
    case "partly-night":
      return <PartlyCloudyIcon variant="night" />;
    case "cloud":
      return <CloudIcon />;
    case "fog":
      return <FogIcon />;
    case "drizzle":
      return <RainIcon density="light" />;
    case "rain":
      return <RainIcon density="heavy" />;
    case "snow":
      return <SnowIcon />;
    case "thunder":
      return <ThunderIcon />;
    default:
      return <CloudIcon />;
  }
}

type IconKind =
  | "sun"
  | "moon"
  | "partly-day"
  | "partly-night"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

function classifyCode(code: number, isDay: boolean): IconKind {
  if (code === 0) return isDay ? "sun" : "moon";
  if (code === 1 || code === 2) return isDay ? "partly-day" : "partly-night";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 57)) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "cloud";
}

const ICON_SIZE = "h-7 w-7";

function SunIcon() {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <radialGradient id="vyou-sun" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="60%" stopColor="#FFB347" />
          <stop offset="100%" stopColor="#FF8A3D" />
        </radialGradient>
      </defs>
      <g stroke="#FFD27A" strokeWidth="1.6" strokeLinecap="round">
        <line x1="16" y1="3.5" x2="16" y2="7" />
        <line x1="16" y1="25" x2="16" y2="28.5" />
        <line x1="3.5" y1="16" x2="7" y2="16" />
        <line x1="25" y1="16" x2="28.5" y2="16" />
        <line x1="7.2" y1="7.2" x2="9.6" y2="9.6" />
        <line x1="22.4" y1="22.4" x2="24.8" y2="24.8" />
        <line x1="7.2" y1="24.8" x2="9.6" y2="22.4" />
        <line x1="22.4" y1="9.6" x2="24.8" y2="7.2" />
      </g>
      <circle cx="16" cy="16" r="6.5" fill="url(#vyou-sun)" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <linearGradient id="vyou-moon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0E7FF" />
          <stop offset="100%" stopColor="#A5B4FC" />
        </linearGradient>
      </defs>
      <path
        d="M21 6.2A10 10 0 1 0 25.8 21 8 8 0 0 1 21 6.2Z"
        fill="url(#vyou-moon)"
        stroke="#C7D2FE"
        strokeWidth="0.8"
      />
      <circle cx="9" cy="6" r="0.8" fill="#E0E7FF" />
      <circle cx="6.5" cy="11" r="0.5" fill="#E0E7FF" />
      <circle cx="26" cy="9" r="0.5" fill="#E0E7FF" />
    </svg>
  );
}

function PartlyCloudyIcon({ variant }: { variant: "day" | "night" }) {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <radialGradient id={`vyou-pc-orb-${variant}`} cx="50%" cy="50%" r="55%">
          {variant === "day" ? (
            <>
              <stop offset="0%" stopColor="#FFE08A" />
              <stop offset="100%" stopColor="#FFB347" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#E0E7FF" />
              <stop offset="100%" stopColor="#A5B4FC" />
            </>
          )}
        </radialGradient>
        <linearGradient id={`vyou-pc-cloud-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5F7FA" />
          <stop offset="100%" stopColor="#9AA8C2" />
        </linearGradient>
      </defs>
      {variant === "day" ? (
        <circle cx="11" cy="11" r="5.2" fill={`url(#vyou-pc-orb-${variant})`} />
      ) : (
        <path
          d="M14 5.5A6.5 6.5 0 1 0 17.5 16 5.4 5.4 0 0 1 14 5.5Z"
          fill={`url(#vyou-pc-orb-${variant})`}
        />
      )}
      <path
        d="M11.5 22.5a4.2 4.2 0 0 1 .5-8.4 5.6 5.6 0 0 1 10.7 1.4 3.7 3.7 0 0 1-.7 7Z"
        fill={`url(#vyou-pc-cloud-${variant})`}
        stroke="#CBD5E1"
        strokeWidth="0.6"
      />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <linearGradient id="vyou-cloud" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5F7FA" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <path
        d="M9.5 23.5a5 5 0 0 1 .8-9.95 6.6 6.6 0 0 1 12.6 1.65 4.4 4.4 0 0 1-.9 8.3Z"
        fill="url(#vyou-cloud)"
        stroke="#CBD5E1"
        strokeWidth="0.6"
      />
    </svg>
  );
}

function FogIcon() {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <linearGradient id="vyou-fog" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5F7FA" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <path
        d="M9.5 19.5a5 5 0 0 1 .8-9.95 6.6 6.6 0 0 1 12.6 1.65 4.4 4.4 0 0 1-.9 8.3Z"
        fill="url(#vyou-fog)"
        stroke="#CBD5E1"
        strokeWidth="0.6"
      />
      <g stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round">
        <line x1="6" y1="23.5" x2="22" y2="23.5" />
        <line x1="9" y1="27" x2="26" y2="27" />
      </g>
    </svg>
  );
}

function RainIcon({ density }: { density: "light" | "heavy" }) {
  const drops = density === "heavy" ? 4 : 2;
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <linearGradient id={`vyou-rain-cloud-${density}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E5EDF7" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id={`vyou-rain-drop-${density}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <path
        d="M9.5 19.5a5 5 0 0 1 .8-9.95 6.6 6.6 0 0 1 12.6 1.65 4.4 4.4 0 0 1-.9 8.3Z"
        fill={`url(#vyou-rain-cloud-${density})`}
        stroke="#94A3B8"
        strokeWidth="0.6"
      />
      <g stroke={`url(#vyou-rain-drop-${density})`} strokeWidth="2" strokeLinecap="round">
        {Array.from({ length: drops }).map((_, i) => {
          const x = 10.5 + i * (drops > 2 ? 3.5 : 5);
          return <line key={i} x1={x} y1="22" x2={x - 1.4} y2="27" />;
        })}
      </g>
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <linearGradient id="vyou-snow-cloud" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5F7FA" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      <path
        d="M9.5 19.5a5 5 0 0 1 .8-9.95 6.6 6.6 0 0 1 12.6 1.65 4.4 4.4 0 0 1-.9 8.3Z"
        fill="url(#vyou-snow-cloud)"
        stroke="#CBD5E1"
        strokeWidth="0.6"
      />
      <g fill="#E0F2FE">
        <circle cx="11" cy="24.5" r="1.1" />
        <circle cx="16" cy="27" r="1.1" />
        <circle cx="21" cy="24.5" r="1.1" />
      </g>
    </svg>
  );
}

function ThunderIcon() {
  return (
    <svg viewBox="0 0 32 32" className={ICON_SIZE} aria-hidden>
      <defs>
        <linearGradient id="vyou-thunder-cloud" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="vyou-thunder-bolt" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M9.5 19.5a5 5 0 0 1 .8-9.95 6.6 6.6 0 0 1 12.6 1.65 4.4 4.4 0 0 1-.9 8.3Z"
        fill="url(#vyou-thunder-cloud)"
        stroke="#64748B"
        strokeWidth="0.6"
      />
      <path
        d="M16 19 L13 25 L16 25 L14 29 L20 22 L17 22 L19 19 Z"
        fill="url(#vyou-thunder-bolt)"
        stroke="#B45309"
        strokeWidth="0.4"
      />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 6h7.5a2 2 0 1 0-2-2" />
      <path d="M2 10h10.5a2.2 2.2 0 1 1-2.2 2.2" />
      <path d="M2 8h5" />
    </svg>
  );
}
