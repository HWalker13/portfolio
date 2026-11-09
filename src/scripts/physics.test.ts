import { describe, expect, it } from 'vitest';
import {
  PARAMS,
  RPM_33,
  approach,
  clampDt,
  clampVelocity,
  isAtRest,
  normalizeAngle,
  pointerAngle,
  releaseVelocity,
  shortestDelta,
  stepArm,
  stepPlatter,
  unwrap,
  type PlatterState,
} from './physics';

/** Run the platter forward for `seconds` at a fixed frame rate. */
function simulate(state: PlatterState, motorOn: boolean, seconds: number, fps = 60): PlatterState {
  let s = state;
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) s = stepPlatter(s, motorOn, 1 / fps);
  return s;
}

describe('constants', () => {
  it('33⅓ RPM is one rotation every 1.8 s', () => {
    expect(RPM_33).toBeCloseTo(200, 10);
    expect(360 / RPM_33).toBeCloseTo(1.8, 10);
  });
});

describe('clampDt', () => {
  it('passes normal frame times through', () => {
    expect(clampDt(1 / 60)).toBeCloseTo(1 / 60);
  });
  it('caps long gaps (tab switch) at maxDt', () => {
    expect(clampDt(4.2)).toBe(PARAMS.maxDt);
    expect(clampDt(4.2, 0.05)).toBe(0.05);
  });
  it('treats negative, NaN and infinite deltas as 0', () => {
    expect(clampDt(-0.01)).toBe(0);
    expect(clampDt(Number.NaN)).toBe(0);
    expect(clampDt(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('angles', () => {
  it('normalizes into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-10)).toBe(350);
    expect(normalizeAngle(-720)).toBe(0);
  });
  it('finds the shortest signed delta across the 0/360 seam', () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
    expect(shortestDelta(0, 180)).toBe(-180);
  });
  it('unwraps a pointer circling past 180°', () => {
    let a = 170;
    for (const raw of [179, -179, -170]) a = unwrap(a, raw);
    expect(a).toBeCloseTo(190);
  });
  it('measures pointer angle in screen coordinates (clockwise positive)', () => {
    expect(pointerAngle(0, 0, 1, 0)).toBeCloseTo(0);
    expect(pointerAngle(0, 0, 0, 1)).toBeCloseTo(90); // below center = clockwise on screen
    expect(pointerAngle(0, 0, -1, 0)).toBeCloseTo(180);
  });
});

describe('approach (exponential easing)', () => {
  it('moves toward the target without overshooting', () => {
    const v = approach(1000, 200, 2.5, 0.1);
    expect(v).toBeLessThan(1000);
    expect(v).toBeGreaterThan(200);
  });
  it('is frame-rate independent: two half steps equal one full step', () => {
    const one = approach(1000, 200, 2.5, 1 / 30);
    const two = approach(approach(1000, 200, 2.5, 1 / 60), 200, 2.5, 1 / 60);
    expect(two).toBeCloseTo(one, 10);
  });
  it('dt = 0 changes nothing', () => {
    expect(approach(123, 200, 2.5, 0)).toBe(123);
  });
});

describe('stepPlatter', () => {
  it('holds steady at 33⅓ RPM with the motor on', () => {
    const s = simulate({ angle: 0, velocity: RPM_33 }, true, 1.8);
    expect(s.velocity).toBeCloseTo(RPM_33, 6);
    expect(shortestDelta(0, s.angle)).toBeCloseTo(0, 6); // exactly one rotation in 1.8 s
  });

  it('spins up from rest to near 33⅓ in about a second', () => {
    const s = simulate({ angle: 0, velocity: 0 }, true, 1);
    expect(s.velocity / RPM_33).toBeGreaterThan(0.9);
  });

  it('winds down to a full stop in about a second when the motor is off', () => {
    const at07 = simulate({ angle: 0, velocity: RPM_33 }, false, 0.7);
    expect(at07.velocity).toBeGreaterThan(0); // still coasting
    const at10 = simulate({ angle: 0, velocity: RPM_33 }, false, 1.0);
    expect(at10.velocity).toBe(0); // snapped to rest
    expect(isAtRest(at10, false)).toBe(true);
  });

  it('a fast flick keeps momentum, then eases back to 33⅓', () => {
    const flick = simulate({ angle: 0, velocity: 2000 }, true, 0.2);
    expect(flick.velocity).toBeGreaterThan(1000); // still well above speed
    const settled = simulate(flick, true, 3);
    expect(Math.abs(settled.velocity - RPM_33)).toBeLessThan(1);
  });

  it('a backwards scratch reverses through zero and comes back up to speed', () => {
    let s: PlatterState = { angle: 0, velocity: -1500 };
    let crossedZero = false;
    for (let i = 0; i < 240; i++) {
      s = stepPlatter(s, true, 1 / 60);
      if (s.velocity > 0) crossedZero = true;
    }
    expect(crossedZero).toBe(true);
    expect(s.velocity).toBeCloseTo(RPM_33, -1);
  });

  it('clamps a huge frame gap so a returning tab does not jump', () => {
    const s = stepPlatter({ angle: 0, velocity: RPM_33 }, true, 5);
    expect(s.angle).toBeCloseTo(RPM_33 * PARAMS.maxDt, 6); // 10°, not 1000°
  });

  it('gives the same result at 60 Hz and 120 Hz', () => {
    const a = simulate({ angle: 0, velocity: 1800 }, true, 1, 60);
    const b = simulate({ angle: 0, velocity: 1800 }, true, 1, 120);
    expect(b.velocity).toBeCloseTo(a.velocity, 6);
    expect(Math.abs(shortestDelta(a.angle, b.angle))).toBeLessThan(0.5);
  });
});

describe('releaseVelocity', () => {
  it('measures angular speed over the recent window', () => {
    const samples = [
      { t: 0.0, angle: 0 },
      { t: 0.02, angle: 20 },
      { t: 0.04, angle: 40 },
      { t: 0.06, angle: 60 },
    ];
    expect(releaseVelocity(samples, 0.06)).toBeCloseTo(1000);
  });
  it('works backwards too', () => {
    const samples = [
      { t: 0.0, angle: 0 },
      { t: 0.05, angle: -25 },
    ];
    expect(releaseVelocity(samples, 0.05)).toBeCloseTo(-500);
  });
  it('is 0 when the pointer was held still before release', () => {
    const samples = [
      { t: 0.0, angle: 0 },
      { t: 0.02, angle: 30 },
    ];
    expect(releaseVelocity(samples, 0.5)).toBe(0);
  });
  it('ignores a single sample', () => {
    expect(releaseVelocity([{ t: 1, angle: 10 }], 1)).toBe(0);
  });
  it('caps absurd flicks', () => {
    const samples = [
      { t: 0, angle: 0 },
      { t: 0.01, angle: 500 },
    ];
    expect(releaseVelocity(samples, 0.01)).toBe(PARAMS.maxVelocity);
    expect(clampVelocity(-1e9)).toBe(-PARAMS.maxVelocity);
  });
});

describe('stepArm', () => {
  it('swings onto the record when the motor starts and settles exactly', () => {
    let a = 0;
    for (let i = 0; i < 120; i++) a = stepArm(a, true, 0, 27, 1 / 60);
    expect(a).toBe(27);
  });
  it('lifts back to rest when the motor stops', () => {
    let a = 27;
    for (let i = 0; i < 120; i++) a = stepArm(a, false, 0, 27, 1 / 60);
    expect(a).toBe(0);
  });
});
