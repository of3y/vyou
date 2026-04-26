import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../../tokens";
import { enterSpring, SPRING_FIRM } from "../motion";
import { Pill } from "../atoms/Pill";
import {
  FAB,
  PlusIcon,
  BellIcon,
  ClockIcon,
} from "../atoms/FAB";

export type MapPreviewProps = {
  // Optional pill content for the corners.
  topLeftPills?: React.ReactNode;
  topRightPill?: React.ReactNode;
  // Frame at which the primary FAB plays its press animation.
  addPressFrame?: number;
  // Bell badge count.
  bellBadge?: number | string;
  delayFrames?: number;
};

// MapPreview — the dark map surface with a centred cone, top-bar pills, and
// a bottom FAB row (Add Cone primary, Bell with badge, Clock). Layout-agnostic.
export const MapPreview: React.FC<MapPreviewProps> = ({
  topLeftPills,
  topRightPill,
  addPressFrame,
  bellBadge = 1,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sweepT = enterSpring(frame, fps, delayFrames, SPRING_FIRM);
  const clipHeight = 190 * sweepT;
  const clipY = 240 - clipHeight;

  return (
    <AbsoluteFill
      style={{
        borderRadius: 18,
        border: `1px solid ${tokens.hairline}`,
        overflow: "hidden",
        background:
          "radial-gradient(120% 60% at 50% 100%, rgba(16, 185, 129, 0.12) 0%, transparent 60%), linear-gradient(180deg, #181d26 0%, #0e1117 100%)",
      }}
    >
      {/* topbar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {topLeftPills ?? (
            <>
              <Pill showDot delayFrames={delayFrames + 4}>
                VYU
              </Pill>
              <Pill showDot tone="amber" delayFrames={delayFrames + 8}>
                weak signal
              </Pill>
            </>
          )}
        </div>
        {topRightPill ?? <Pill delayFrames={delayFrames + 12}>Reports</Pill>}
      </div>

      {/* centred cone */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 400 300" style={{ width: "80%", height: "auto" }}>
          <defs>
            <linearGradient id="coneGradMap" x1="0.5" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor={tokens.emerald} stopOpacity={0.5} />
              <stop offset="100%" stopColor={tokens.emerald} stopOpacity={0} />
            </linearGradient>
            <clipPath id="coneSweepClipMap">
              <rect x={0} y={clipY} width={400} height={clipHeight} />
            </clipPath>
          </defs>
          <g clipPath="url(#coneSweepClipMap)">
            <path
              d="M 200 240 L 80 50 L 320 50 Z"
              fill="url(#coneGradMap)"
              stroke={tokens.emeraldBright}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          </g>
          <circle cx={200} cy={240} r={6} fill={tokens.emerald} />
        </svg>
      </AbsoluteFill>

      {/* bottom FAB row */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <FAB
          variant="primary"
          label="Add Cone"
          icon={<PlusIcon />}
          delayFrames={delayFrames + 18}
          pressFrame={addPressFrame}
        />
        <FAB
          ariaLabel="Notifications"
          icon={<BellIcon />}
          badge={bellBadge}
          delayFrames={delayFrames + 22}
        />
        <FAB
          ariaLabel="Time controls"
          icon={<ClockIcon />}
          delayFrames={delayFrames + 26}
        />
      </div>
    </AbsoluteFill>
  );
};
