import React from "react";
import { interpolate } from "remotion";
import { tokens, fontStack, monoStack } from "../../../tokens";

// Shared building blocks for the WiringGraph variants. Every primitive takes
// explicit (x, y, width, height) so each variant lays things out on a grid
// the author can reason about — no implicit overlap.

export const fadeIn = (frame: number, start: number, dur = 24) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const lift = (frame: number, start: number, dur = 24, dist = 10) =>
  interpolate(frame, [start, start + dur], [dist, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// ───────── Node ─────────
export type WireNodeProps = {
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  sublabel?: string;
  enterFrame: number;
  frame: number;
  tone?: "primary" | "neutral";
};

export const WireNode: React.FC<WireNodeProps> = ({
  x,
  y,
  width,
  height = 110,
  label,
  sublabel,
  enterFrame,
  frame,
  tone = "primary",
}) => {
  const o = fadeIn(frame, enterFrame);
  const ly = lift(frame, enterFrame);
  const accent = tone === "primary" ? tokens.emerald : tokens.hairlineStrong;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + ly,
        width,
        height,
        background: tokens.surface,
        border: `1.5px solid ${accent}`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: sublabel ? 6 : 0,
        color: tokens.ink,
        fontFamily: fontStack,
        opacity: o,
        boxShadow:
          tone === "primary"
            ? `0 0 32px rgba(16, 185, 129, ${0.18 * o})`
            : "none",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
        {label}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: 12,
            color: tokens.inkFaint,
            fontFamily: monoStack,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};

// ───────── Chip ─────────
export type WireChipProps = {
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  enterFrame: number;
  frame: number;
  tone?: "neutral" | "emerald" | "amber" | "rose" | "ribbon";
  // Optional fly-in: the chip enters from this x and slides to its final x.
  flyFromX?: number;
  monospace?: boolean;
};

export const WireChip: React.FC<WireChipProps> = ({
  x,
  y,
  width,
  height = 32,
  label,
  enterFrame,
  frame,
  tone = "neutral",
  flyFromX,
  monospace = false,
}) => {
  const o = fadeIn(frame, enterFrame, 18);
  const dx =
    flyFromX !== undefined
      ? interpolate(
          frame,
          [enterFrame, enterFrame + 24],
          [flyFromX - x, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 0;

  const palette = (() => {
    switch (tone) {
      case "emerald":
        return {
          bg: "rgba(16, 185, 129, 0.10)",
          border: "rgba(16, 185, 129, 0.35)",
          color: "#a7f3d0",
        };
      case "amber":
        return {
          bg: "rgba(245, 158, 11, 0.10)",
          border: "rgba(245, 158, 11, 0.35)",
          color: "#fde68a",
        };
      case "rose":
        return {
          bg: "rgba(244, 63, 94, 0.10)",
          border: "rgba(244, 63, 94, 0.35)",
          color: "#fecdd3",
        };
      case "ribbon":
        return {
          bg: "rgba(176, 136, 255, 0.13)",
          border: "rgba(176, 136, 255, 0.45)",
          color: "#d4bcff",
        };
      default:
        return {
          bg: "rgba(255, 255, 255, 0.04)",
          border: tokens.hairline,
          color: "rgba(255, 255, 255, 0.82)",
        };
    }
  })();

  return (
    <div
      style={{
        position: "absolute",
        left: x + dx,
        top: y,
        width,
        height,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: palette.color,
        fontFamily: monospace ? monoStack : fontStack,
        fontSize: 13,
        fontWeight: 500,
        opacity: o,
        whiteSpace: "nowrap",
        padding: "0 12px",
      }}
    >
      {label}
    </div>
  );
};

// ───────── Arrow ─────────
export type WireArrowProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  enterFrame: number;
  frame: number;
  duration?: number;
  canvasWidth: number;
  canvasHeight: number;
  // Color tone for the arrow stroke + arrowhead.
  tone?: "emerald" | "ribbon" | "muted";
  strokeWidth?: number;
};

export const WireArrow: React.FC<WireArrowProps> = ({
  x1,
  y1,
  x2,
  y2,
  enterFrame,
  frame,
  duration = 28,
  canvasWidth,
  canvasHeight,
  tone = "emerald",
  strokeWidth = 2,
}) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const dash = interpolate(
    frame,
    [enterFrame, enterFrame + duration],
    [length, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const o = fadeIn(frame, enterFrame, 6);
  const stroke =
    tone === "emerald"
      ? tokens.emerald
      : tone === "ribbon"
        ? tokens.ribbon
        : tokens.hairlineStrong;
  // Unique marker id per arrow.
  const markerId = `arrow-${enterFrame}-${Math.round(x1)}-${Math.round(y1)}-${Math.round(x2)}-${Math.round(y2)}`;
  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      width={canvasWidth}
      height={canvasHeight}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth={10}
          markerHeight={10}
          refX={8}
          refY={5}
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={stroke} opacity={o} />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={length}
        strokeDashoffset={dash}
        opacity={o}
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
};

// ───────── Memory cylinder ─────────
export type WireMemoryCylinderProps = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  enterFrame: number;
  fillStart: number;
  frame: number;
};

export const WireMemoryCylinder: React.FC<WireMemoryCylinderProps> = ({
  x,
  y,
  width = 110,
  height = 140,
  label,
  enterFrame,
  fillStart,
  frame,
}) => {
  const o = fadeIn(frame, enterFrame, 24);
  const fill = interpolate(
    frame,
    [fillStart, fillStart + 240],
    [0, 0.85],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cw = width;
  const ch = height;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: cw,
        opacity: o,
        fontFamily: fontStack,
      }}
    >
      <svg width={cw} height={ch}>
        <ellipse
          cx={cw / 2}
          cy={14}
          rx={cw / 2 - 2}
          ry={12}
          fill={tokens.surface}
          stroke={tokens.ribbon}
          strokeWidth={1.5}
        />
        <rect
          x={2}
          y={14}
          width={cw - 4}
          height={ch - 28}
          fill={tokens.surface}
          stroke={tokens.ribbon}
          strokeWidth={1.5}
        />
        <rect
          x={2}
          y={14 + (ch - 28) * (1 - fill)}
          width={cw - 4}
          height={(ch - 28) * fill}
          fill={tokens.ribbon}
          opacity={0.5}
        />
        <ellipse
          cx={cw / 2}
          cy={ch - 14}
          rx={cw / 2 - 2}
          ry={12}
          fill={tokens.surface}
          stroke={tokens.ribbon}
          strokeWidth={1.5}
        />
      </svg>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: tokens.inkDim,
          textAlign: "center",
          width: cw,
          letterSpacing: 0.1,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ───────── Card ─────────
export type WireCardProps = {
  x: number;
  y: number;
  width: number;
  height?: number;
  enterFrame: number;
  frame: number;
  title: string;
  body?: string;
  chips?: string[];
  toneTitle?: "emerald" | "ribbon" | "neutral";
};

export const WireCard: React.FC<WireCardProps> = ({
  x,
  y,
  width,
  height,
  enterFrame,
  frame,
  title,
  body,
  chips,
  toneTitle = "emerald",
}) => {
  const o = fadeIn(frame, enterFrame, 24);
  const ly = lift(frame, enterFrame, 24, 12);
  const titleColor =
    toneTitle === "emerald"
      ? tokens.emeraldBright
      : toneTitle === "ribbon"
        ? tokens.ribbon
        : tokens.ink;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + ly,
        width,
        minHeight: height,
        background: tokens.surface,
        border: `1px solid ${tokens.hairline}`,
        borderRadius: 14,
        padding: 16,
        opacity: o,
        fontFamily: fontStack,
        color: tokens.ink,
        boxShadow: "0 14px 44px rgba(0, 0, 0, 0.42)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: titleColor,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {body && (
        <div
          style={{
            fontSize: 14,
            color: tokens.ink,
            marginTop: 10,
            lineHeight: 1.5,
            opacity: 0.92,
          }}
        >
          {body}
        </div>
      )}
      {chips && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {chips.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                color: tokens.inkDim,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${tokens.hairline}`,
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ───────── Ribbon ─────────
export type WireRibbonProps = {
  x: number;
  y: number;
  width: number;
  enterFrame: number;
  frame: number;
  label?: string;
};

export const WireRibbon: React.FC<WireRibbonProps> = ({
  x,
  y,
  width,
  enterFrame,
  frame,
  label = "Persists across sessions",
}) => {
  const o = fadeIn(frame, enterFrame, 24);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        padding: "8px 14px",
        background: "rgba(176, 136, 255, 0.13)",
        border: `1px solid ${tokens.ribbon}`,
        borderRadius: 999,
        color: tokens.ribbon,
        fontFamily: fontStack,
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
        opacity: o,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </div>
  );
};

// ───────── Background grid ─────────
export const WireGrid: React.FC<{
  frame: number;
  width: number;
  height: number;
}> = ({ frame, width, height }) => {
  const o = interpolate(frame, [0, 20], [0, 0.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, opacity: o }}
      width={width}
      height={height}
    >
      <defs>
        <pattern id="wgrid" width={60} height={60} patternUnits="userSpaceOnUse">
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke="#ffffff"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#wgrid)" />
    </svg>
  );
};

// ───────── Lane label ─────────
export const WireLaneLabel: React.FC<{
  x: number;
  y: number;
  width: number;
  text: string;
  enterFrame: number;
  frame: number;
}> = ({ x, y, width, text, enterFrame, frame }) => {
  const o = fadeIn(frame, enterFrame, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        textAlign: "center",
        fontFamily: fontStack,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: tokens.inkFaint,
        opacity: o,
      }}
    >
      {text}
    </div>
  );
};
