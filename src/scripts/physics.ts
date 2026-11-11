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
  /** How far the record turned in the last step, unwrapped (°). Drives the needle. */
  delta?: number;
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
  const delta = ((state.velocity + velocity) / 2) * dt;
  const angle = normalizeAngle(state.angle + delta);
  return { angle, velocity, delta };
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

/** Ease the tonearm toward a target angle; snaps when it's within 0.05°. */
export function stepArm(armAngle: number, target: number, rawDt: number, p: Params = PARAMS): number {
  const next = approach(armAngle, target, p.armK, clampDt(rawDt, p.maxDt));
  return Math.abs(next - target) < 0.05 ? target : next;
}

/* ── The needle: rotation → progress through the side → groove radius → arm angle ───────── */

/**
  A side is about 30 rotations: 30 × 1.8 s = 54 s if left alone. Real sides run ~20 minutes;
  this is compressed so a visitor actually sees the needle travel and the record change.
*/
export const SIDE_ROTATIONS = 30;
export const SIDE_DEGREES = SIDE_ROTATIONS * 360;

/**
  Turntable geometry, in the SVG's 500 × 400 plinth units.
  `stylus` is the stylus tip relative to the pivot when the arm is at 0° (resting).
*/
export const ARM_GEOMETRY = {
  pivot: { x: 430, y: 70 },
  center: { x: 200, y: 200 },
  stylus: { x: -8, y: 236 },
  /** Outermost groove (lead-in) and innermost (run-out), as radii from the record center */
  leadIn: 152,
  runOut: 86,
} as const;
export type ArmGeometry = typeof ARM_GEOMETRY;

/** Where the stylus tip is when the arm is rotated `deg` clockwise (screen coordinates). */
export function stylusPosition(deg: number, g: ArmGeometry = ARM_GEOMETRY) {
  const t = (deg * Math.PI) / 180;
  const { x, y } = g.stylus;
  return { x: g.pivot.x + x * Math.cos(t) - y * Math.sin(t), y: g.pivot.y + x * Math.sin(t) + y * Math.cos(t) };
}

/**
  The arm angle that puts the stylus at distance `r` from the record center.
  Pivot, record center and stylus form a triangle with two known sides (pivot→center,
  pivot→stylus) and the third side = r. The law of cosines gives the angle at the pivot;
  of the two solutions, the smaller one is the arm swinging in over the record.
*/
export function armAngleForRadius(r: number, g: ArmGeometry = ARM_GEOMETRY): number {
  const dx = g.pivot.x - g.center.x;
  const dy = g.pivot.y - g.center.y;
  const D = Math.hypot(dx, dy);
  const L = Math.hypot(g.stylus.x, g.stylus.y);
  const cosPhi = Math.max(-1, Math.min(1, (r * r - D * D - L * L) / (2 * D * L)));
  const t = Math.atan2(dy, dx) + Math.acos(cosPhi) - Math.atan2(g.stylus.y, g.stylus.x);
  const deg = (t * 180) / Math.PI;
  return ((deg % 360) + 540) % 360 - 180;
}

/** Grooves are evenly spaced, so radius falls linearly as the side plays. */
export function needleRadius(progress: number, g: ArmGeometry = ARM_GEOMETRY): number {
  const p = Math.max(0, Math.min(1, progress));
  return g.leadIn - p * (g.leadIn - g.runOut);
}

/** Arm angle for a given progress through the side (0 = lead-in, 1 = run-out). */
export function needleAngle(progress: number, g: ArmGeometry = ARM_GEOMETRY): number {
  return armAngleForRadius(needleRadius(progress, g), g);
}

/**
  Advance progress by how far the record turned. Forward spins move the needle in,
  a backwards scratch moves it back out. With the needle up (motor stopped, or mid-swap),
  turning the record by hand doesn't move it.
*/
export function stepProgress(progress: number, deltaDeg: number, needleDown: boolean): number {
  if (!needleDown || !Number.isFinite(deltaDeg)) return progress;
  return Math.max(0, Math.min(1, progress + deltaDeg / SIDE_DEGREES));
}

/** The needle has reached the run-out groove. */
export function isEndOfSide(progress: number): boolean {
  return progress >= 1;
}

export interface Tonearm {
  angle: number;
  /** In the groove. While down, the arm angle is exactly needleAngle(progress). */
  down: boolean;
}

/**
  Motor on: swing toward the groove and drop into it once there (cueing).
  Down: ride the groove exactly. Motor off: lift and swing back to rest.
*/
export function stepTonearm(arm: Tonearm, motorOn: boolean, progress: number, rawDt: number, restAngle = 0): Tonearm {
  if (!motorOn) return { angle: stepArm(arm.angle, restAngle, rawDt), down: false };
  const groove = needleAngle(progress);
  if (arm.down) return { angle: groove, down: true };
  const angle = stepArm(arm.angle, groove, rawDt);
  return { angle, down: Math.abs(angle - groove) < 0.3 };
}

/* ── The queue and the record swap ───────────────────────────────────────────────────────── */

/** Next record in the queue, looping back to the first after the last. */
export function nextIndex(index: number, length: number): number {
  return length > 0 ? (index + 1) % length : 0;
}

/**
  The swap, in seconds (3.0 total): the motor winds down and the arm returns, the record slides
  off into the sleeve, the next one slides out of it, then the motor spins up and the arm cues.
*/
export const SWAP_PHASES = [
  { phase: 'stopping', duration: 0.8 },
  { phase: 'unloading', duration: 0.6 },
  { phase: 'loading', duration: 0.6 },
  { phase: 'starting', duration: 1.0 },
] as const;
export type SwapPhase = (typeof SWAP_PHASES)[number]['phase'];
export const SWAP_DURATION = SWAP_PHASES.reduce((t, p) => t + p.duration, 0);

/**
  Default slide distance, in record heights. On the home page the turntable measures the real
  distance to the stage's bottom edge once per swap (the sleeve covers everything below it).
*/
export const SLIDE_DISTANCE = 1.9;

/** null = no swap running. Elapsed is simulated time, so a hidden tab pauses the swap. */
export type Swap = { elapsed: number } | null;

/** Start a swap, unless one is already running (then the press is ignored). */
export function requestSwap(swap: Swap): { swap: Swap; accepted: boolean } {
  if (swap) return { swap, accepted: false };
  return { swap: { elapsed: 0 }, accepted: true };
}

/** Which phase a swap is in, and how far through it (0–1). */
export function swapPhaseAt(elapsed: number): { phase: SwapPhase; t: number } {
  let start = 0;
  for (const p of SWAP_PHASES) {
    if (elapsed < start + p.duration) return { phase: p.phase, t: (elapsed - start) / p.duration };
    start += p.duration;
  }
  return { phase: 'starting', t: 1 };
}

/**
  Advance a running swap. `changeRecord` is true on exactly one step: the one that crosses into
  'loading', when the record is out of sight and the label can change.
*/
export function advanceSwap(
  swap: Swap,
  rawDt: number,
  p: Params = PARAMS,
): { swap: Swap; phase: SwapPhase | null; t: number; changeRecord: boolean; done: boolean } {
  if (!swap) return { swap: null, phase: null, t: 0, changeRecord: false, done: false };
  const before = swapPhaseAt(swap.elapsed).phase;
  const elapsed = swap.elapsed + clampDt(rawDt, p.maxDt);
  if (elapsed >= SWAP_DURATION) {
    return { swap: null, phase: null, t: 1, changeRecord: before !== 'loading' && before !== 'starting', done: true };
  }
  const { phase, t } = swapPhaseAt(elapsed);
  const changeRecord = phase === 'loading' && before !== 'loading';
  return { swap: { elapsed }, phase, t, changeRecord, done: false };
}

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Record offset (in record heights) for a swap phase: out on 'unloading', back on 'loading'. */
export function recordSlide(phase: SwapPhase | null, t: number, distance = SLIDE_DISTANCE): number {
  if (phase === 'unloading') return distance * easeIn(t);
  if (phase === 'loading') return distance * (1 - easeOut(t));
  return 0;
}
