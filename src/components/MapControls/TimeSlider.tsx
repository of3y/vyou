import { useEffect, useState } from "react";
import type { LayerTime } from "../../lib/layers/dwdRadar";

const STEP_MIN = 5;

export type WindowKey = "1h" | "6h" | "24h" | "1w";

const WINDOW_MIN: Record<WindowKey, number> = {
  "1h": 60,
  "6h": 360,
  "24h": 1440,
  "1w": 10080,
};

const WINDOW_LABEL: Record<WindowKey, string> = {
  "1h": "1H",
  "6h": "6H",
  "24h": "24H",
  "1w": "1W",
};

const WINDOW_KEYS: WindowKey[] = ["1h", "6h", "24h", "1w"];

type Props = {
  value: LayerTime;
  onChange: (next: LayerTime) => void;
  windowKey: WindowKey;
  onWindowChange: (next: WindowKey) => void;
  onClose: () => void;
};

export default function TimeSlider({
  value,
  onChange,
  windowKey,
  onWindowChange,
  onClose,
}: Props) {
  const windowMin = WINDOW_MIN[windowKey];
  const sliderStep = windowKey === "1w" ? 30 : windowKey === "24h" ? 15 : STEP_MIN;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Clamp the active time to the new window when window changes.
  useEffect(() => {
    if (value === "live") return;
    const back = (nowMs - value.getTime()) / 60_000;
    if (back > windowMin) onChange(new Date(nowMs - windowMin * 60_000));
  }, [windowMin]);

  const minutesBack =
    value === "live"
      ? 0
      : Math.max(0, Math.min(windowMin, Math.round((nowMs - value.getTime()) / 60_000)));
  const sliderValue = windowMin - minutesBack;

  function handleInput(raw: number) {
    const back = windowMin - raw;
    if (back <= 0) {
      onChange("live");
      return;
    }
    onChange(new Date(nowMs - back * 60_000));
  }

  const label = value === "live" ? "Live" : `${formatTime(value)} · ${formatRelative(minutesBack)}`;

  return (
    <div
      className="absolute inset-x-3 z-20 overflow-hidden rounded-[22px] border border-white/10 bg-[#0f1115]/85 text-white shadow-[0_12px_40px_-10px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <ClockIcon />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Time
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close time controls"
          className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/5 hover:text-white active:scale-95"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pt-1">
        <span className="font-mono text-[13px] tabular-nums text-white">{label}</span>
        <button
          type="button"
          onClick={() => onChange("live")}
          aria-pressed={value === "live"}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
            value === "live"
              ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
              : "bg-white/[0.06] text-white/55 hover:bg-white/[0.1]"
          }`}
        >
          Live
        </button>
      </div>

      <div className="px-4 pt-2">
        <input
          type="range"
          min={0}
          max={windowMin}
          step={sliderStep}
          value={sliderValue}
          onChange={(e) => handleInput(parseInt(e.target.value, 10))}
          className="vyou-time-slider w-full accent-emerald-400"
          aria-label="Time"
        />
      </div>

      <SegmentedWindow value={windowKey} onChange={onWindowChange} />
    </div>
  );
}

function SegmentedWindow({
  value,
  onChange,
}: {
  value: WindowKey;
  onChange: (next: WindowKey) => void;
}) {
  return (
    <div className="px-3 pb-3 pt-1">
      <div
        role="tablist"
        aria-label="Time window"
        className="grid grid-cols-4 gap-1 rounded-full bg-white/[0.05] p-1"
      >
        {WINDOW_KEYS.map((k) => {
          const on = k === value;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(k)}
              className={`rounded-full py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                on ? "bg-white text-black shadow-sm" : "text-white/55 hover:text-white"
              }`}
            >
              {WINDOW_LABEL[k]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/45">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round">
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(min: number): string {
  if (min < 60) return `${min} min ago`;
  if (min < 1440) {
    const h = Math.round(min / 60);
    return `${h}h ago`;
  }
  const d = Math.round(min / 1440);
  return `${d}d ago`;
}
