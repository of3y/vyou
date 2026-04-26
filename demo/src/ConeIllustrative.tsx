import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { tokens, fontStack } from "./tokens";

const W = 1920;
const H = 1080;

export type ConeIllustrativeProps = {
  photoUrl?: string;
  coneAngleDegrees?: number;
  caption?: string;
};

const HALF_ANGLE_DEG = 30;
const CONE_LENGTH = 620;

const compassToCanvas = (deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: Math.sin(rad) };
};

const conePolygon = (cx: number, cy: number, bearingDeg: number) => {
  const left = compassToCanvas(bearingDeg - HALF_ANGLE_DEG);
  const right = compassToCanvas(bearingDeg + HALF_ANGLE_DEG);
  const p1 = `${cx},${cy}`;
  const p2 = `${cx + left.dx * CONE_LENGTH},${cy + left.dy * CONE_LENGTH}`;
  const p3 = `${cx + right.dx * CONE_LENGTH},${cy + right.dy * CONE_LENGTH}`;
  return `${p1} ${p2} ${p3}`;
};

const photoCenter = (cx: number, cy: number, bearingDeg: number) => {
  const c = compassToCanvas(bearingDeg);
  return {
    x: cx + c.dx * (CONE_LENGTH - 230),
    y: cy + c.dy * (CONE_LENGTH - 230),
  };
};

export const ConeIllustrative: React.FC<ConeIllustrativeProps> = ({
  photoUrl,
  coneAngleDegrees = 0,
  caption,
}) => {
  const frame = useCurrentFrame();

  const anchorX = W * 0.5;
  const anchorY = H * 0.78;

  const coneFill = interpolate(frame, [0, 10], [0, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneOutlineEarly = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneFillLate = interpolate(frame, [40, 60], [0.22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const coneOutlineLate = interpolate(frame, [40, 60], [1, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fillOpacity = frame < 40 ? coneFill : coneFillLate;
  const outlineOpacity = frame < 40 ? coneOutlineEarly : coneOutlineLate;

  const photoOpacity = interpolate(
    frame,
    [10, 20, 40, 60],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const photoScale = interpolate(frame, [10, 20], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const points = conePolygon(anchorX, anchorY, coneAngleDegrees);
  const center = photoCenter(anchorX, anchorY, coneAngleDegrees);

  const photoW = 380;
  const photoH = 260;

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
          left: center.x - photoW / 2,
          top: center.y - photoH / 2,
          width: photoW,
          height: photoH,
          opacity: photoOpacity,
          transform: `scale(${photoScale})`,
          transformOrigin: "center center",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
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

      {caption && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 60,
            textAlign: "center",
            color: tokens.mute,
            fontFamily: fontStack,
            fontSize: 22,
            opacity: photoOpacity,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
