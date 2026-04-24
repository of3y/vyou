// Heading math for VYou.
//
// The DeviceOrientationEvent API reports three Euler angles (alpha, beta,
// gamma) in ZXY intrinsic order. A single "compass heading" value — the
// azimuth of the top edge of the device — only matches the back-camera
// bearing when the phone is held roughly upright in portrait. Pitch and roll
// break that shortcut and introduce systematic heading errors.
//
// We compute the back-camera bearing from the full 3D pose instead. See
// docs/heading-math.md for the derivation and sanity checks.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * Compute the azimuth of the back camera (negative-z axis in the device body
 * frame) in the world frame, given the three DeviceOrientationEvent angles.
 *
 * Returns degrees in [0, 360), measured clockwise from true north.
 */
export function cameraBearingFromDeviceOrientation(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): number {
  const a = alphaDeg * DEG;
  const b = betaDeg * DEG;
  const c = gammaDeg * DEG;
  const sA = Math.sin(a);
  const cA = Math.cos(a);
  const sB = Math.sin(b);
  const sC = Math.sin(c);
  const cC = Math.cos(c);
  // Rz(a) Rx(b) Ry(c) applied to the back-camera axis (0, 0, -1).
  // World frame: +x east, +y north, +z up.
  const east = -sC * cA - sA * sB * cC;
  const north = -sC * sA + cA * sB * cC;
  let bearing = Math.atan2(east, north) * RAD;
  if (bearing < 0) bearing += 360;
  return bearing;
}

/**
 * iOS Safari reports `alpha` relative to an arbitrary session start, but
 * `webkitCompassHeading` is the absolute azimuth of the device's top edge.
 * Reconstruct an absolute alpha compatible with cameraBearingFromDeviceOrientation.
 *
 * Valid when the device is not upside-down (|beta| < 90). Good enough for
 * the capture pose; we fall back to the raw compass heading in extreme poses.
 */
export function absoluteAlphaFromCompassHeading(compassHeadingDeg: number): number {
  return (360 - compassHeadingDeg + 360) % 360;
}
