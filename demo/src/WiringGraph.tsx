import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { tokens, fontStack } from "./tokens";

const W = 1920;
const H = 1080;

const NODE_W = 280;
const NODE_H = 80;

type NodePos = { x: number; y: number };

const classifierPos: NodePos = { x: 220, y: H / 2 - NODE_H / 2 };
const reconciliationPos: NodePos = { x: 820, y: H / 2 - NODE_H / 2 };
const deepResearcherPos: NodePos = { x: 1420, y: H / 2 - NODE_H / 2 };

const fadeIn = (frame: number, start: number, dur = 24) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Node: React.FC<{
  pos: NodePos;
  label: string;
  enterFrame: number;
  frame: number;
}> = ({ pos, label, enterFrame, frame }) => {
  const o = fadeIn(frame, enterFrame);
  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: NODE_W,
        height: NODE_H,
        background: tokens.panel,
        border: `2px solid ${tokens.cma}`,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tokens.ink,
        fontFamily: fontStack,
        fontSize: 24,
        fontWeight: 600,
        opacity: o,
        boxShadow: `0 0 24px rgba(52, 211, 153, ${0.18 * o})`,
      }}
    >
      {label}
    </div>
  );
};

const Chip: React.FC<{
  x: number;
  y: number;
  label: string;
  enterFrame: number;
  frame: number;
  width?: number;
  flyFromX?: number;
}> = ({ x, y, label, enterFrame, frame, width = 180, flyFromX }) => {
  const o = fadeIn(frame, enterFrame, 18);
  const dx =
    flyFromX !== undefined
      ? interpolate(frame, [enterFrame, enterFrame + 24], [flyFromX - x, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x + dx,
        top: y,
        width,
        height: 28,
        background: tokens.chip,
        border: `1px solid ${tokens.chipBorder}`,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tokens.mute,
        fontFamily: fontStack,
        fontSize: 14,
        fontWeight: 500,
        opacity: o,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  enterFrame: number;
  frame: number;
  duration?: number;
}> = ({ x1, y1, x2, y2, enterFrame, frame, duration = 30 }) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const dash = interpolate(
    frame,
    [enterFrame, enterFrame + duration],
    [length, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const o = fadeIn(frame, enterFrame, 6);
  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      width={W}
      height={H}
    >
      <defs>
        <marker
          id={`arrowhead-${enterFrame}-${x1}-${y1}`}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={tokens.cone} opacity={o} />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={tokens.cone}
        strokeWidth={2.5}
        strokeDasharray={length}
        strokeDashoffset={dash}
        opacity={o}
        markerEnd={`url(#arrowhead-${enterFrame}-${x1}-${y1})`}
      />
    </svg>
  );
};

const MemoryCylinder: React.FC<{
  x: number;
  y: number;
  label: string;
  enterFrame: number;
  fillStart: number;
  frame: number;
}> = ({ x, y, label, enterFrame, fillStart, frame }) => {
  const o = fadeIn(frame, enterFrame, 24);
  const fill = interpolate(frame, [fillStart, fillStart + 240], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cw = 110;
  const ch = 140;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: cw,
        opacity: o,
        fontFamily: fontStack,
      }}
    >
      <svg width={cw} height={ch}>
        <ellipse
          cx={cw / 2}
          cy={14}
          rx={cw / 2 - 2}
          ry={12}
          fill={tokens.panel}
          stroke={tokens.ribbon}
          strokeWidth={2}
        />
        <rect
          x={2}
          y={14}
          width={cw - 4}
          height={ch - 28}
          fill={tokens.panel}
          stroke={tokens.ribbon}
          strokeWidth={2}
        />
        <rect
          x={2}
          y={14 + (ch - 28) * (1 - fill)}
          width={cw - 4}
          height={(ch - 28) * fill}
          fill={tokens.ribbon}
          opacity={0.55}
        />
        <ellipse
          cx={cw / 2}
          cy={ch - 14}
          rx={cw / 2 - 2}
          ry={12}
          fill={tokens.panel}
          stroke={tokens.ribbon}
          strokeWidth={2}
        />
      </svg>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          color: tokens.mute,
          textAlign: "center",
          width: cw,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Card: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  enterFrame: number;
  frame: number;
  title: string;
  body?: string;
  chips?: string[];
}> = ({ x, y, width, height, enterFrame, frame, title, body, chips }) => {
  const o = fadeIn(frame, enterFrame, 24);
  const lift = interpolate(frame, [enterFrame, enterFrame + 24], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + lift,
        width,
        minHeight: height,
        background: tokens.panel,
        border: `1px solid ${tokens.chipBorder}`,
        borderRadius: 10,
        padding: 14,
        opacity: o,
        fontFamily: fontStack,
        color: tokens.ink,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 14, color: tokens.cone, fontWeight: 600 }}>
        {title}
      </div>
      {body && (
        <div
          style={{
            fontSize: 14,
            color: tokens.ink,
            marginTop: 8,
            lineHeight: 1.4,
            opacity: 0.9,
          }}
        >
          {body}
        </div>
      )}
      {chips && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                color: tokens.mute,
                background: tokens.chip,
                border: `1px solid ${tokens.chipBorder}`,
                borderRadius: 4,
                padding: "3px 8px",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const Ribbon: React.FC<{
  x: number;
  y: number;
  width: number;
  enterFrame: number;
  frame: number;
}> = ({ x, y, width, enterFrame, frame }) => {
  const o = fadeIn(frame, enterFrame, 24);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        padding: "8px 14px",
        background: `${tokens.ribbon}22`,
        border: `1px solid ${tokens.ribbon}`,
        borderRadius: 999,
        color: tokens.ribbon,
        fontFamily: fontStack,
        fontSize: 14,
        fontWeight: 600,
        textAlign: "center",
        opacity: o,
        letterSpacing: 0.3,
      }}
    >
      Persists across sessions
    </div>
  );
};

const Grid: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [0, 20], [0, 0.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, opacity: o }}
      width={W}
      height={H}
    >
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#ffffff" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
    </svg>
  );
};

export const WiringGraph: React.FC = () => {
  const frame = useCurrentFrame();

  const cX = classifierPos.x + NODE_W / 2;
  const cY = classifierPos.y + NODE_H / 2;
  const rX = reconciliationPos.x + NODE_W / 2;
  const rY = reconciliationPos.y + NODE_H / 2;
  const dX = deepResearcherPos.x + NODE_W / 2;
  const dY = deepResearcherPos.y + NODE_H / 2;

  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      <Grid frame={frame} />

      {/* Beat 3: Classifier */}
      <Node
        pos={classifierPos}
        label="Classifier"
        enterFrame={20}
        frame={frame}
      />
      <Chip
        x={classifierPos.x + (NODE_W - 240) / 2}
        y={classifierPos.y + NODE_H + 14}
        width={240}
        label="severe-weather-reporting"
        enterFrame={120}
        frame={frame}
      />
      {/* photo arrow into Classifier */}
      <Arrow
        x1={60}
        y1={cY}
        x2={classifierPos.x - 6}
        y2={cY}
        enterFrame={200}
        frame={frame}
      />

      {/* Classifier → Reconciliation arrow appears late beat 3 / start beat 4 */}
      <Arrow
        x1={classifierPos.x + NODE_W + 6}
        y1={cY}
        x2={reconciliationPos.x - 6}
        y2={rY}
        enterFrame={560}
        frame={frame}
      />

      {/* Beat 4: Reconciliation */}
      <Node
        pos={reconciliationPos}
        label="Reconciliation"
        enterFrame={600}
        frame={frame}
      />

      {/* Input chips flying in from right side */}
      <Chip
        x={reconciliationPos.x + NODE_W + 60}
        y={rY - 96}
        label="RADOLAN (radar)"
        enterFrame={700}
        frame={frame}
        flyFromX={W + 80}
      />
      <Chip
        x={reconciliationPos.x + NODE_W + 60}
        y={rY - 56}
        label="MTG IR"
        enterFrame={760}
        frame={frame}
        flyFromX={W + 80}
      />
      <Chip
        x={reconciliationPos.x + NODE_W + 60}
        y={rY - 16}
        label="MTG LI"
        enterFrame={820}
        frame={frame}
        flyFromX={W + 80}
      />
      <Chip
        x={reconciliationPos.x + NODE_W + 60}
        y={rY + 24}
        label="Open-Meteo"
        enterFrame={880}
        frame={frame}
        flyFromX={W + 80}
      />

      {/* arrows from input chips into Reconciliation */}
      <Arrow
        x1={reconciliationPos.x + NODE_W + 60}
        y1={rY - 80}
        x2={reconciliationPos.x + NODE_W + 6}
        y2={rY - 20}
        enterFrame={730}
        frame={frame}
        duration={20}
      />
      <Arrow
        x1={reconciliationPos.x + NODE_W + 60}
        y1={rY - 40}
        x2={reconciliationPos.x + NODE_W + 6}
        y2={rY - 6}
        enterFrame={790}
        frame={frame}
        duration={20}
      />
      <Arrow
        x1={reconciliationPos.x + NODE_W + 60}
        y1={rY}
        x2={reconciliationPos.x + NODE_W + 6}
        y2={rY + 6}
        enterFrame={850}
        frame={frame}
        duration={20}
      />
      <Arrow
        x1={reconciliationPos.x + NODE_W + 60}
        y1={rY + 40}
        x2={reconciliationPos.x + NODE_W + 6}
        y2={rY + 20}
        enterFrame={910}
        frame={frame}
        duration={20}
      />

      {/* verified-report card emerges below Reconciliation */}
      <Card
        x={reconciliationPos.x - 40}
        y={reconciliationPos.y + NODE_H + 60}
        width={NODE_W + 80}
        height={120}
        enterFrame={1000}
        frame={frame}
        title="Verified report"
        body="Photo + radar overlap → confidence 0.86"
        chips={["radar match", "MTG concur", "fresh"]}
      />

      {/* per-location memory cylinder fills beat 4 */}
      <MemoryCylinder
        x={reconciliationPos.x + NODE_W + 280}
        y={rY - 70}
        label="Memory Box · per location"
        enterFrame={1100}
        fillStart={1140}
        frame={frame}
      />

      {/* Beat 5: Deep Researcher */}
      <Node
        pos={deepResearcherPos}
        label="Deep Researcher"
        enterFrame={1350}
        frame={frame}
      />
      <Chip
        x={deepResearcherPos.x - 10}
        y={deepResearcherPos.y + NODE_H + 14}
        label="SWR"
        enterFrame={1420}
        frame={frame}
        width={70}
      />
      <Chip
        x={deepResearcherPos.x + 80}
        y={deepResearcherPos.y + NODE_H + 14}
        label="RSR"
        enterFrame={1450}
        frame={frame}
        width={70}
      />
      <Chip
        x={deepResearcherPos.x + 170}
        y={deepResearcherPos.y + NODE_H + 14}
        label="PRS"
        enterFrame={1480}
        frame={frame}
        width={70}
      />

      {/* per-user memory cylinder appears for beat 5 */}
      <MemoryCylinder
        x={deepResearcherPos.x - 240}
        y={dY + 60}
        label="Memory Box · per user"
        enterFrame={1400}
        fillStart={1440}
        frame={frame}
      />

      {/* arrows into Deep Researcher from verified-report card + both cylinders */}
      <Arrow
        x1={reconciliationPos.x + NODE_W + 60}
        y1={reconciliationPos.y + NODE_H + 120}
        x2={deepResearcherPos.x + 20}
        y2={dY + 20}
        enterFrame={1500}
        frame={frame}
        duration={28}
      />
      <Arrow
        x1={reconciliationPos.x + NODE_W + 280 + 55}
        y1={rY - 70 + 70}
        x2={deepResearcherPos.x - 6}
        y2={dY - 10}
        enterFrame={1530}
        frame={frame}
        duration={28}
      />
      <Arrow
        x1={deepResearcherPos.x - 240 + 110}
        y1={dY + 60 + 70}
        x2={deepResearcherPos.x + 40}
        y2={dY + 30}
        enterFrame={1560}
        frame={frame}
        duration={28}
      />

      {/* lavender ribbon */}
      <Ribbon
        x={deepResearcherPos.x - 20}
        y={deepResearcherPos.y + NODE_H + 60}
        width={NODE_W + 40}
        enterFrame={1700}
        frame={frame}
      />

      {/* answer card to the right of DR */}
      <Card
        x={W - 480}
        y={deepResearcherPos.y - 100}
        width={420}
        height={260}
        enterFrame={1850}
        frame={frame}
        title="Answer"
        body="Take the south route — clear skies for 2 h, then a band moves in from the west around 16:30."
        chips={["sources cited", "no hallucination", "fresh data", "scoped"]}
      />
    </AbsoluteFill>
  );
};
