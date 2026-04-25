import { useEffect, useState } from "react";
import type { LayerTime } from "../../lib/layers/dwdRadar";

const WINDOW_MIN = 120;
const STEP_MIN = 5;

type Props = {
  value: LayerTime;
  onChange: (next: LayerTime) => void;
};

export default function TimeSlider({ value, onChange }: Props) {
  // Anchor "now" so the slider position is stable between drags. Refresh once
  // a minute so the live label stays honest and the relative-time math (e.g.
  // "20 min ago") tracks the wall clock.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const minutesBack =
    value === "live"
      ? 0
      : Math.max(0, Math.min(WINDOW_MIN, Math.round((nowMs - value.getTime()) / 60_000)));

  // Slider is inverted: right = 0 (now/live), left = 120 (2h ago). We render
  // value = WINDOW_MIN - minutesBack so dragging right moves toward live.
  const sliderValue = WINDOW_MIN - minutesBack;

  function handleInput(raw: number) {
    const back = WINDOW_MIN - raw;
    if (back <= 0) {
      onChange("live");
      return;
    }
    const t = new Date(nowMs - back * 60_000);
    onChange(t);
  }

  const label =
    value === "live"
      ? "Live"
      : `${formatTime(value)}  ·  ${minutesBack} min ago`;

  return (
    <div
      className="absolute inset-x-3 z-20 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-white/90 shadow-lg backdrop-blur"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Time</span>
        <span className="font-mono tabular-nums">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/40">−2h</span>
        <input
          type="range"
          min={0}
          max={WINDOW_MIN}
          step={STEP_MIN}
          value={sliderValue}
          onChange={(e) => handleInput(parseInt(e.target.value, 10))}
          className="vyou-time-slider flex-1 accent-emerald-400"
          aria-label="Time"
        />
        <button
          type="button"
          onClick={() => onChange("live")}
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 transition-colors ${
            value === "live"
              ? "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40"
              : "bg-white/5 text-white/60 ring-white/10 hover:bg-white/10"
          }`}
        >
          Live
        </button>
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
