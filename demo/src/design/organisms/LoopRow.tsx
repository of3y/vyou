import React from "react";
import { LoopStep } from "../molecules/LoopStep";

export type LoopRowProps = {
  delayFrames?: number;
  // Frames between successive step entrances.
  staggerFrames?: number;
};

const STEPS = [
  {
    num: "01",
    title: "Capture",
    body:
      "Open the camera, take a sky photo. Heading and location come from the device.",
  },
  {
    num: "02",
    title: "Classify",
    body:
      "Opus 4.7 reads the sky — cloud cover, precipitation type, ceiling, visibility.",
  },
  {
    num: "03",
    title: "Reconcile",
    body:
      "The classification is matched against DWD radar inside the cone footprint.",
  },
  {
    num: "04",
    title: "Publish",
    body:
      "A directional cone lands on the shared map with a verdict everyone can see.",
  },
];

// Four-step photo→heading→cone→verified report row, fused horizontally
// into a single rounded surface (matching the design slate).
export const LoopRow: React.FC<LoopRowProps> = ({
  delayFrames = 0,
  staggerFrames = 8,
}) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 0,
        alignItems: "stretch",
        width: "100%",
      }}
    >
      {STEPS.map((s, i) => (
        <LoopStep
          key={s.num}
          num={s.num}
          title={s.title}
          body={s.body}
          delayFrames={delayFrames + i * staggerFrames}
          position={
            i === 0 ? "first" : i === STEPS.length - 1 ? "last" : "middle"
          }
        />
      ))}
    </div>
  );
};
