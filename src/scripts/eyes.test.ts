import { describe, expect, it } from 'vitest';
import { ART, DESIGNS, IRIS_C, IRIS_R, MAX_ROT, OPENING, PATTERNS, PITCH, SIZE_JITTER, VB, whitesOverlap } from './eye-art';
import { TRAVEL_X, TRAVEL_Y, pupilOffset, toEyeFrame } from './eyes';

describe('eye designs', () => {
  it('has exactly the five designs, each fully drawn', () => {
    expect(DESIGNS).toEqual(['cobalt', 'sage', 'yellow', 'petals', 'spikes']);
    for (const d of DESIGNS) {
      expect(ART[d].iris).toContain('<circle');
      expect(ART[d].front.length).toBeGreaterThan(0);
    }
  });
  it('draws the iris at about half the opening width, under the upper lid, meeting the lower lid', () => {
    const xs = OPENING.map((p) => p[0]);
    const width = Math.max(...xs) - Math.min(...xs);
    expect((2 * IRIS_R) / width).toBeGreaterThan(0.45);
    expect((2 * IRIS_R) / width).toBeLessThan(0.55);
    // At the iris center column, the opening runs from the upper lid to the lower lid
    const col = OPENING.filter((p) => Math.abs(p[0] - IRIS_C[0]) < 6).map((p) => p[1]);
    const lidTop = Math.min(...col);
    const lidBottom = Math.max(...col);
    expect(IRIS_C[1] - IRIS_R).toBeLessThan(lidTop - 5); // top hidden under the lid
    expect(Math.abs(IRIS_C[1] + IRIS_R - lidBottom)).toBeLessThan(4); // bottom at the lower lid
  });
  it('gives design (e) filled wedge spikes: 6–8 above and 5–7 below', () => {
    const wedges = (ART.spikes.front.match(/Q[^"]*Z" fill="#16110D"/g) ?? []).length;
    expect(wedges).toBeGreaterThanOrEqual(11);
    expect(wedges).toBeLessThanOrEqual(15);
  });
});

describe('half-drop repeat', () => {
  for (const P of PATTERNS) {
    const { L, placed, px, py, x0, y0, k } = P;
    it(`${L.key}: sits on an even grid with uniform spacing`, () => {
      expect(px / py).toBeCloseTo(PITCH.x / PITCH.y);
      for (const e of placed) {
        expect(e.cx).toBeCloseTo(x0 + e.col * px, 6);
        const drop = Math.abs(e.col % 2) === 1 ? py / 2 : 0;
        expect(e.cy).toBeCloseTo(y0 + drop + e.row * py, 6);
      }
    });
    it(`${L.key}: drops every other column by exactly half a cell`, () => {
      const even = placed.find((e) => e.col === 0 && e.row === 0)!;
      const odd = placed.find((e) => e.col === 1 && e.row === 0)!;
      expect(odd.cy - even.cy).toBeCloseTo(py / 2, 6);
    });
    it(`${L.key}: keeps sizes within ±10% and tilts within ±${MAX_ROT}°`, () => {
      const base = VB.w * k;
      for (const e of placed) {
        expect(Math.abs(e.w / base - 1)).toBeLessThanOrEqual(SIZE_JITTER + 1e-9);
        expect(Math.abs(e.rot)).toBeLessThanOrEqual(MAX_ROT);
      }
    });
    it(`${L.key}: never puts identical designs next to each other (sideways, up/down or diagonal)`, () => {
      for (const a of placed)
        for (const b of placed) {
          if (a === b) continue;
          const touching = Math.abs(a.col - b.col) <= 1 && Math.abs(a.cy - b.cy) < py * 1.01 && !(a.col === b.col && Math.abs(a.row - b.row) > 1);
          if (touching) expect(a.design === b.design, `${a.col},${a.row} vs ${b.col},${b.row}`).toBe(false);
        }
    });
    it(`${L.key}: uses all five designs`, () => {
      expect(new Set(placed.map((e) => e.design))).toEqual(new Set(DESIGNS));
    });
    it(`${L.key}: fills the strip with no empty rows or columns, bleeding off all four edges`, () => {
      const half = (e: (typeof placed)[number]) => e.w / 2;
      expect(Math.min(...placed.map((e) => e.cx - half(e)))).toBeLessThan(0);
      expect(Math.max(...placed.map((e) => e.cx + half(e)))).toBeGreaterThan(L.W);
      // Every column band across the strip has eyes, and each column runs past the top and bottom
      for (let x = 0; x <= L.W; x += 4) expect(placed.some((e) => Math.abs(e.cx - x) <= px / 2 + 1e-6)).toBe(true);
      const cols = new Set(placed.map((e) => e.col));
      for (const c of cols) {
        const ys = placed.filter((e) => e.col === c).map((e) => e.cy);
        expect(Math.min(...ys)).toBeLessThan(py * 0.6);
        expect(Math.max(...ys)).toBeGreaterThan(L.H - py * 0.6);
        // No missing row inside a column
        const rows = placed.filter((e) => e.col === c).map((e) => e.row).sort((a, b) => a - b);
        rows.forEach((r, i) => i && expect(r - rows[i - 1]).toBe(1));
      }
    });
    it(`${L.key}: never overlaps two eye whites`, () => {
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.w + b.w) * 0.8) expect(whitesOverlap(a, b)).toBe(false);
        }
    });
  }
});

describe('pupilOffset', () => {
  it('looks straight ahead when the pointer is on the eye', () => {
    expect(pupilOffset(0, 0)).toEqual([0, 0]);
  });
  it('never leaves its travel ellipse, however far the pointer is', () => {
    const [x, y] = pupilOffset(5000, 5000);
    expect((x / TRAVEL_X) ** 2 + (y / TRAVEL_Y) ** 2).toBeLessThanOrEqual(1.0001);
  });
  it('keeps the big iris inside the opening at full travel', () => {
    const xs = OPENING.map((p) => p[0]);
    expect(IRIS_C[0] - IRIS_R - TRAVEL_X).toBeGreaterThan(Math.min(...xs));
    expect(IRIS_C[0] + IRIS_R + TRAVEL_X).toBeLessThan(Math.max(...xs));
  });
  it('tracks less when the pointer is close', () => {
    expect(Math.abs(pupilOffset(50, 0)[0])).toBeLessThan(Math.abs(pupilOffset(500, 0)[0]));
  });
});

describe('toEyeFrame', () => {
  it('leaves a vector alone for an unrotated eye', () => {
    const [x, y] = toEyeFrame(10, 0, 0);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(0);
  });
  it('turns screen-right into the eye frame of a rotated eye', () => {
    const [x, y] = toEyeFrame(10, 0, Math.PI / 2);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-10);
  });
  it('keeps the length of the vector', () => {
    const [x, y] = toEyeFrame(3, 4, 0.26);
    expect(Math.hypot(x, y)).toBeCloseTo(5);
  });
});
