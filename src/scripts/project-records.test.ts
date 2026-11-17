import { describe, expect, it } from 'vitest';
import { REST, SPIN, isResting, stepSpin, type Spin } from './project-records';
import { RPM_33 } from './physics';

const DT = 1 / 60;
/** Run n frames with a fixed `active`, returning every state. */
function run(s: Spin, active: boolean, frames: number): Spin[] {
  const out: Spin[] = [];
  for (let i = 0; i < frames; i++) out.push((s = stepSpin(s, active, DT)));
  return out;
}

describe('stepSpin', () => {
  it('stays put at rest when inactive', () => {
    expect(stepSpin(REST, false, DT)).toBe(REST);
  });

  it('spins up toward 33⅓ RPM while active, and never past it', () => {
    const states = run(REST, true, 240);
    const v = states.map((s) => s.velocity);
    expect(v.every((x, i) => i === 0 || x >= v[i - 1])).toBe(true);
    expect(Math.max(...v)).toBeLessThanOrEqual(RPM_33);
    expect(v.at(-1)!).toBeGreaterThan(RPM_33 * 0.99);
  });

  it('keeps the angle in [0, 360) while spinning', () => {
    expect(run(REST, true, 600).every((s) => s.angle >= 0 && s.angle < 360)).toBe(true);
  });

  it('eases to a stop exactly upright, only turning forward and never speeding up', () => {
    const spinning = run(REST, true, 300).at(-1)!;
    const stopping = run(spinning, false, 600);
    const end = stopping.findIndex(isResting);
    expect(end).toBeGreaterThan(0);
    expect(stopping[end]).toEqual(REST);
    const path = stopping.slice(0, end);
    expect(path.every((s, i) => i === 0 || s.angle >= path[i - 1].angle)).toBe(true);
    expect(path.every((s, i) => i === 0 || s.velocity <= path[i - 1].velocity + 1e-9)).toBe(true);
    // From full speed: at most one extra turn plus braking, so well under 3 s
    expect(end * DT).toBeLessThan(3);
  });

  it('finishes a barely started turn within a few seconds', () => {
    const blip = run(REST, true, 3).at(-1)!;
    const end = run(blip, false, 600).findIndex(isResting);
    expect(end).toBeGreaterThan(0);
    expect(end * DT).toBeLessThan(360 / SPIN.minCoast + 1.5);
  });

  it('picks the spin back up if re-activated while stopping', () => {
    const spinning = run(REST, true, 300).at(-1)!;
    const braking = run(spinning, false, 20).at(-1)!;
    expect(braking.stopAt).not.toBeNull();
    const again = stepSpin(braking, true, DT);
    expect(again.stopAt).toBeNull();
    expect(again.angle).toBeGreaterThanOrEqual(0);
    expect(again.angle).toBeLessThan(360);
  });

  it('survives a huge frame gap (backgrounded tab) without jumping', () => {
    const spinning = run(REST, true, 300).at(-1)!;
    const next = stepSpin(spinning, true, 30);
    expect(Math.abs(next.angle - spinning.angle) % 360).toBeLessThanOrEqual(RPM_33 * 0.05 + 1e-6);
  });
});
