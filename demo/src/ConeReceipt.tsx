import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { tokens, fontStack } from "./tokens";

const W = 1920;
const H = 1080;

export type ConeReceiptProps = {
  photoUrl?: string;
  coneAngleDegrees?: number;
  answerProse?: string;
  guardrailChips?: string[];
};

const HALF_ANGLE_DEG = 26;
const CONE_LENGTH = 480;

const compassToCanvas = (deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: Math.sin(rad) };
};

const conePolygon = (cx: number, cy: number, bearingDeg: number) => {
  const left = compassToCanvas(bearingDeg - HALF_ANGLE_DEG);
  const right = compassToCanvas(bearingDeg + HALF_ANGLE_DEG);
  return `${cx},${cy} ${cx + left.dx * CONE_LENGTH},${cy + left.dy * CONE_LENGTH} ${cx + right.dx * CONE_LENGTH},${cy + right.dy * CONE_LENGTH}`;
};

const photoStartCenter = (cx: number, cy: number, bearingDeg: number) => {
  const c = compassToCanvas(bearingDeg);
  return {
    x: cx + c.dx * (CONE_LENGTH - 180),
    y: cy + c.dy * (CONE_LENGTH - 180),
  };
};

export const ConeReceipt: React.FC<ConeReceiptProps> = ({
  photoUrl,
  coneAngleDegrees = 180,
  answerProse = "Replace with the verified answer prose from the live build.",
  guardrailChips = ["sources cited", "no hallucination", "fresh data", "scoped"],
}) => {
  const frame = useCurrentFrame();

  const anchorX = W * 0.78;
  const anchorY = H * 0.22;

  const coneFill = interpolate(frame, [0, 20], [0, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneOutline = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneOutlineLate = interpolate(frame, [40, 60], [1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneFillLate = interpolate(frame, [40, 60], [0.22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneFillReturn = interpolate(frame, [150, 180], [0, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneOutlineReturn = interpolate(frame, [150, 180], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fillOpacity =
    frame < 40 ? coneFill : frame < 150 ? coneFillLate : coneFillReturn;
  const outlineOpacity =
    frame < 40 ? coneOutline : frame < 150 ? coneOutlineLate : coneOutlineReturn;

  const start = photoStartCenter(anchorX, anchorY, coneAngleDegrees);
  const end = { x: W / 2, y: H * 0.45 };

  const t = interpolate(frame, [40, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tBack = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = frame < 150 ? start.x + (end.x - start.x) * t : end.x + (start.x - end.x) * tBack;
  const cy = frame < 150 ? start.y + (end.y - start.y) * t : end.y + (start.y - end.y) * tBack;

  const baseScale = interpolate(frame, [20, 40, 80], [0.6, 1, 1.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shrink = interpolate(frame, [150, 180], [1.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = frame < 150 ? baseScale : shrink;

  const photoOpacity = interpolate(
    frame,
    [20, 40, 150, 180],
    [0, 1, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const cardSlide = interpolate(frame, [80, 100], [120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOut = interpolate(frame, [150, 180], [0, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity = interpolate(frame, [80, 100, 150, 180], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOffset = frame < 150 ? cardSlide : cardOut;

  const photoW = 380;
  const photoH = 260;

  const points = conePolygon(anchorX, anchorY, coneAngleDegrees);

  return (
    <AbsoluteFill style={{ background: tokens.bg }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <polygon
          points={points}
          fill={tokens.cone}
          fillOpacity={fillOpacity}
          stroke={tokens.cone}
          strokeOpacity={outlineOpacity}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <circle cx={anchorX} cy={anchorY} r={6} fill={tokens.coneActive} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: cx - photoW / 2,
          top: cy - photoH / 2,
          width: photoW,
          height: photoH,
          opacity: photoOpacity,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          border: `2px solid ${tokens.coneActive}`,
        }}
      >
        {photoUrl ? (
          <Img
            src={photoUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: tokens.panel,
              color: tokens.mute,
              fontFamily: fontStack,
              fontSize: 16,
              textAlign: "center",
              padding: 16,
            }}
          >
            photo placeholder
            <br />
            (swap in CapCut)
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: W * 0.12,
          right: W * 0.12,
          bottom: 80 - cardOffset,
          padding: "22px 28px",
          background: tokens.panel,
          border: `1px solid ${tokens.chipBorder}`,
          borderRadius: 14,
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          fontFamily: fontStack,
          color: tokens.ink,
          opacity: cardOpacity,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: tokens.cone,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Answer
        </div>
        <div
          style={{
            fontSize: 26,
            color: tokens.ink,
            marginTop: 10,
            lineHeight: 1.35,
            opacity: 0.95,
          }}
        >
          {answerProse}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          {guardrailChips.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 13,
                color: tokens.mute,
                background: tokens.chip,
                border: `1px solid ${tokens.chipBorder}`,
                borderRadius: 6,
                padding: "5px 10px",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
