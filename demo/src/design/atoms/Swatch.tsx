import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack, monoStack } from "../../tokens";
import { enterSpring } from "../motion";

export type SwatchProps = {
  name: string;
  hex: string;
  delayFrames?: number;
  animateIn?: boolean;
};

export const Swatch: React.FC<SwatchProps> = ({
  name,
  hex,
  delayFrames = 0,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${tokens.hairline}`,
        overflow: "hidden",
        background: "rgba(255,255,255,0.02)",
        fontFamily: fontStack,
        opacity: t,
        transform: `translateY(${(1 - t) * 8}px)`,
      }}
    >
      <div style={{ aspectRatio: "16 / 10", background: hex }} />
      <div
        style={{
          padding: "10px 12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.ink }}>
          {name}
        </span>
        <span
          style={{
            fontFamily: monoStack,
            fontSize: 11,
            color: tokens.inkFaint,
          }}
        >
          {hex.toUpperCase()}
        </span>
      </div>
    </div>
  );
};
