import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring } from "../motion";

export type WChipVariant = "neutral" | "match" | "partial" | "mismatch";

export type WChipProps = {
  children: React.ReactNode;
  variant?: WChipVariant;
  delayFrames?: number;
  animateIn?: boolean;
};

const styles = (variant: WChipVariant) => {
  switch (variant) {
    case "match":
      return {
        background: "rgba(16, 185, 129, 0.12)",
        borderColor: "rgba(16, 185, 129, 0.35)",
        color: "#a7f3d0",
      };
    case "partial":
      return {
        background: "rgba(245, 158, 11, 0.12)",
        borderColor: "rgba(245, 158, 11, 0.35)",
        color: "#fde68a",
      };
    case "mismatch":
      return {
        background: "rgba(244, 63, 94, 0.12)",
        borderColor: "rgba(244, 63, 94, 0.35)",
        color: "#fecdd3",
      };
    default:
      return {
        background: "rgba(255,255,255,0.04)",
        borderColor: tokens.hairline,
        color: "rgba(255,255,255,0.78)",
      };
  }
};

export const WChip: React.FC<WChipProps> = ({
  children,
  variant = "neutral",
  delayFrames = 0,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;
  const s = styles(variant);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        fontFamily: fontStack,
        fontSize: 11,
        fontWeight: 500,
        border: `1px solid ${s.borderColor}`,
        background: s.background,
        color: s.color,
        opacity: t,
        transform: `translateY(${(1 - t) * 8}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};
