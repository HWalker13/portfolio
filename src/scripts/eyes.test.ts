import { describe, expect, it } from 'vitest';
import {
  ART,
  DESIGNS,
  IRISES,
  IRIS_ART,
  IRIS_C,
  IRIS_R,
  MAX_ROT,
  OPENING,
  PATTERNS,
  PITCH,
  SIZE_JITTER,
  VB,
  irisTuck,
  irisVisible,
  pupilClearance,
  whitesOverlap,
} from './eye-art';
import {
  BLINK_MS,
  DROOP,
  DROOP_MS,
  REACH,
  SLEEP_AFTER,
  WAKE_MS,
  aim,
  blinkClosure,
  blinkDelay,
  irisOffset,
  pickBlinkEye,
  stepLid,
  toEyeFrame,
  wakeStep,
  type Wake,
} from './eyes';

describe('eye designs', () => {
  it('has exactly the six designs, each fully drawn', () => {
    expect(DESIGNS).toEqual(['cobalt', 'sage', 'yellow', 'waves', 'petals', 'spikes']);
    for (const d of DESIGNS) expect(ART[d].front.length).toBeGreaterThan(0);
  });
  it('gives the wave lid cobalt crests, a lighter inner wave line and an inked curl per crest', () => {
    expect(ART.waves.behind).toContain('fill="#1F4FA8"');
    expect(ART.waves.behind).toContain('stroke="#7FA3DE"');
    expect((ART.waves.behind.match(/fill="#16110D"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it('draws six iris colors, each with hatching, a limbal ring, a pupil and a catchlight', () => {
    expect(IRISES).toEqual(['blue', 'brown', 'green', 'hazel', 'greyBlue', 'amber']);
    for (const c of IRISES) {
      const a = IRIS_ART[c];
      expect(a).toContain('stroke-width="0.7"'); // radial pen hatching
      expect(a).toContain('stroke-width="2.8"'); // limbal ring
      expect(a).toMatch(/r="13\.5" fill="#16110D"/); // pupil
      expect(a).toContain('<ellipse'); // catchlight
    }
    // Hazel: gold-brown at the pupil fading out to green
    expect(IRIS_ART.hazel).toContain('radialGradient');
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
    it(`${L.key}: uses all six designs, the wave variant included`, () => {
      expect(new Set(placed.map((e) => e.design))).toEqual(new Set(DESIGNS));
    });
    it(`${L.key}: never gives two touching eyes the same iris color`, () => {
      for (const a of placed)
        for (const b of placed) {
          if (a === b) continue;
          const touching = Math.abs(a.col - b.col) <= 1 && Math.abs(a.cy - b.cy) < py * 1.01 && !(a.col === b.col && Math.abs(a.row - b.row) > 1);
          if (touching) expect(a.iris === b.iris, `${a.col},${a.row} vs ${b.col},${b.row}`).toBe(false);
        }
    });
    it(`${L.key}: shows several iris colors on every design`, () => {
      for (const d of DESIGNS) expect(new Set(placed.filter((e) => e.design === d).map((e) => e.iris)).size, d).toBeGreaterThanOrEqual(2);
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

describe('side-eye travel', () => {
  const far = (deg: number) => irisOffset(...aim(Math.cos((deg * Math.PI) / 180) * 5000, Math.sin((deg * Math.PI) / 180) * 5000));
  const atRest = irisVisible(0, 0);

  it('looks straight ahead when the pointer is on the eye', () => {
    expect(irisOffset(...aim(0, 0))).toEqual([0, 0]);
  });
  it('keeps the pupil and both catchlights fully visible, clear of the lids, in every direction', () => {
    expect(pupilClearance(0, 0)).toBeGreaterThan(1);
    for (let deg = 0; deg < 360; deg += 3) expect(pupilClearance(...far(deg)), `${deg}°`).toBeGreaterThan(1);
  });
  it('keeps at least two thirds of the iris that shows at rest visible, in every direction', () => {
    // The upper lid already covers the iris's top at rest (~23%); full side-eye keeps ≥ 68% of the rest
    expect(atRest).toBeGreaterThan(0.74);
    for (let deg = 0; deg < 360; deg += 3) expect(irisVisible(...far(deg)) / atRest, `${deg}°`).toBeGreaterThanOrEqual(0.66);
  });
  it('presses the iris into each corner at full horizontal deflection', () => {
    for (const deg of [0, 180]) {
      const [x] = far(deg);
      expect(Math.abs(x)).toBeGreaterThanOrEqual(38); // more than 3× the old ±12
      const tuck = irisTuck(...far(deg));
      expect(tuck, `${deg}°`).toBeGreaterThan(0.12);
      expect(tuck, `${deg}°`).toBeLessThan(0.17);
    }
  });
  it('travels wide sideways and only a little up or down', () => {
    expect(Math.abs(far(0)[0])).toBeGreaterThan(5 * Math.abs(far(90)[1]));
    expect(Math.abs(far(270)[1])).toBeLessThan(1); // the upper lid keeps the top of the iris
    expect(far(90)[1]).toBeLessThanOrEqual(5);
  });
  it('still strains hard sideways on a diagonal', () => {
    expect(Math.abs(far(225)[0])).toBeGreaterThan(30);
  });
  it('reaches full deflection by REACH px, easing in on the way', () => {
    expect(REACH).toBeGreaterThanOrEqual(150);
    expect(REACH).toBeLessThanOrEqual(200);
    const x = (d: number) => Math.abs(irisOffset(...aim(d, 0))[0]);
    expect(x(REACH)).toBeCloseTo(x(5000));
    expect(x(REACH / 4)).toBeLessThan(x(REACH / 2));
    expect(x(REACH / 2)).toBeLessThan(x(REACH));
    expect(x(10)).toBeLessThan(5); // no snap near the eye
  });
});

describe('blinks', () => {
  it('waits 2–5 s between blinks', () => {
    expect(blinkDelay(0)).toBe(2000);
    expect(blinkDelay(0.9999)).toBeLessThanOrEqual(5000);
  });
  it('never picks the same eye twice in a row', () => {
    let last = -1;
    for (let i = 0; i < 2000; i++) {
      const next = pickBlinkEye(7, last, Math.random());
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(7);
      last = next;
    }
    // Every eye can be picked
    const picks = new Set(Array.from({ length: 6 }, (_, k) => pickBlinkEye(7, 3, (k + 0.5) / 6)));
    expect(picks.size).toBe(6);
    expect(picks.has(3)).toBe(false);
  });
  it('closes and reopens in about 150ms', () => {
    expect(BLINK_MS).toBe(150);
    expect(blinkClosure(0)).toBe(0);
    expect(blinkClosure(BLINK_MS / 2)).toBeCloseTo(1);
    expect(blinkClosure(BLINK_MS)).toBe(0);
  });
});

describe('sleepy eyes', () => {
  const idle = (state: Wake, idleMs: number) => wakeStep(state, { idleMs, left: false, moved: false });
  it('stays awake while the pointer is recent, droops after about 10 s idle, wakes on a move', () => {
    let s: Wake = 'awake';
    s = idle(s, 9000);
    expect(s).toBe('awake');
    s = idle(s, SLEEP_AFTER);
    expect(s).toBe('drooping');
    s = idle(s, SLEEP_AFTER + 5000);
    expect(s).toBe('drooping');
    s = wakeStep(s, { idleMs: 0, left: false, moved: true });
    expect(s).toBe('awake');
  });
  it('droops as soon as the pointer leaves the window', () => {
    expect(wakeStep('awake', { idleMs: 100, left: true, moved: false })).toBe('drooping');
  });
  it('droops to half closed over ~1.5 s and opens quickly', () => {
    let c = 0;
    let t = 0;
    while (c < DROOP) {
      c = stepLid(c, DROOP, 16);
      t += 16;
    }
    expect(c).toBe(DROOP);
    expect(t).toBeGreaterThanOrEqual(DROOP_MS - 16);
    expect(t).toBeLessThanOrEqual(DROOP_MS + 16);
    let back = 0;
    while (c > 0) {
      c = stepLid(c, 0, 16);
      back += 16;
    }
    expect(back).toBeLessThanOrEqual(WAKE_MS);
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
