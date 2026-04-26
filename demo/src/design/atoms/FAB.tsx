import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring, pressScale } from "../motion";

export type FABProps = {
  variant?: "ghost" | "primary";
  label?: string;            // text inside primary FAB
  ariaLabel?: string;
  icon?: React.ReactNode;    // svg or any node
  badge?: number | string;   // shown top-right (bell-style)
  delayFrames?: number;
  pressFrame?: number;       // when set, plays a press scale at this frame
  animateIn?: boolean;
};

export const FAB: React.FC<FABProps> = ({
  variant = "ghost",
  label,
  ariaLabel,
  icon,
  badge,
  delayFrames = 0,
  pressFrame,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;
  const enterScale = 0.92 + 0.08 * t;
  const opacity = t;
  const press = pressScale(frame, pressFrame);
  const scale = enterScale * press;

  const isPrimary = variant === "primary";
  const hasLabel = isPrimary && !!label;

  // Badge bounce: 4 frames after the FAB lands.
  const badgeT = enterSpring(frame, fps, delayFrames + 4);

  return (
    <span
      aria-label={ariaLabel}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 52,
        width: hasLabel ? "auto" : 52,
        padding: hasLabel ? "0 22px" : 0,
        borderRadius: 999,
        background: isPrimary ? "#fff" : "rgba(0, 0, 0, 0.55)",
        color: isPrimary ? "#000" : "rgba(255,255,255,0.85)",
        border: `1px solid ${isPrimary ? "rgba(0,0,0,0.05)" : tokens.hairline}`,
        boxShadow: isPrimary
          ? "0 10px 40px -10px rgba(16, 185, 129, 0.55), 0 4px 16px -4px rgba(0, 0, 0, 0.6)"
          : "none",
        fontFamily: fontStack,
        fontSize: 14,
        fontWeight: 600,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      {icon}
      {hasLabel && <span>{label}</span>}
      {badge !== undefined && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: tokens.emerald,
            fontSize: 10,
            fontWeight: 700,
            color: "#04130c",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${badgeT})`,
            transformOrigin: "center",
          }}
        >
          {badge}
        </span>
      )}
    </span>
  );
};

// Pre-built icons used by the design slate.
export const PlusIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const BellIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

export const ClockIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx={12} cy={12} r={9} />
    <path d="M12 7v5l3 2" />
  </svg>
);
