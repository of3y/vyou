import { useState } from "react";
import { Drawer } from "vaul";
import type { LayerVisibility } from "../MapView";
import { setUnits, useUnits, type SpeedUnit, type TempUnit } from "../../lib/units";

type LayerKey = keyof LayerVisibility;

// Cones are always-on (the core product surface) — they're not user-toggleable.
const LAYERS: {
  key: Exclude<LayerKey, "cones">;
  label: string;
  description: string;
  source: string;
  swatch: string;
}[] = [
  {
    key: "radar",
    label: "Rain & storm radar",
    description: "Live precipitation intensity",
    source: "DWD RADOLAN",
    swatch: "bg-sky-400",
  },
  {
    key: "lightning",
    label: "Lightning strikes",
    description: "Accumulated flash density",
    source: "EUMETSAT MTG · LI",
    swatch: "bg-amber-400",
  },
  {
    key: "ir",
    label: "Cloud cover (infrared)",
    description: "Cloud-top brightness temperature",
    source: "EUMETSAT MTG · 10.5 µm",
    swatch: "bg-violet-400",
  },
];

type Props = {
  visibility: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
};

export default function LayersDrawer({ visibility, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = LAYERS.filter(({ key }) => visibility[key]).length;

  function toggle(key: Exclude<LayerKey, "cones">) {
    onChange({ ...visibility, [key]: !visibility[key] });
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          aria-label="Map layers"
          className="absolute right-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-2 text-xs font-medium text-white/85 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-colors hover:bg-black/65 active:scale-[0.98]"
          style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
        >
          <LayersIcon />
          <span>Layers</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/70">
            {activeCount}
          </span>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#1a1c22]/70 text-white outline-none backdrop-blur-2xl"
        >
          <div className="no-scrollbar relative flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-center pt-2.5 pb-2">
              <Drawer.Handle className="!h-1 !w-10 !rounded-full !bg-white/20" />
            </div>
            <Drawer.Title className="px-6 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Map layers
            </Drawer.Title>
            <Drawer.Description className="px-6 pb-4 pt-1 text-sm text-white/55">
              Choose what to overlay on the map.
            </Drawer.Description>
            <ul
              className="flex flex-col gap-1 px-3"
            >
              {LAYERS.map(({ key, label, description, source, swatch }) => {
              const on = visibility[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={`group flex w-full items-start gap-4 rounded-2xl px-3 py-3 text-left transition-colors ${
                      on ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                    }`}
                    aria-pressed={on}
                  >
                    <span
                      aria-hidden
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${swatch} ${
                        on ? "opacity-100" : "opacity-30"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-white">{label}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-white/55">
                        {description}
                      </span>
                      <span className="mt-1 block text-[11px] uppercase tracking-wider text-white/30">
                        {source}
                      </span>
                    </span>
                    <Toggle on={on} />
                  </button>
                </li>
              );
            })}
            </ul>

            <UnitsSection />
            <div style={{ height: "calc(1.25rem + env(safe-area-inset-bottom))" }} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function UnitsSection() {
  const units = useUnits();
  return (
    <div className="mt-4 px-3">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        Display units
      </p>
      <div className="space-y-2">
        <SegmentedRow
          label="Temperature"
          options={[
            { value: "c", label: "°C" },
            { value: "f", label: "°F" },
          ]}
          value={units.temp}
          onChange={(v) => setUnits({ temp: v as TempUnit })}
        />
        <SegmentedRow
          label="Wind speed"
          options={[
            { value: "kmh", label: "km/h" },
            { value: "mph", label: "mph" },
          ]}
          value={units.speed}
          onChange={(v) => setUnits({ speed: v as SpeedUnit })}
        />
      </div>
    </div>
  );
}

function SegmentedRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <span className="text-[14px] text-white/80">{label}</span>
      <div className="inline-flex rounded-full bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`min-w-[52px] rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                active ? "bg-white text-black shadow" : "text-white/70 hover:text-white"
              }`}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-1 inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-emerald-500" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-[22px] w-[22px] rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function LayersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 1.5 1.5 5 8 8.5 14.5 5 8 1.5Z" />
      <path d="M1.5 8 8 11.5 14.5 8" />
      <path d="M1.5 11 8 14.5 14.5 11" />
    </svg>
  );
}
