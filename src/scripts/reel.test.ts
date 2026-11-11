import { describe, expect, it } from 'vitest';
import { cardPose, reelIndex, STEP_DEG } from './reel';

describe('reelIndex', () => {
  const centers = [500, 1500, 2500, 3500];
  it('clamps before the first and after the last section', () => {
    expect(reelIndex(0, centers)).toBe(0);
    expect(reelIndex(9000, centers)).toBe(3);
  });
  it('is a whole number when a section is centered', () => {
    expect(reelIndex(1500, centers)).toBe(1);
  });
  it('interpolates between sections, so the next card bends in gradually', () => {
    expect(reelIndex(2000, centers)).toBeCloseTo(1.5);
    expect(reelIndex(2250, centers)).toBeCloseTo(1.75);
  });
  it('handles sections of different heights', () => {
    expect(reelIndex(700, [500, 900, 2000])).toBeCloseTo(0.5);
  });
});

describe('cardPose', () => {
  it('leaves the focused card flat, sharp and at full size', () => {
    const p = cardPose(0, 400);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0);
    expect(p.rotX).toBeCloseTo(0);
    expect(p.scale).toBe(1);
    expect(p.blur).toBe(0);
    expect(p.fringe).toBe(0);
    expect(p.opacity).toBe(1);
  });
  it('rolls the next card below and away, tipping its bottom edge back', () => {
    const p = cardPose(1, 400);
    expect(p.y).toBeGreaterThan(0);
    expect(p.z).toBeLessThan(0);
    expect(p.rotX).toBe(-STEP_DEG);
    expect(p.scale).toBeLessThan(1);
    expect(p.blur).toBeGreaterThan(0);
  });
  it('is symmetric for cards above', () => {
    const below = cardPose(1, 400);
    const above = cardPose(-1, 400);
    expect(above.y).toBeCloseTo(-below.y);
    expect(above.z).toBeCloseTo(below.z);
    expect(above.rotX).toBe(STEP_DEG);
  });
  it('hides cards far from the focus', () => {
    expect(cardPose(3, 400).hidden).toBe(true);
    expect(cardPose(2, 400).hidden).toBe(false);
  });
});
