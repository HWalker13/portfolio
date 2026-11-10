import { describe, expect, it } from 'vitest';
import records from '../data/records.json';
import {
  ARM_GEOMETRY,
  PARAMS,
  RPM_33,
  SIDE_DEGREES,
  SLIDE_DISTANCE,
  SWAP_DURATION,
  advanceSwap,
  armAngleForRadius,
  isEndOfSide,
  needleAngle,
  needleRadius,
  nextIndex,
  recordSlide,
  requestSwap,
  stepProgress,
  stepTonearm,
  stylusPosition,
  type Swap,
  type Tonearm,
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
  it('eases to a target and settles exactly', () => {
    let a = 0;
    for (let i = 0; i < 120; i++) a = stepArm(a, 27, 1 / 60);
    expect(a).toBe(27);
    for (let i = 0; i < 120; i++) a = stepArm(a, 0, 1 / 60);
    expect(a).toBe(0);
  });
});

describe('rotation → needle angle', () => {
  it('solves the arm triangle: the stylus lands at the requested radius', () => {
    for (const r of [ARM_GEOMETRY.leadIn, 120, 100, ARM_GEOMETRY.runOut]) {
      const s = stylusPosition(armAngleForRadius(r));
      expect(Math.hypot(s.x - ARM_GEOMETRY.center.x, s.y - ARM_GEOMETRY.center.y)).toBeCloseTo(r, 6);
    }
  });

  it('starts at the lead-in (~24°) and ends at the run-out (~40°), swinging steadily inward', () => {
    expect(needleAngle(0)).toBeCloseTo(23.78, 1);
    expect(needleAngle(1)).toBeCloseTo(39.85, 1);
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const a = needleAngle(p);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });

  it('maps rotation to progress: 30 rotations is the whole side', () => {
    expect(SIDE_DEGREES).toBe(30 * 360);
    expect(stepProgress(0, 15 * 360, true)).toBeCloseTo(0.5, 10);
    expect(needleRadius(0.5)).toBeCloseTo((ARM_GEOMETRY.leadIn + ARM_GEOMETRY.runOut) / 2, 10);
  });

  it('left alone at 33⅓ RPM, a side lasts about 54 s', () => {
    let state: PlatterState = { angle: 0, velocity: RPM_33 };
    let progress = 0;
    let t = 0;
    while (!isEndOfSide(progress) && t < 120) {
      state = stepPlatter(state, true, 1 / 60);
      progress = stepProgress(progress, state.delta ?? 0, true);
      t += 1 / 60;
    }
    expect(t).toBeGreaterThan(53.5);
    expect(t).toBeLessThan(54.5);
  });

  it('a forward flick advances the needle further than playing would', () => {
    let fast: PlatterState = { angle: 0, velocity: 2400 };
    let slow: PlatterState = { angle: 0, velocity: RPM_33 };
    let pf = 0.2;
    let ps = 0.2;
    for (let i = 0; i < 60; i++) {
      fast = stepPlatter(fast, true, 1 / 60);
      slow = stepPlatter(slow, true, 1 / 60);
      pf = stepProgress(pf, fast.delta ?? 0, true);
      ps = stepProgress(ps, slow.delta ?? 0, true);
    }
    expect(pf).toBeGreaterThan(ps);
  });
});

describe('backwards scratch', () => {
  it('reduces progress (the needle moves back out)', () => {
    expect(stepProgress(0.5, -720, true)).toBeCloseTo(0.5 - 720 / SIDE_DEGREES, 10);
  });
  it('never goes before the lead-in', () => {
    expect(stepProgress(0.01, -3600, true)).toBe(0);
  });
  it('does nothing with the needle up (motor stopped)', () => {
    expect(stepProgress(0.5, 3600, false)).toBe(0.5);
    expect(stepProgress(0.5, -3600, false)).toBe(0.5);
  });
});

describe('end of side', () => {
  it('is detected at the run-out groove and not before', () => {
    expect(isEndOfSide(0.999)).toBe(false);
    expect(isEndOfSide(1)).toBe(true);
    expect(stepProgress(0.999, 3600, true)).toBe(1); // clamped at the run-out
  });
});

describe('stepTonearm', () => {
  it('cues to the groove, drops in, then rides it exactly', () => {
    let arm: Tonearm = { angle: 0, down: false };
    for (let i = 0; i < 120; i++) arm = stepTonearm(arm, true, 0, 1 / 60);
    expect(arm.down).toBe(true);
    expect(arm.angle).toBe(needleAngle(0));
    arm = stepTonearm(arm, true, 0.5, 1 / 60);
    expect(arm.angle).toBe(needleAngle(0.5)); // rigid in the groove, no lag
  });
  it('lifts and returns to rest when the motor stops', () => {
    let arm: Tonearm = { angle: needleAngle(0.3), down: true };
    for (let i = 0; i < 120; i++) arm = stepTonearm(arm, false, 0.3, 1 / 60);
    expect(arm).toEqual({ angle: 0, down: false });
  });
});

describe('queue', () => {
  it('has the nine records in order, starting with Songs in the Key of Life', () => {
    expect(records).toHaveLength(9);
    expect(records[0]?.album).toBe('Songs in the Key of Life');
    expect(records[8]?.album).toBe('Rubber Soul');
  });
  it('wraps from the last record back to the first', () => {
    expect(nextIndex(0, 9)).toBe(1);
    expect(nextIndex(8, 9)).toBe(0);
    let i = 0;
    for (let k = 0; k < 9; k++) i = nextIndex(i, records.length);
    expect(i).toBe(0);
  });
});

describe('record swap', () => {
  it('ignores a switch while a swap is already running', () => {
    const first = requestSwap(null);
    expect(first.accepted).toBe(true);
    const mid = advanceSwap(first.swap, 0.5).swap;
    const second = requestSwap(mid);
    expect(second.accepted).toBe(false);
    expect(second.swap).toBe(mid); // unchanged: same swap, same elapsed time
  });

  it('runs stopping → unloading → loading → starting in about 3 s, changing the record once', () => {
    let swap: Swap = requestSwap(null).swap;
    const phases: string[] = [];
    let changes = 0;
    let t = 0;
    let done = false;
    while (!done) {
      const r = advanceSwap(swap, 1 / 60);
      swap = r.swap;
      done = r.done;
      t += 1 / 60;
      if (r.changeRecord) {
        changes++;
        expect(r.phase).toBe('loading');
      }
      if (r.phase && phases.at(-1) !== r.phase) phases.push(r.phase);
    }
    expect(phases).toEqual(['stopping', 'unloading', 'loading', 'starting']);
    expect(changes).toBe(1);
    expect(t).toBeCloseTo(SWAP_DURATION, 1);
    expect(SWAP_DURATION).toBeCloseTo(3, 10);
  });

  it('slides the record out of sight and back', () => {
    expect(recordSlide('unloading', 0)).toBe(0);
    expect(recordSlide('unloading', 1)).toBe(SLIDE_DISTANCE);
    expect(recordSlide('loading', 0)).toBe(SLIDE_DISTANCE);
    expect(recordSlide('loading', 1)).toBe(0);
    expect(recordSlide('starting', 0.5)).toBe(0);
    expect(recordSlide('unloading', 1, 2.6)).toBe(2.6); // measured distance on the home page
  });

  it('pauses with the page: a long hidden-tab gap only advances one clamped step', () => {
    const r = advanceSwap({ elapsed: 0.1 }, 10);
    expect(r.swap?.elapsed).toBeCloseTo(0.1 + PARAMS.maxDt, 10);
  });
});
