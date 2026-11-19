import { describe, expect, it } from 'vitest';
import {
  ART,
  CLOSED_SHIFT,
  DESIGNS,
  LID_EXTREMES,
  LID_GEOM,
  OPEN_MAX,
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
  openingAt,
  openingClearance,
  pupilClearance,
  whitesOverlap,
} from './eye-art';
import {
  ASLEEP_AFTER,
  BLINK_EVERY,
  BLINK_MS,
  DOUBLE_ODDS,
  DROOP,
  DROP_HIDE,
  DROOP_MS,
  DROWSY_AFTER,
  REACH,
  SLEEP_STAGGER,
  TRAVEL,
  WAKE_STAGGER,
  aim,
  blinkClosure,
  calmMatrix,
  dropReveal,
  blinkInterval,
  blinkLength,
  eyeTiming,
  irisOffset,
  isLooking,
  isOpen,
  lidPose,
  lidSlide,
  lidsSettled,
  planClosure,
  scheduleBlinks,
  stageAt,
  stepLids,
  toEyeFrame,
  touching,
  wakePlan,
  type Blink,
  type Lids,
  type Stage,
} from './eyes';

describe('eye designs', () => {
  it('has exactly the six designs, each fully drawn', () => {
    expect(DESIGNS).toEqual(['cobalt', 'sage', 'yellow', 'waves', 'petals', 'spikes']);
    for (const d of DESIGNS) for (const layer of ['upper', 'lower', 'lid', 'cover'] as const) expect(ART[d][layer].length, `${d} ${layer}`).toBeGreaterThan(0);
  });
  it('gives the wave lid cobalt crests, a lighter inner wave line and an inked curl per crest', () => {
    expect(ART.waves.calm).toContain('fill="#1F4FA8"');
    expect(ART.waves.calm).toContain('stroke="#7FA3DE"');
    expect((ART.waves.calm.match(/fill="#16110D"/g) ?? []).length).toBeGreaterThanOrEqual(3);
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
    const wedges = ((ART.spikes.upper + ART.spikes.lower).match(/Q[^"]*Z" fill="#16110D"/g) ?? []).length;
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

describe('gaze', () => {
  const far = (deg: number) => aim(Math.cos((deg * Math.PI) / 180) * 5000, Math.sin((deg * Math.PI) / 180) * 5000);
  /** Iris offset and the opening with the lids posed for that gaze */
  const at = ([h, v]: [number, number]) => ({ iris: irisOffset(h, v), poly: openingAt(lidPose(h, v)) });
  const atRest = irisVisible(0, 0);

  it('looks straight ahead when the pointer is on the eye', () => {
    expect(irisOffset(...aim(0, 0))).toEqual([0, 0]);
  });
  it('keeps the pupil and both catchlights fully visible at full up, down and all four diagonals', () => {
    for (const deg of [270, 90, 225, 315, 45, 135]) {
      const { iris, poly } = at(far(deg));
      expect(pupilClearance(...iris, poly), `${deg}°`).toBeGreaterThan(1);
    }
  });
  it('keeps the pupil clear in every direction, and everywhere inside the travel range', () => {
    expect(pupilClearance(0, 0)).toBeGreaterThan(1);
    for (let deg = 0; deg < 360; deg += 3) {
      const { iris, poly } = at(far(deg));
      expect(pupilClearance(...iris, poly), `${deg}°`).toBeGreaterThan(1);
    }
    // Easing passes through the inside of the range: check a grid of it
    for (let h = -1; h <= 1; h += 0.125)
      for (let v = -1; v <= 1; v += 0.125) {
        if (h ** 4 + v ** 4 > 1) continue;
        const { iris, poly } = at([h, v]);
        expect(pupilClearance(...iris, poly), `${h},${v}`).toBeGreaterThan(1);
      }
  });
  it('keeps at least two thirds of the iris that shows at rest visible, in every direction', () => {
    expect(atRest).toBeGreaterThan(0.74);
    for (let deg = 0; deg < 360; deg += 6) {
      const { iris, poly } = at(far(deg));
      expect(irisVisible(...iris, poly, 1) / atRest, `${deg}°`).toBeGreaterThanOrEqual(0.66);
    }
  });
  it('presses the iris into each corner at full horizontal deflection', () => {
    for (const deg of [0, 180]) {
      const { iris, poly } = at(far(deg));
      expect(Math.abs(iris[0])).toBeGreaterThanOrEqual(38);
      const tuck = irisTuck(...iris, poly);
      expect(tuck, `${deg}°`).toBeGreaterThan(0.12);
      expect(tuck, `${deg}°`).toBeLessThan(0.17);
    }
  });
  it('travels up and down about 35–40% as far as sideways', () => {
    const side = Math.abs(far(0)[0] * TRAVEL.outer);
    expect(-irisOffset(...far(270))[1] / side).toBeGreaterThanOrEqual(0.33);
    expect(irisOffset(...far(90))[1] / side).toBeLessThanOrEqual(0.4);
    expect(irisOffset(...far(90))[1] / side).toBeGreaterThanOrEqual(0.35);
  });
  it('moves both ways on a diagonal, along the almond', () => {
    const [x1, y1] = irisOffset(...far(225)); // up and in
    const [x2, y2] = irisOffset(...far(315)); // up and out
    expect(x1).toBeLessThan(-30);
    expect(x2).toBeGreaterThan(30);
    // Higher than looking straight sideways (which follows the midline down), lower than straight up
    expect(y1).toBeLessThan(irisOffset(...far(180))[1] - 5);
    expect(y2).toBeLessThan(irisOffset(...far(0))[1] - 5);
    expect(y1).toBeGreaterThan(irisOffset(...far(270))[1]);
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

describe('lids follow the gaze', () => {
  const apexY = (poly: [number, number][], upper: boolean) => (upper ? Math.min(...poly.slice(0, 48).map((p) => p[1])) : Math.max(...poly.slice(48).map((p) => p[1])));
  const rest = openingAt(lidPose(0, 0));
  it('lifts the upper lid looking up and lowers it looking down; the lower lid moves less', () => {
    const up = lidPose(0, -1);
    const down = lidPose(0, 1);
    expect(up.upper).toBeLessThan(-8);
    expect(down.upper).toBeGreaterThan(4);
    expect(Math.abs(up.lower)).toBeLessThan(Math.abs(up.upper));
    expect(Math.abs(down.lower)).toBeLessThan(Math.abs(down.upper));
    expect(Math.sign(up.lower)).toBe(-1);
    expect(Math.sign(down.lower)).toBe(1);
    expect(lidPose(1, 0)).toEqual({ upper: 0, lower: 0, corners: 0 });
  });
  it('moves the drawn lid lines by those amounts, in that direction', () => {
    const up = openingAt(lidPose(0, -1));
    const down = openingAt(lidPose(0, 1));
    expect(apexY(up, true) - apexY(rest, true)).toBeCloseTo(lidPose(0, -1).upper, 0);
    expect(apexY(down, true) - apexY(rest, true)).toBeCloseTo(lidPose(0, 1).upper, 0);
    expect(apexY(up, false)).toBeLessThan(apexY(rest, false));
    expect(apexY(down, false)).toBeGreaterThan(apexY(rest, false));
  });
  it('rests exactly on the drawn opening', () => {
    for (const [x, y] of rest) expect(Math.abs(openingClearance(x, y)), `${x},${y}`).toBeLessThan(0.6);
  });
  it('draws the white big enough for every pose (the lids cover the rest)', () => {
    for (const pose of [lidPose(0, 0), ...LID_EXTREMES, lidPose(0.5, -0.5), lidPose(-0.7, 0.7)])
      for (const [x, y] of openingAt(pose)) {
        // every point of the posed opening, nudged inward, is inside the white
        const cx = 80;
        const cy = 62;
        expect(inWhite(x + (cx - x) * 0.02, y + (cy - y) * 0.02), `${x},${y}`).toBe(true);
      }
  });
  it('closes from any pose: the lid line clears the lower lid, then the painting lands', () => {
    for (const pose of [lidPose(0, 0), ...LID_EXTREMES]) {
      const poly = openingAt(pose);
      const tallest = apexY(poly, false) - apexY(poly, true);
      expect(lidSlide(1, pose, LID_GEOM) - LID_GEOM.extra).toBeGreaterThanOrEqual(tallest);
    }
    expect(lidSlide(1, lidPose(0, 0), LID_GEOM)).toBeCloseTo(CLOSED_SHIFT);
    // A third closed covers about a third of the opening
    expect(lidSlide(DROOP, lidPose(0, 0), LID_GEOM) / LID_GEOM.travel).toBeCloseTo(DROOP, 1);
  });
});

/** Is a point inside the largest opening (the white)? */
function inWhite(x: number, y: number) {
  let inside = false;
  for (let i = 0, j = OPEN_MAX.length - 1; i < OPEN_MAX.length; j = i++) {
    const [xi, yi] = OPEN_MAX[i];
    const [xj, yj] = OPEN_MAX[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

describe('closed-lid art', () => {
  it('paints every design’s closed lid', () => {
    for (const d of DESIGNS) {
      expect(ART[d].lid, d).toContain(`translate(0 ${(-CLOSED_SHIFT).toFixed(1)})`);
      const art = ART[d].lid.split(`translate(0 ${(-CLOSED_SHIFT).toFixed(1)})`)[1];
      expect((art.match(/<(path|circle|ellipse)/g) ?? []).length, d).toBeGreaterThanOrEqual(1);
    }
  });
  it('matches each design: wing, crests, sun, flower, vine, starburst', () => {
    const art = (d: (typeof DESIGNS)[number]) => ART[d].lid.split(`translate(0 ${(-CLOSED_SHIFT).toFixed(1)})`)[1];
    expect((art('waves').match(/stroke="#7FA3DE" stroke-width="3"/g) ?? []).length).toBe(3); // three light-blue wave lines
    expect((art('cobalt').match(/fill="#F3E6CC"/g) ?? []).length).toBe(3); // a cream crescent moon and two stars
    expect(art('yellow')).toMatch(/<circle[^>]*var\(--eyes-bg\)/); // the sun's disc
    expect((art('petals').match(/<ellipse/g) ?? []).length).toBe(6); // six petals
    expect((art('sage').match(/Q/g) ?? []).length).toBeGreaterThanOrEqual(10); // five leaves
    expect((ART.cobalt.drop.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(9); // fanned lashes
    expect((ART.spikes.drop.match(/fill="#16110D"/g) ?? []).length).toBeGreaterThanOrEqual(5); // hanging wedges
  });
});

describe('calming wave crests', () => {
  it('keeps the open wave eye exactly as drawn: the crests sit over a flat cobalt base', () => {
    expect(ART.waves.calm).toContain('stroke="#7FA3DE"');
    expect(ART.waves.behind).not.toContain('#7FA3DE');
    for (const d of DESIGNS) if (d !== 'waves') expect(ART[d].calm, d).toBe('');
  });
  it('flattens the crests onto the corner line as the eye shuts, and only then', () => {
    expect(calmMatrix(1, LID_GEOM).map((n) => n + 0)).toEqual([0, 1, 0]);
    const [b, d, e] = calmMatrix(0, LID_GEOM);
    for (const x of [14, 80, 146]) for (const y of [-20, 10, 40]) expect(b * x + d * y + e).toBeCloseTo(LID_GEOM.a + LID_GEOM.m * x);
    expect(dropReveal(DROOP)).toBe(0); // drowsy eyes keep their waves
    expect(dropReveal(1)).toBe(1);
  });
});

describe('sleep', () => {
  const T = eyeTiming(3);
  const open: Lids = { closure: 0, plan: null, t: 0 };
  /** Runs one eye through a stage for `ms`, from `stageMs` into it */
  const run = (l: Lids, stage: Stage, ms: number, timing = T, from = 0, step = 16) => {
    for (let t = 0; t < ms; t += step) l = stepLids(l, stage, from + t, step, timing);
    return l;
  };
  it('goes awake → drowsy at ~10 s (or when the pointer leaves) → asleep at ~30 s', () => {
    expect(stageAt(9_000, false)).toBe('awake');
    expect(stageAt(DROWSY_AFTER, false)).toBe('drowsy');
    expect(stageAt(100, true)).toBe('drowsy');
    expect(stageAt(29_000, false)).toBe('drowsy');
    expect(stageAt(ASLEEP_AFTER, false)).toBe('asleep');
    expect(stageAt(ASLEEP_AFTER, true)).toBe('asleep');
  });
  it('droops a third closed over ~1.5 s while drowsy, pupils still showing', () => {
    let l = run(open, 'drowsy', DROOP_MS - 100);
    expect(l.closure).toBeLessThan(DROOP);
    l = run(l, 'drowsy', 200);
    expect(l.closure).toBe(DROOP);
    expect(lidsSettled(l, 'drowsy')).toBe(true);
  });
  it('closes all the way once asleep, each eye on its own turn within ~3 s', () => {
    const drowsy = run(open, 'drowsy', 2000);
    const timings = Array.from({ length: 40 }, (_, i) => eyeTiming(i));
    const delays = timings.map((t) => t.sleepDelay);
    expect(Math.min(...delays)).toBeLessThan(500);
    expect(Math.max(...delays)).toBeGreaterThan(2400);
    expect(Math.max(...delays)).toBeLessThanOrEqual(SLEEP_STAGGER);
    for (const t of timings) {
      const before = run(drowsy, 'asleep', Math.max(0, t.sleepDelay - 50), t);
      expect(before.closure).toBe(DROOP); // still waiting its turn
      const after = run(drowsy, 'asleep', SLEEP_STAGGER + 2000, t);
      expect(after.closure).toBe(1);
      expect(isLooking(after, 'asleep')).toBe(false);
    }
  });
  it('wakes groggy from asleep: slowly to half, one or two flutters, a pause, then open and looking', () => {
    for (const flutters of [1, 2] as const) {
      const p = wakePlan(1, flutters);
      const trace: number[] = [];
      for (let t = 0; planClosure(p, t) !== null; t += 10) trace.push(planClosure(p, t)!);
      const total = trace.length * 10;
      expect(total).toBeGreaterThan(1300);
      expect(total).toBeLessThan(2400);
      // Reaches half after a slow ~0.6 s open
      expect(trace[30]).toBeGreaterThan(0.6);
      expect(trace[60]).toBeCloseTo(0.5, 1);
      // Flutters: partial closes from half (never shut), counted as local peaks
      const peaks = trace.filter((c, i) => i > 0 && i < trace.length - 1 && c > trace[i - 1] && c >= trace[i + 1] && c > 0.6);
      expect(peaks.length).toBe(flutters);
      for (const c of peaks) expect(c).toBeLessThan(0.95);
      // It only looks at the cursor once it opens fully
      expect(p.lookAt).toBeGreaterThan(total - 400);
      expect(planClosure(p, total + 10)).toBeNull();
    }
  });
  it('wakes quicker from drowsy, with just one flutter', () => {
    const p = wakePlan(DROOP, 2);
    const trace: number[] = [];
    for (let t = 0; planClosure(p, t) !== null; t += 10) trace.push(planClosure(p, t)!);
    expect(trace.length * 10).toBeLessThan(700);
    const peaks = trace.filter((c, i) => i > 0 && i < trace.length - 1 && c > trace[i - 1] && c >= trace[i + 1]);
    expect(peaks.length).toBe(1);
  });
  it('wakes the band one by one over ~1–1.5 s, then every eye is open and looking', () => {
    const timings = Array.from({ length: 40 }, (_, i) => eyeTiming(i));
    const starts: number[] = [];
    for (const t of timings) {
      let l: Lids = { closure: 1, plan: null, t: 0 };
      let started = -1;
      for (let ms = 0; ms < 6000; ms += 16) {
        l = stepLids(l, 'awake', ms, 16, t);
        if (l.plan && started < 0) started = ms;
      }
      starts.push(started);
      expect(isOpen(l)).toBe(true);
      expect(isLooking(l, 'awake')).toBe(true);
    }
    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThan(900);
    expect(Math.max(...starts)).toBeLessThanOrEqual(WAKE_STAGGER + 16);
  });
  it('goes back to drowsy if the pointer leaves mid-wake', () => {
    let l: Lids = { closure: 1, plan: null, t: 0 };
    l = run(l, 'awake', 800, { ...T, wakeDelay: 0 });
    expect(l.plan).not.toBeNull();
    l = run(l, 'drowsy', 3000);
    expect(l.plan).toBeNull();
    expect(l.closure).toBe(DROOP);
  });
});

describe('blinks', () => {
  it('closes and reopens in about 150ms; a double blink twice in quick succession', () => {
    expect(BLINK_MS).toBe(150);
    expect(blinkClosure(0)).toBe(0);
    expect(blinkClosure(BLINK_MS / 2)).toBeCloseTo(1);
    expect(blinkClosure(BLINK_MS)).toBe(0);
    const len = blinkLength(true);
    expect(len).toBeLessThan(450);
    expect(blinkClosure(BLINK_MS / 2, true)).toBeCloseTo(1);
    expect(blinkClosure(len - BLINK_MS / 2, true)).toBeCloseTo(1);
    expect(blinkClosure(BLINK_MS + 30, true)).toBe(0); // open between the two
  });
  it('gives each eye its own 10–15 s clock from the seed, jittered each time', () => {
    const bases = Array.from({ length: 60 }, (_, i) => eyeTiming(i).blinkBase);
    expect(new Set(bases.map((b) => Math.round(b / 100))).size).toBeGreaterThan(20);
    expect(eyeTiming(5)).toEqual(eyeTiming(5)); // fixed seed
    for (const b of bases)
      for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
        const i = blinkInterval(b, r);
        expect(i).toBeGreaterThanOrEqual(BLINK_EVERY.min);
        expect(i).toBeLessThanOrEqual(BLINK_EVERY.max);
      }
    expect(blinkInterval(12_000, 0)).not.toBe(blinkInterval(12_000, 0.9));
  });

  /** Simulates a whole pattern blinking for `ms`, frame by frame */
  function simulate(ms: number, canBlink: (i: number, now: number) => boolean = () => true) {
    const placed = PATTERNS.find((p) => p.L.key === 'd')!.placed;
    const neighbors = placed.map((a) => placed.flatMap((b, j) => (a !== b && touching(a, b) ? [j] : [])));
    const bases = placed.map((_, i) => eyeTiming(i).blinkBase);
    const r = rngFor(42);
    const blinks: Blink[] = bases.map((b) => ({ next: r() * b, start: -Infinity, double: false }));
    const starts: number[][] = placed.map(() => []);
    const frames: number[][] = [];
    let doubles = 0;
    let total = 0;
    for (let now = 0; now < ms; now += 16) {
      scheduleBlinks(blinks, bases, neighbors, now, r, (i) => canBlink(i, now));
      const shut: number[] = [];
      blinks.forEach((b, i) => {
        if (b.start === now) {
          starts[i].push(now);
          total++;
          if (b.double) doubles++;
        }
        if (blinkClosure(now - b.start, b.double) > 0) shut.push(i);
      });
      frames.push(shut);
    }
    return { placed, neighbors, starts, frames, doubles, total };
  }
  const rngFor = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  };

  const sim = simulate(10 * 60_000);
  it('keeps every eye blinking every 10–15 s', () => {
    for (const s of sim.starts) {
      expect(s.length).toBeGreaterThan(30);
      for (let k = 1; k < s.length; k++) {
        expect(s[k] - s[k - 1]).toBeGreaterThanOrEqual(BLINK_EVERY.min);
        expect(s[k] - s[k - 1]).toBeLessThanOrEqual(BLINK_EVERY.max);
      }
    }
  });
  it('always has some blinking going on across the band', () => {
    const busySeconds = new Set(sim.frames.flatMap((f, i) => (f.length ? [Math.floor((i * 16) / 1000)] : [])));
    expect(busySeconds.size).toBeGreaterThan(590);
  });
  it('makes about one blink in six a double', () => {
    expect(sim.doubles / sim.total).toBeGreaterThan(DOUBLE_ODDS * 0.8);
    expect(sim.doubles / sim.total).toBeLessThan(DOUBLE_ODDS * 1.2);
  });
  it('never blinks two touching eyes in the same frame', () => {
    for (const shut of sim.frames)
      for (const i of shut) for (const j of sim.neighbors[i]) expect(shut.includes(j), `${i} and ${j}`).toBe(false);
  });
  it('never blinks while an eye is drowsy, asleep or waking', () => {
    // Eyes 0–39 are "asleep or waking" from 60 s to 120 s
    const closed = (i: number, now: number) => i < 40 && now >= 60_000 && now < 120_000;
    const s = simulate(180_000, (i, now) => !closed(i, now));
    s.starts.forEach((ts, i) => {
      for (const t of ts) expect(closed(i, t), `eye ${i} at ${t}ms`).toBe(false);
    });
    // and they pick blinking back up afterwards
    for (let i = 0; i < 40; i++) expect(s.starts[i].some((t) => t >= 120_000)).toBe(true);
  });
  it('lets only fully open eyes blink', () => {
    expect(isOpen({ closure: 0, plan: null, t: 0 })).toBe(true);
    expect(isOpen({ closure: DROOP, plan: null, t: 0 })).toBe(false);
    expect(isOpen({ closure: 0.5, plan: wakePlan(1, 1), t: 100 })).toBe(false);
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

describe('markup sync', () => {
  it('starts the hanging lashes hidden exactly as far up as eyes.ts slides them from', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../components/EyesBand.astro', import.meta.url), 'utf8');
    expect(css).toContain(`transform: translate(0, -${DROP_HIDE}px);`);
  });
});
