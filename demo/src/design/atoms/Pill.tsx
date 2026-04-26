import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring, pulseLoop } from "../motion";

export type PillTone = "neutral" | "amber" | "rose";

export type PillProps = {
  children: React.ReactNode;
  tone?: PillTone;
  showDot?: boolean;
  delayFrames?: number;
  // If false, the pill is rendered fully visible without the entrance spring.
  animateIn?: boolean;
};

const dotColor = (tone: PillTone) => {
  if (tone === "amber") return tokens.amber;
  if (tone === "rose") return tokens.rose;
  return tokens.emeraldBright;
};

const dotGlow = (tone: PillTone) => {
  if (tone === "amber") return "rgba(245, 158, 11, 0.6)";
  if (tone === "rose") return "rgba(244, 63, 94, 0.55)";
  return "rgba(52, 211, 153, 0.6)";
};

export const Pill: React.FC<PillProps> = ({
  children,
  tone = "neutral",
  showDot = false,
  delayFrames = 0,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;
  const opacity = t;
  const lift = (1 - t) * 8;

  // Dot pulse loop — 2.4s per CSS spec.
  const pulseT = pulseLoop(frame, Math.round(fps * 2.4));
  const pulseRing = 6 + pulseT * 18;
  const pulseAlpha = 0.55 * (1 - pulseT);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 12px",
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.06)",
        border: `1px solid ${tokens.hairline}`,
        fontFamily: fontStack,
        fontSize: 12,
        fontWeight: 500,
        color: "rgba(255, 255, 255, 0.78)",
        opacity,
        transform: `translateY(${lift}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {showDot && (
        <span
          style={{
            position: "relative",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor(tone),
            boxShadow: `0 0 6px ${dotGlow(tone)}`,
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              width: pulseRing,
              height: pulseRing,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              left: "50%",
              top: "50%",
              boxShadow: `0 0 0 1px ${dotColor(tone)}`,
              opacity: pulseAlpha,
            }}
          />
        </span>
      )}
      {children}
    </span>
  );
};
