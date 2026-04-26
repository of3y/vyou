import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { tokens, fontStack, monoStack } from "../../tokens";
import { enterSpring } from "../motion";
import { Pill } from "../atoms/Pill";
import { WChip, type WChipVariant } from "../atoms/WChip";
import { SCHWABING, type ConeReport } from "../fixtures";

export type ReportDrawerProps = {
  report?: ConeReport;
  delayFrames?: number;
  // When the verdict block lands relative to the drawer entrance.
  verdictDelayFrames?: number;
};

const verdictPillTone = (v: ConeReport["verdict"]) => {
  if (v === "match") return "neutral" as const;
  if (v === "partial") return "amber" as const;
  return "rose" as const;
};

const verdictPillLabel = (v: ConeReport["verdict"]) => {
  if (v === "match") return "match";
  if (v === "partial") return "partial";
  return "mismatch";
};

const verdictBlockColors = (v: ConeReport["verdict"]) => {
  if (v === "match")
    return {
      bg: "rgba(16, 185, 129, 0.08)",
      border: "rgba(16, 185, 129, 0.25)",
      ink: tokens.emeraldBright,
      heading: "Verified by radar",
    };
  if (v === "partial")
    return {
      bg: "rgba(245, 158, 11, 0.08)",
      border: "rgba(245, 158, 11, 0.25)",
      ink: tokens.amber,
      heading: "Partial radar match",
    };
  return {
    bg: "rgba(244, 63, 94, 0.08)",
    border: "rgba(244, 63, 94, 0.25)",
    ink: tokens.rose,
    heading: "Radar disagrees",
  };
};

export const ReportDrawer: React.FC<ReportDrawerProps> = ({
  report = SCHWABING,
  delayFrames = 0,
  verdictDelayFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = enterSpring(frame, fps, delayFrames);
  const tv = enterSpring(frame, fps, delayFrames + verdictDelayFrames);
  const v = verdictBlockColors(report.verdict);

  return (
    <div
      style={{
        background: "rgba(20, 23, 29, 0.92)",
        border: `1px solid ${tokens.hairline}`,
        borderRadius: 20,
        padding: 22,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        fontFamily: fontStack,
        color: tokens.ink,
        opacity: t,
        transform: `translateY(${(1 - t) * 18}px)`,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.18)",
          margin: "0 auto 16px",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>
            {report.place} · {report.facing}
          </div>
          <div
            style={{
              fontSize: 12,
              color: tokens.inkFaint,
              marginTop: 4,
            }}
          >
            {report.whenLabel} · {report.coords.lat.toFixed(2)}°N,{" "}
            {report.coords.lon.toFixed(2)}°E
          </div>
        </div>
        <Pill
          showDot
          tone={verdictPillTone(report.verdict)}
          delayFrames={delayFrames + 4}
        >
          {verdictPillLabel(report.verdict)}
        </Pill>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {report.chips.map((c, i) => (
          <WChip
            key={c.label}
            variant={(c.verdict as WChipVariant | undefined) ?? "neutral"}
            delayFrames={delayFrames + 6 + i * 3}
          >
            {c.label}
          </WChip>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: v.bg,
          border: `1px solid ${v.border}`,
          opacity: tv,
          transform: `translateY(${(1 - tv) * 8}px)`,
        }}
      >
        <h5
          style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 12,
            fontWeight: 600,
            color: v.ink,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {v.heading}
        </h5>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.55,
          }}
        >
          {report.verdictLine}
        </p>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: monoStack,
            fontSize: 11,
            color: tokens.inkFaint,
          }}
        >
          cone · {report.bearingDegrees}° / {report.coneWidthDegrees}° wide
        </span>
        <span
          style={{
            fontSize: 12,
            color: tokens.emeraldBright,
          }}
        >
          Open report →
        </span>
      </div>
    </div>
  );
};
