// VYU design tokens — mirrors VYU-design.html.
// Legacy keys (cone, coneActive, panel, mute, chip, chipBorder, ribbon) are
// preserved as aliases so existing scenes (ConeIllustrative, ConeReceipt,
// WiringGraph, Composition) keep compiling. Visuals shift from amber-cone
// to emerald-cone wholesale — that's the intended consequence of the swap.
export const tokens = {
  // Canvas + surfaces
  bg: "#0f1115",
  surface: "#14171d",
  surfaceRaised: "rgba(255, 255, 255, 0.025)",

  // Ink
  ink: "#e8ecf1",
  inkDim: "rgba(255, 255, 255, 0.55)",
  inkFaint: "rgba(255, 255, 255, 0.35)",

  // Hairlines
  hairline: "rgba(255, 255, 255, 0.08)",
  hairlineStrong: "rgba(255, 255, 255, 0.14)",

  // Signal
  emerald: "#10b981",
  emeraldBright: "#34d399",
  amber: "#f59e0b",
  rose: "#f43f5e",

  // Legacy aliases — kept so prior scenes still compile.
  panel: "#14171d",        // was "#161922"
  mute: "rgba(255, 255, 255, 0.55)",
  cone: "#10b981",         // was amber "#f5c049"
  coneActive: "#34d399",   // was "#fcd970"
  cma: "#34d399",
  ribbon: "#b088ff",
  chip: "#14171d",
  chipBorder: "rgba(255, 255, 255, 0.14)",
} as const;

export const fontStack =
  "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const monoStack =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const radii = {
  pill: 999,
  chip: 999,
  card: 18,
  drawer: 20,
  swatch: 14,
} as const;
