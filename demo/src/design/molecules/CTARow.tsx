import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring, pressScale } from "../motion";
import { PlusIcon } from "../atoms/FAB";

export type CTARowProps = {
  primaryLabel?: string;
  ghostLabel?: string;
  primaryIcon?: React.ReactNode;
  delayFrames?: number;
  primaryPressFrame?: number;
  animateIn?: boolean;
};

export const CTARow: React.FC<CTARowProps> = ({
  primaryLabel = "Add Cone",
  ghostLabel = "Explore the map",
  primaryIcon = <PlusIcon />,
  delayFrames = 0,
  primaryPressFrame,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;
  const tg = animateIn ? enterSpring(frame, fps, delayFrames + 4) : 1;
  const press = pressScale(frame, primaryPressFrame);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 52,
          padding: "0 22px",
          borderRadius: 999,
          background: "#fff",
          color: "#000",
          fontFamily: fontStack,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          boxShadow:
            "0 10px 40px -10px rgba(16, 185, 129, 0.55), 0 4px 16px -4px rgba(0, 0, 0, 0.6)",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          opacity: t,
          transform: `scale(${(0.92 + 0.08 * t) * press}) translateY(${(1 - t) * 8}px)`,
          transformOrigin: "center",
        }}
      >
        {primaryIcon}
        {primaryLabel}
      </span>
      {ghostLabel && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 52,
            padding: "0 18px",
            borderRadius: 999,
            background: "rgba(0, 0, 0, 0.45)",
            border: `1px solid ${tokens.hairline}`,
            color: "rgba(255, 255, 255, 0.85)",
            fontFamily: fontStack,
            fontSize: 13,
            fontWeight: 500,
            opacity: tg,
            transform: `translateY(${(1 - tg) * 8}px)`,
          }}
        >
          {ghostLabel}
        </span>
      )}
    </div>
  );
};
