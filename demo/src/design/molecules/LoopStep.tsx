import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring } from "../motion";

export type LoopStepProps = {
  num: string;       // "01", "02", "03", "04"
  title: string;
  body: string;
  delayFrames?: number;
  // Visual position in a row — affects which corners are rounded.
  position?: "first" | "middle" | "last" | "only";
  animateIn?: boolean;
};

export const LoopStep: React.FC<LoopStepProps> = ({
  num,
  title,
  body,
  delayFrames = 0,
  position = "middle",
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;

  const isFirst = position === "first" || position === "only";
  const isLast = position === "last" || position === "only";

  return (
    <div
      style={{
        position: "relative",
        padding: "22px 22px 22px 28px",
        border: `1px solid ${tokens.hairline}`,
        borderRight: isLast ? `1px solid ${tokens.hairline}` : "none",
        borderTopLeftRadius: isFirst ? 18 : 0,
        borderBottomLeftRadius: isFirst ? 18 : 0,
        borderTopRightRadius: isLast ? 18 : 0,
        borderBottomRightRadius: isLast ? 18 : 0,
        fontFamily: fontStack,
        background: "transparent",
        opacity: t,
        transform: `translateY(${(1 - t) * 10}px)`,
        height: "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          fontSize: 11,
          fontWeight: 600,
          color: tokens.emeraldBright,
          letterSpacing: "0.06em",
        }}
      >
        {num}
      </div>
      <div
        style={{
          marginTop: 28,
          marginBottom: 6,
          color: tokens.ink,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: tokens.inkDim, lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  );
};
