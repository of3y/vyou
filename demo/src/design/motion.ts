import { interpolate, spring, type SpringConfig } from "remotion";

// Shared motion vocabulary for all VYU design components.
// Components self-drive from useCurrentFrame; helpers below keep the
// timing language consistent (entrance springs, pulse loops, press scales).

export const SPRING: SpringConfig = {
  damping: 18,
  mass: 0.7,
  stiffness: 110,
  overshootClamping: false,
};

export const SPRING_FIRM: SpringConfig = {
  damping: 22,
  mass: 0.6,
  stiffness: 160,
  overshootClamping: true,
};

// 0..1 spring driven by frame, with optional delay.
export const enterSpring = (
  frame: number,
  fps: number,
  delayFrames = 0,
  config: SpringConfig = SPRING
) =>
  spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config,
  });

// Continuous pulse 0..1..0 with `period` in frames.
export const pulseLoop = (frame: number, periodFrames: number) => {
  const t = (frame % periodFrames) / periodFrames;
  // Sin curve eased to spend more time near 0 (matches CSS @keyframes pulse feel).
  return Math.pow(Math.sin(t * Math.PI), 2);
};

// Press scale — returns 1 normally, dips to 0.97 around `pressFrame` over 8 frames.
export const pressScale = (frame: number, pressFrame?: number) => {
  if (pressFrame === undefined) return 1;
  const local = frame - pressFrame;
  if (local < 0 || local > 8) return 1;
  return interpolate(local, [0, 3, 8], [1, 0.97, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

// Cone-sweep reveal helper: returns the half-angle (in degrees) of the cone
// that should currently be drawn, easing from 0 to `targetHalfAngle` over
// `durationFrames`.
export const coneSweep = (
  frame: number,
  fps: number,
  targetHalfAngle: number,
  durationFrames = 24
) => {
  const t = enterSpring(frame, fps, 0, SPRING_FIRM);
  return targetHalfAngle * t;
};
