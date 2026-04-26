import React from "react";
import { AbsoluteFill } from "remotion";
import { tokens, fontStack } from "../tokens";
import { HeroArtDefault } from "./organisms/HeroArt";
import { MapPreview } from "./organisms/MapPreview";
import { ReportDrawer } from "./organisms/ReportDrawer";
import { LoopRow } from "./organisms/LoopRow";
import { ALL_REPORTS, type ConeReport } from "./fixtures";

// Preview slates for Remotion Studio. Each gives a layout-agnostic organism
// a sized parent on the 1920x1080 canvas so it has something to fill.

const SlateBG: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: tokens.bg,
      color: tokens.ink,
      fontFamily: fontStack,
      alignItems: "center",
      justifyContent: "center",
      padding: 80,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const HeroArtPreview: React.FC = () => (
  <SlateBG>
    <div style={{ position: "relative", width: 900, height: 900 }}>
      <HeroArtDefault delayFrames={4} />
    </div>
  </SlateBG>
);

export const MapPreviewPreview: React.FC = () => (
  <SlateBG>
    <div style={{ position: "relative", width: 1200, height: 900 }}>
      <MapPreview delayFrames={4} addPressFrame={90} bellBadge={1} />
    </div>
  </SlateBG>
);

export const ReportDrawerPreview: React.FC<{ report?: ConeReport }> = ({
  report,
}) => (
  <SlateBG>
    <div style={{ width: 720 }}>
      <ReportDrawer report={report} delayFrames={4} verdictDelayFrames={18} />
    </div>
  </SlateBG>
);

export const ReportDrawerSchwabing: React.FC = () => (
  <ReportDrawerPreview report={ALL_REPORTS[0]} />
);
export const ReportDrawerAndechs: React.FC = () => (
  <ReportDrawerPreview report={ALL_REPORTS[1]} />
);
export const ReportDrawerRursee: React.FC = () => (
  <ReportDrawerPreview report={ALL_REPORTS[2]} />
);
export const ReportDrawerTurkey: React.FC = () => (
  <ReportDrawerPreview report={ALL_REPORTS[3]} />
);

export const LoopRowPreview: React.FC = () => (
  <SlateBG>
    <div style={{ width: 1600 }}>
      <LoopRow delayFrames={4} staggerFrames={10} />
    </div>
  </SlateBG>
);
