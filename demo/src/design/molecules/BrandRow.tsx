import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack } from "../../tokens";
import { enterSpring } from "../motion";
import { Pill } from "../atoms/Pill";

export type BrandRowProps = {
  showLivePill?: boolean;
  delayFrames?: number;
  animateIn?: boolean;
};

export const BrandRow: React.FC<BrandRowProps> = ({
  showLivePill = true,
  delayFrames = 0,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = animateIn ? enterSpring(frame, fps, delayFrames) : 1;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        opacity: t,
        transform: `translateY(${(1 - t) * 6}px)`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tokens.bg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={22} height={22} viewBox="0 0 512 512">
          <path
            d="M 256 380 L 80 88 L 432 88 Z"
            fill={tokens.emerald}
            fillOpacity={0.9}
          />
          <circle cx={256} cy={380} r={22} fill={tokens.emerald} />
        </svg>
      </span>
      <span
        style={{
          fontFamily: fontStack,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.01em",
          color: tokens.ink,
        }}
      >
        VYU
      </span>
      {showLivePill && (
        <Pill showDot delayFrames={delayFrames + 6} animateIn={animateIn}>
          live
        </Pill>
      )}
    </div>
  );
};
