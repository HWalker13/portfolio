/*
  Turntable physics. Pure functions only: no DOM, no time source, no globals.
  Angles are degrees, velocities are degrees/second, time is seconds.
  Everything here is unit-tested in physics.test.ts.
*/

/** 33⅓ RPM = 33.333 rotations / 60 s = one rotation every 1.8 s = 200°/s. */
export const RPM_33 = 360 / 1.8;

export const PARAMS = {
  /** How hard the motor pulls the platter toward 33⅓ (per second). ~92% of the way there after 1 s. */
  motorK: 2.5,
  /** Braking with the motor off. exp(-4.6 · 1 s) ≈ 1%, so a stop takes about 1 s. */
  brakeK: 4.6,
  /** How fast the tonearm swings between rest and the record. */
  armK: 6,
  /**
    Below this speed (°/s) with the motor off, call it stopped so the loop can sleep.
    3°/s is 0.05° per frame, so the snap to 0 can't be seen, and with brakeK it lands right at ~0.9 s.
  */
  restEpsilon: 3,
  /** Cap on a flick so a wild swipe can't spin the record at absurd speeds. 8 rotations/s. */
  maxVelocity: 2880,
  /** Longest frame step we'll simulate. A backgrounded tab can report seconds; clamping stops a jump. */
  maxDt: 0.05,
  /** Only pointer samples this recent count toward release velocity. */
  sampleWindow: 0.08,
} as const;

export type Params = typeof PARAMS;

export interface PlatterState {
  /** Current rotation, normalized to [0, 360). */
  angle: number;
  /** Angular velocity in °/s. Positive is clockwise on screen. */
  velocity: number;
}

export interface PointerSample {
  /** Time in seconds. */
  t: number;
  /** Unwrapped pointer angle in degrees (can go past 360 or below 0). */
  angle: number;
}

/** Clamp a frame delta to [0, maxDt]. Negative deltas (clock weirdness) become 0. */
export function clampDt(dt: number, maxDt: number = PARAMS.maxDt): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(dt, maxDt);
}

/** Wrap any angle into [0, 360). */
export function normalizeAngle(deg: number): number {
  const a = deg % 360;
  // `+ 0` turns -0 into 0.
  return a < 0 ? a + 360 : a + 0;
}

/** Signed shortest rotation from `from` to `to`, in [-180, 180). */
export function shortestDelta(from: number, to: number): number {
  return normalizeAngle(to - from + 180) - 180;
}

/**
  Exponential approach of `value` toward `target`:
    v' = target + (v - target) · e^(-k·dt)
  This is the exact solution of dv/dt = -k(v - target), so the result is the same
  whether you take one 32 ms step or two 16 ms steps. That makes the feel
  independent of frame rate (60 Hz vs 120 Hz displays behave identically).
*/
export function approach(value: number, target: number, k: number, dt: number): number {
  return target + (value - target) * Math.exp(-k * dt);
}

/** Advance an angle by velocity over dt, normalized. */
export function stepAngle(angle: number, velocity: number, dt: number): number {
  return normalizeAngle(angle + velocity * dt);
}

/** Motor torque target: 33⅓ RPM when on, 0 when off. */
export function targetVelocity(motorOn: boolean): number {
  return motorOn ? RPM_33 : 0;
}

/** Clamp velocity to ±max. */
export function clampVelocity(v: number, max: number = PARAMS.maxVelocity): number {
  return Math.max(-max, Math.min(max, v));
}

/**
  One physics step for a free-spinning platter (nobody is holding it).
  Motor on: the motor pulls velocity toward 33⅓ RPM, whether the record is going too fast,
  too slow, or backwards after a scratch.
  Motor off: friction brakes it to 0, and it snaps to exactly 0 once it's slow enough.
*/
export function stepPlatter(
  state: PlatterState,
  motorOn: boolean,
  rawDt: number,
  p: Params = PARAMS,
): PlatterState {
  const dt = clampDt(rawDt, p.maxDt);
  const k = motorOn ? p.motorK : p.brakeK;
  let velocity = approach(state.velocity, targetVelocity(motorOn), k, dt);
  if (!motorOn && Math.abs(velocity) < p.restEpsilon) velocity = 0;
  // Use the average of old and new velocity so the angle matches the velocity curve closely.
  const angle = stepAngle(state.angle, (state.velocity + velocity) / 2, dt);
  return { angle, velocity };
}

/** True when the platter is fully at rest and the animation loop can sleep. */
export function isAtRest(state: PlatterState, motorOn: boolean): boolean {
  return !motorOn && state.velocity === 0;
}

/** Pointer position → angle (degrees) around a center. 0° = pointing right, clockwise positive (screen coords). */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/**
  Continue an unwrapped angle with a new raw (wrapped) reading, so a pointer circling
  the center keeps accumulating (350° → 370°) instead of jumping back to 10°.
*/
export function unwrap(previousUnwrapped: number, rawAngle: number): number {
  return previousUnwrapped + shortestDelta(previousUnwrapped, rawAngle);
}

/**
  Release velocity from recent pointer samples: average angular speed over the last
  `window` seconds. If the pointer stopped moving before release, this returns 0,
  because holding still and then letting go shouldn't fling the record.
*/
export function releaseVelocity(
  samples: readonly PointerSample[],
  releaseTime: number,
  p: Params = PARAMS,
): number {
  const recent = samples.filter((s) => releaseTime - s.t <= p.sampleWindow);
  if (recent.length < 2) return 0;
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const span = last.t - first.t;
  if (span < 0.005) return 0;
  return clampVelocity((last.angle - first.angle) / span, p.maxVelocity);
}

/** Tonearm angle: rests at `restAngle`, swings to `playAngle` when the motor is on. */
export function stepArm(
  armAngle: number,
  motorOn: boolean,
  restAngle: number,
  playAngle: number,
  rawDt: number,
  p: Params = PARAMS,
): number {
  const target = motorOn ? playAngle : restAngle;
  const next = approach(armAngle, target, p.armK, clampDt(rawDt, p.maxDt));
  return Math.abs(next - target) < 0.05 ? target : next;
}
