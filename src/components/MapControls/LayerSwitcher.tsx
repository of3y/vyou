import type { LayerVisibility } from "../MapView";

type LayerKey = keyof LayerVisibility;

const LAYERS: { key: LayerKey; label: string; icon: string; hint: string }[] = [
  { key: "cones", label: "Cones", icon: "▲", hint: "Submitted view directions" },
  { key: "radar", label: "DWD radar", icon: "◉", hint: "Precipitation, RADOLAN" },
  { key: "lightning", label: "MTG Lightning", icon: "⚡", hint: "Accumulated flash area" },
  { key: "ir", label: "MTG IR cloud", icon: "☁", hint: "10.5 µm brightness temp" },
];

type Props = {
  visibility: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
};

export default function LayerSwitcher({ visibility, onChange }: Props) {
  function toggle(key: LayerKey) {
    onChange({ ...visibility, [key]: !visibility[key] });
  }
  return (
    <div
      className="absolute right-3 z-20 flex w-44 flex-col gap-1 rounded-xl border border-white/10 bg-black/70 p-2 text-xs text-white/90 shadow-lg backdrop-blur"
      style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
    >
      <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-white/40">Layers</p>
      {LAYERS.map(({ key, label, icon, hint }) => {
        const on = visibility[key];
        return (
          <label
            key={key}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
              on ? "bg-white/10" : "hover:bg-white/5"
            }`}
            title={hint}
          >
            <span aria-hidden className="w-4 text-center text-sm">
              {icon}
            </span>
            <span className="flex-1 truncate">{label}</span>
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-400"
              checked={on}
              onChange={() => toggle(key)}
            />
          </label>
        );
      })}
    </div>
  );
}
