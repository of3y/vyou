import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring } from "../motion";

export type SectionHeadProps = {
  kicker: string;
  title: React.ReactNode;
  delayFrames?: number;
  animateIn?: boolean;
};

export const SectionHead: React.FC<SectionHeadProps> = ({
  kicker,
  title,
  delayFrames = 0,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tk = animateIn ? enterSpring(frame, fps, delayFrames) : 1;
  const tt = animateIn ? enterSpring(frame, fps, delayFrames + 4) : 1;

  return (
    <div style={{ marginBottom: 24, fontFamily: fontStack }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: tokens.inkFaint,
          marginBottom: 8,
          opacity: tk,
          transform: `translateY(${(1 - tk) * 6}px)`,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: tokens.ink,
          opacity: tt,
          transform: `translateY(${(1 - tt) * 8}px)`,
        }}
      >
        {title}
      </div>
    </div>
  );
};
