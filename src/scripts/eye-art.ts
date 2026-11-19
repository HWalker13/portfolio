/*
  The eyes band's art and layout, as plain data, so it can be tested (eyes.test.ts) and rendered
  at build time by EyesBand.astro. Nothing here runs in the browser.

  Style: an original 1960s pop-art textile print. Hand-inked black line work with a clear weight
  hierarchy (heaviest to finest): the upper liner band, then lashes and wedge spikes, then the
  lower lid and crease, then hatching. Irises with fine radiating pen hatching, a dark limbal ring,
  a big pupil and a white catchlight; the upper lid covers the top of the iris.

  Six designs, cycled across a half-drop repeat:
    cobalt ... cobalt-blue lid, the liner's flick extended into a wing
    sage ..... sage-green lid shadow
    yellow ... yellow lid shadow swept up toward the brow
    waves .... the cobalt lid again, its upper edge a row of curling ocean-wave crests
    petals ... the eye framed by a yellow flower-shaped petal shadow
    spikes ... 1960s painted-on lashes: filled black wedges radiating above and below,
               with a heavy liner around the whole eye

  Irises are independent of the makeup: six colors (blue, brown, green, hazel, grey-blue, amber),
  each drawn once, assigned per eye from the seed so no two neighbors share one.

  The iris (with its hatching, pupil and catchlight) is its own layer, `.look`, clipped to the eye
  opening, so when src/scripts/eyes.ts slides it toward the cursor it moves under the lids.

  The lids move too (src/scripts/eyes.ts): they follow the gaze up and down, droop, blink and
  close. So the white and its clip are the LARGEST opening the lids ever leave (OPEN_MAX), and two
  lid-colored shapes hide whatever is shut at the moment: the upper lid (LID_PATH, which also
  carries each design's closed-lid painting, out of sight above the eye until the lid is all the
  way down) and the lower lid (LOWER_PATH). Each design's ink is split to match: `front` stays put
  (crease), `upper` rides on the upper lid (liner, lashes, top wedges), `lower` on the lower lid
  (lower lid line, ticks, bottom wedges, tear duct), and `drop` holds lashes that hang from the
  closed lash line (cobalt, spikes), clipped so they only show below it. The wave design's crests
  are a layer of their own (`calm`) that flattens away as the eye falls asleep.

  Layout: a half-drop repeat, like wallpaper (grid()). Even grid, every other column dropped by
  half a cell, uniform size (±10%) and tilt (±12°) from a fixed seed, designs cycling so no two
  identical eyes touch, and the pattern bleeding off all four edges of the strip.
*/

import { lidMatrix, lidPose, rng, touching, type LidGeom, type LidPose } from './eyes.ts';
export { rng, touching };

// ── Geometry (eye units) ───────────────────────────────────────────────
export const EX = 80; // eye center
export const EY = 62;
/** The box is centered on the eye, so CSS can rotate each eye about its center. */
export const VB = { x: -30, y: -28, w: 220, h: 180 };

type Pt = [number, number];
const f = (n: number) => n.toFixed(1);
const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};
// Inner corner (left, a touch lower) to outer corner (right, a touch higher): an almond.
const INNER: Pt = [14, 66];
const OUTER: Pt = [146, 56];
const top = (t: number) => cubic(INNER, [36, 33], [112, 27], OUTER, t);
const bot = (t: number) => cubic(OUTER, [122, 90], [50, 98], INNER, t); // outer -> inner
/** Unit normal of a curve at t, pointing left of the direction of travel. */
const normalOf = (curve: (t: number) => Pt, t: number): Pt => {
  const a = curve(Math.max(0, t - 0.005));
  const b = curve(Math.min(1, t + 0.005));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
};
const upTop = (t: number) => normalOf(top, t); // top runs inner -> outer, so left is up
const downBot = (t: number) => normalOf(bot, t); // bottom runs outer -> inner, so left is down

/** The eye opening (the white), as a polygon in eye units. */
export const OPENING: Pt[] = [
  ...Array.from({ length: 24 }, (_, i) => top(i / 24)),
  ...Array.from({ length: 24 }, (_, i) => bot(i / 24)),
];
const pathOf = (pts: Pt[]) => `M${pts.map((p) => p.map(f).join(' ')).join(' L')}Z`;

/*
  The iris: about half the opening's width (the opening is 132 units wide; the iris is 66).
  Its top sits well under the upper lid; its bottom just meets the lower lid line.
*/
export const IRIS_R = 33;
export const IRIS_C: Pt = [80, 53];
/** Pupil and catchlights, relative to the iris center. src/scripts/eyes.ts keeps them fully visible. */
export const PUPIL_R = 13.5;
export const CATCHLIGHT = { dx: 9, dy: -3, rx: 5.6, ry: 4.6 } as const;
export const SPARK = { dx: -9, dy: 10, r: 1.9 } as const;

// ── Inks ───────────────────────────────────────────────────────────────
export const INK = {
  ink: '#16110D',
  white: '#FFFDF6',
  /** The moon and stars on the closed cobalt lid (the site's cream) */
  cream: '#F3E6CC',
  shade: '#9A938A',
  cobalt: '#1F4FA8',
  sage: '#9DB48A',
  sageDeep: '#83A06F',
  yellow: '#F2C230',
  /** The wave lid's thin inner wave line */
  waveLight: '#7FA3DE',
} as const;

/** Iris colors (decorative, inside the white). Hazel is a gradient: gold-brown at the pupil, green outside. */
export const IRISES = ['blue', 'brown', 'green', 'hazel', 'greyBlue', 'amber'] as const;
export type IrisColor = (typeof IRISES)[number];
export const IRIS_INK: Record<IrisColor, string> = {
  blue: '#3E73C2',
  brown: '#7A4A26',
  green: '#4F8A47',
  hazel: '#6F8E3E',
  greyBlue: '#7D97AB',
  amber: '#C8891F',
};
const HAZEL_RING = '#A66F2A';
const K = INK.ink;

// ── Pen helpers ────────────────────────────────────────────────────────
/** A filled pen stroke along `curve` (t from a to b) whose width follows `width(u)`, u in 0..1. */
function stroke(curve: (t: number) => Pt, width: (u: number) => number, a = 0, b = 1, n = 28): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a + ((b - a) * i) / n;
    const p = curve(t);
    const nrm = normalOf(curve, t);
    const w = width(i / n) / 2;
    left.push([p[0] + nrm[0] * w, p[1] + nrm[1] * w]);
    right.push([p[0] - nrm[0] * w, p[1] - nrm[1] * w]);
  }
  return pathOf([...left, ...right.reverse()]);
}
const swell = (thin: number, thick: number) => (u: number) => thin + (thick - thin) * Math.sin(Math.PI * u);
const ink = (d: string, color: string = K) => `<path d="${d}" fill="${color}"/>`;
/** A short straight hatch line */
const hatch = (a: Pt, b: Pt, w: number, color: string = K, opacity = 1) =>
  `<path d="M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}" stroke="${color}" stroke-width="${w}" stroke-opacity="${opacity}" stroke-linecap="round"/>`;

/** A pen lash: a curved taper from a thick root to a sharp point. */
function lash(root: Pt, dir: Pt, len: number, curl: Pt, rootWidth: number) {
  const tip: Pt = [root[0] + dir[0] * len + curl[0] * len, root[1] + dir[1] * len + curl[1] * len];
  const ctrl: Pt = [root[0] + dir[0] * len * 0.6, root[1] + dir[1] * len * 0.6];
  const curve = (t: number): Pt => [
    (1 - t) ** 2 * root[0] + 2 * (1 - t) * t * ctrl[0] + t * t * tip[0],
    (1 - t) ** 2 * root[1] + 2 * (1 - t) * t * ctrl[1] + t * t * tip[1],
  ];
  return ink(stroke(curve, (u) => rootWidth * (1 - u) ** 1.3 + 0.12, 0, 1, 10));
}

/** A filled wedge spike (painted-on lash): a solid triangle with slightly curved sides. */
function wedge(root: Pt, dir: Pt, len: number, base: number) {
  const px = -dir[1] * (base / 2);
  const py = dir[0] * (base / 2);
  const tip: Pt = [root[0] + dir[0] * len, root[1] + dir[1] * len];
  const mid: Pt = [root[0] + dir[0] * len * 0.5, root[1] + dir[1] * len * 0.5];
  return `<path d="M${f(root[0] - px)} ${f(root[1] - py)} Q${f(mid[0] - px * 0.35)} ${f(mid[1] - py * 0.35)} ${f(tip[0])} ${f(tip[1])} Q${f(mid[0] + px * 0.35)} ${f(mid[1] + py * 0.35)} ${f(root[0] + px)} ${f(root[1] + py)}Z" fill="${K}"/>`;
}

// ── The liner band: the heaviest line on every eye ─────────────────────
/** Liner thickness along the top lid: thin at the inner corner, thick toward the outer. */
const linerWidth = (t: number, max: number) => 1.4 + max * Math.pow(t, 1.35);
/** Point on the liner band's top edge */
const linerTop = (t: number, max: number): Pt => {
  const p = top(t);
  const n = upTop(t);
  const w = linerWidth(t, max);
  return [p[0] + n[0] * w, p[1] + n[1] * w];
};
/**
  The band sits on the lid line and grows upward, so it never covers the white. At the outer
  corner it runs out into a sharp, tapered flick (longer for the cobalt wing).
*/
function linerBand(max: number, flick: number, lift = 0.55) {
  const n = 30;
  const lower: Pt[] = Array.from({ length: n + 1 }, (_, i) => top(i / n));
  const upper: Pt[] = Array.from({ length: n + 1 }, (_, i) => linerTop(i / n, max));
  const end = upper[n];
  const tip: Pt = [OUTER[0] + flick, OUTER[1] - flick * lift];
  // Flick: from the band's outer top edge, out to the tip, and back along the lid line
  const flickTop: Pt = [(end[0] + tip[0]) / 2 + 1, (end[1] + tip[1]) / 2 - 1];
  return ink(pathOf([...lower, OUTER, [(OUTER[0] + tip[0]) / 2, (OUTER[1] + tip[1]) / 2 + 1.5], tip, flickTop, ...upper.reverse()]));
}

/** Clumped mascara lashes growing from the liner band: short at the inner corner, long at the outer. */
function mascara(max: number, seed: number) {
  const r = rng(seed);
  let out = '';
  // Clumps: pairs and triples sitting close together, small gaps between clumps
  const ts: number[] = [];
  let t = 0.2;
  while (t < 0.97) {
    const clump = 2 + Math.floor(r() * 2);
    for (let i = 0; i < clump && t < 0.97; i++) {
      ts.push(t);
      t += 0.032 + r() * 0.01;
    }
    t += 0.035 + r() * 0.02;
  }
  for (const tt of ts) {
    const root = linerTop(tt, max);
    const n = upTop(tt);
    const len = 5 + 20 * Math.pow(tt, 1.6) + r() * 2;
    // Curve outward (toward the outer corner) and up
    const curl: Pt = [0.25 + 0.55 * tt, -0.15];
    out += lash(root, n, len, curl, 2.2 + 1.2 * tt);
  }
  return out;
}

/** The lower lid: a thin line, a thin inner rim, and a few sparse ticks toward the outer corner. */
function lowerLid(seed: number, ticks = true) {
  const r = rng(seed);
  let out = ink(stroke(bot, swell(0.5, 2.1), 0.02, 0.92));
  // Inner rim: a fine line just inside the lower lid
  const rim = (t: number): Pt => {
    const p = bot(t);
    const n = downBot(t);
    return [p[0] - n[0] * 3.2, p[1] - n[1] * 3.2];
  };
  out += ink(stroke(rim, swell(0.2, 0.9), 0.1, 0.85), K);
  if (ticks)
    for (const t of [0.12, 0.2, 0.29, 0.4]) {
      const n = downBot(t);
      out += lash(bot(t), n, 4 + r() * 2.5, [0.2, 0], 1.5);
    }
  return out;
}

/** The crease: one thin line above the lid, with fine hatching just under the shadow's edge. */
const CREASE = 33;
const creaseCurve = (t: number): Pt => {
  const p = top(t);
  const n = upTop(t);
  const k = CREASE * (0.5 + 0.5 * Math.sin(Math.PI * t));
  return [p[0] + n[0] * k, p[1] + n[1] * k];
};
function crease(seed: number) {
  const r = rng(seed);
  let out = ink(stroke(creaseCurve, swell(0.4, 1.8), 0.1, 0.93));
  for (let i = 0; i < 20; i++) {
    const t = 0.16 + (i / 19) * 0.72;
    const p = creaseCurve(t);
    const n = upTop(t);
    const len = 3 + r() * 3.5;
    // Starts just under the eyeshadow's edge (which stops a sliver below the crease line)
    out += hatch([p[0] - n[0] * 4, p[1] - n[1] * 4], [p[0] - n[0] * (4 + len) - 1, p[1] - n[1] * (4 + len)], 0.6, K, 0.7);
  }
  return out;
}
/**
  Eyeshadow: a filled lid from the liner up to just under the crease line, so the thin crease
  reads on the background above it (a `sweep` lifts the outer end toward the brow).
*/
function lidShadow(color: string, lift = CREASE - 3, sweep = 0) {
  const n = 28;
  const lower = Array.from({ length: n + 1 }, (_, i) => top(i / n));
  const upper = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const p = top(t);
    const nn = upTop(t);
    const k = lift * (0.5 + 0.5 * Math.sin(Math.PI * t)) + sweep * t * t;
    return [p[0] + nn[0] * k, p[1] + nn[1] * k] as Pt;
  });
  return `<path d="${pathOf([...lower, ...upper.reverse()])}" fill="${color}"/>`;
}

/** Grey hatching in the inner and outer corners of the white (static, inside the opening). */
function cornerShade() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const x = 18 + i * 3.2;
    out += hatch([x, 56 + i * 0.6], [x + 6, 78 - i * 0.4], 0.7, INK.shade, 0.85);
  }
  for (let i = 0; i < 7; i++) {
    const x = 142 - i * 3.2;
    out += hatch([x, 52 + i * 0.8], [x - 7, 74 - i * 0.6], 0.7, INK.shade, 0.85);
  }
  return out;
}
/** The upper lid's shadow on the eyeball, a soft band under the lid line (it rides on the lid) */
const lidShade = `<path d="${stroke(top, () => 12, 0.02, 0.98)}" fill="${K}" fill-opacity="0.12" transform="translate(0 5)"/>`;
/** Grey hatching in the corners of the white: static */
export const SHADE = cornerShade();

// ── Moving lids ────────────────────────────────────────────────────────
/** The line through both corners, y = a + m·x: the lids hinge on it (see lidMatrix in eyes.ts). */
const LINE_M = (OUTER[1] - INNER[1]) / (OUTER[0] - INNER[0]);
const LINE_A = INNER[1] - LINE_M * INNER[0];
const fromLine = (p: Pt) => p[1] - (LINE_A + LINE_M * p[0]);
const TOP_PTS = Array.from({ length: 49 }, (_, i) => top(i / 48));
const BOT_PTS = Array.from({ length: 49 }, (_, i) => bot(i / 48));
/** y of a curve (sampled points, x increasing or decreasing) at x */
const yAt = (pts: Pt[], x: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    if ((x - a[0]) * (x - b[0]) <= 0) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  }
  return NaN;
};
/** How much higher the closed-lid art sits than the open lid can show: it lands once the lid passes the lower lid. */
const CLOSED_EXTRA = 45;
export const LID_GEOM: LidGeom = {
  a: LINE_A,
  m: LINE_M,
  top: Math.min(...TOP_PTS.map(fromLine)),
  bot: Math.max(...BOT_PTS.map(fromLine)),
  // Tallest point of the opening, plus a little: the lid line clears the lower lid everywhere
  travel: Math.max(...TOP_PTS.slice(1, -1).map((p) => yAt(BOT_PTS, p[0]) - p[1])) + 2,
  extra: CLOSED_EXTRA,
};
/** The closed-lid art's offset above its closed position (the full slide at rest) */
export const CLOSED_SHIFT = LID_GEOM.travel + CLOSED_EXTRA;

const apply = ([b, d, e]: [number, number, number], p: Pt): Pt => [p[0], b * p[0] + d * p[1] + e];
const upperOf = (pose: LidPose) => lidMatrix(pose.upper, LID_GEOM.top, pose.corners, LID_GEOM);
const lowerOf = (pose: LidPose) => lidMatrix(pose.lower, LID_GEOM.bot, pose.corners, LID_GEOM);
/** The eye opening with the lids in a pose (for the tests). */
export const openingAt = (pose: LidPose): Pt[] => [
  ...TOP_PTS.slice(0, -1).map((p) => apply(upperOf(pose), p)),
  ...BOT_PTS.slice(0, -1).map((p) => apply(lowerOf(pose), p)),
];
/** The poses at the ends of the lids' travel (the transforms are linear in the gaze, so these bound every pose). */
export const LID_EXTREMES = [lidPose(0, -1), lidPose(0, 1)];
/**
  The largest opening: at every x, the highest the upper lid ever goes and the lowest the lower
  lid ever goes. The white and the iris clip use it; the lids cover the rest.
*/
export const OPEN_MAX: Pt[] = [
  ...TOP_PTS.map((p) => [p[0], Math.min(...[lidPose(0, 0), ...LID_EXTREMES].map((q) => apply(upperOf(q), p)[1])) - 0.5] as Pt),
  ...BOT_PTS.map((p) => [p[0], Math.max(...[lidPose(0, 0), ...LID_EXTREMES].map((q) => apply(lowerOf(q), p)[1])) + 0.5] as Pt),
];
export const OPEN_MAX_PATH = pathOf(OPEN_MAX);

/**
  The upper eyelid: everything above the upper lid line (out past both corners), in the design's
  lid color, with an ink lash line along its edge and its shadow on the eyeball below. At rest its
  edge is the lid line; eyes.ts slides it down for droops, blinks and sleep.
*/
const lidEdge = Array.from({ length: 25 }, (_, i) => top(i / 24));
const LID_PATH = pathOf([[INNER[0] - 30, INNER[1]], ...lidEdge, [OUTER[0] + 30, OUTER[1]], [OUTER[0] + 30, -90], [INNER[0] - 30, -90]]);
const LID_EDGE = `M${(INNER[0] - 30).toFixed(1)} ${INNER[1]} L${lidEdge.map((p) => p.map(f).join(' ')).join(' L')} L${(OUTER[0] + 30).toFixed(1)} ${OUTER[1]}`;
/** The lower lid: everything below the lower lid line, in the skin color under it. */
const LOWER_PATH = pathOf([[OUTER[0] + 30, OUTER[1]], ...BOT_PTS, [INNER[0] - 30, INNER[1]], [INNER[0] - 30, 200], [OUTER[0] + 30, 200]]);
/** Where hanging lashes may show: below the lower lid line, out past both corners */
export const BELOW_PATH = LOWER_PATH;

/** The iris layer: base, depth, radiating pen hatching, limbal ring, pupil, catchlight. */
function iris(color: IrisColor) {
  const r = rng(IRISES.indexOf(color) * 131 + 7);
  const [cx, cy] = IRIS_C;
  const R = IRIS_R;
  let lines = '';
  for (let i = 0; i < 84; i++) {
    const a = (i / 84) * Math.PI * 2 + r() * 0.03;
    const r0 = 14 + r() * 1.5;
    const r1 = R - 1.5 - r() * (i % 3 === 0 ? 2 : 9);
    lines += `M${f(cx + Math.cos(a) * r0)} ${f(cy + Math.sin(a) * r0)} L${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)} `;
  }
  // Hazel: a gold-brown ring around the pupil fading out to green. userSpaceOnUse, so the gradient
  // moves with the iris layer when it's translated.
  const hazel =
    color === 'hazel'
      ? `<radialGradient id="iris-hazel-grad" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${R}">` +
        `<stop offset="0.4" stop-color="${HAZEL_RING}"/><stop offset="0.58" stop-color="${HAZEL_RING}"/><stop offset="0.82" stop-color="${IRIS_INK.hazel}"/></radialGradient>`
      : '';
  const fill = color === 'hazel' ? 'url(#iris-hazel-grad)' : IRIS_INK[color];
  return (
    hazel +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="21" fill="#FFFFFF" fill-opacity="0.15"/>` +
    `<path d="${lines}" stroke="${K}" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R - 1.4}" fill="none" stroke="${K}" stroke-width="2.8"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${PUPIL_R}" fill="${K}"/>` +
    `<ellipse cx="${cx + CATCHLIGHT.dx}" cy="${cy + CATCHLIGHT.dy}" rx="${CATCHLIGHT.rx}" ry="${CATCHLIGHT.ry}" fill="${INK.white}"/>` +
    `<circle cx="${cx + SPARK.dx}" cy="${cy + SPARK.dy}" r="${SPARK.r}" fill="${INK.white}" fill-opacity="0.85"/>`
  );
}
export const IRIS_ART: Record<IrisColor, string> = Object.fromEntries(IRISES.map((c) => [c, iris(c)])) as Record<IrisColor, string>;

/**
  A row of breaking wave crests along `curve` (inner -> outer), rising `base(t)` + up to A above
  it: each crest rises slowly, then curls forward (toward the outer corner) into an inked hook with
  a lighter-blue eye, with a thin lighter-blue wave line inside the edge. `fill` paints the cobalt
  between the curve and the crests.
*/
function waveCrests(curve: (t: number) => Pt, base: (t: number) => number, A: number, N: number) {
  const PEAK = 0.72; // each crest rises slowly over most of its period, then breaks forward
  const taper = (t: number) => Math.sqrt(Math.sin(Math.PI * t));
  const phase = (t: number) => {
    const p = t * N;
    return p - Math.floor(p);
  };
  const profile = (ph: number) =>
    ph < PEAK ? Math.sin((Math.PI / 2) * (ph / PEAK)) ** 1.6 : Math.cos((Math.PI / 2) * ((ph - PEAK) / (1 - PEAK))) ** 0.6;
  const edgeH = (t: number, inset = 0) => base(t) + Math.max(0, A * taper(t) * profile(phase(t)) - inset);
  const at = (t: number, h: number): Pt => {
    const p = curve(t);
    const n = normalOf(curve, t);
    return [p[0] + n[0] * h, p[1] + n[1] * h];
  };
  const n = 320;
  const edge = Array.from({ length: n + 1 }, (_, i) => at(i / n, edgeH(i / n)));
  const lower = Array.from({ length: 31 }, (_, i) => curve(i / 30));
  let out = `<path d="${pathOf([...lower, ...[...edge].reverse()])}" fill="${INK.cobalt}"/>`;
  const line = (pts: Pt[]) => `M${pts.map((q) => q.map(f).join(' ')).join(' L')}`;
  // The thin lighter-blue inner wave, following each crest a little inside the edge
  const inner = Array.from({ length: n + 1 }, (_, i) => at(i / n, edgeH(i / n, 4.5))).filter((_, i) => i > 8 && i < n - 8);
  out += `<path d="${line(inner)}" fill="none" stroke="${INK.waveLight}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  // Inked outline along the crests
  out += `<path d="${line(edge.filter((_, i) => i > 2 && i < n - 2))}" fill="none" stroke="${K}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`;
  // At each crest the tip curls over: a tapered pen spiral from the peak, forward, down and back in,
  // with a lighter-blue eye inside the curl
  for (let i = 0; i < N; i++) {
    const tc = (i + PEAK) / N;
    const sc = taper(tc);
    if (sc < 0.6) continue;
    const R0 = A * 0.62 * sc;
    const c = at(tc, edgeH(tc) - R0);
    const tg = curve(Math.min(1, tc + 0.01));
    const tb = curve(Math.max(0, tc - 0.01));
    const ul = Math.hypot(tg[0] - tb[0], tg[1] - tb[1]);
    const u: Pt = [(tg[0] - tb[0]) / ul, (tg[1] - tb[1]) / ul];
    const nu = normalOf(curve, tc);
    const curl = (q: number): Pt => {
      const th = q * Math.PI * 1.9;
      const rho = R0 * (1 - 0.72 * q);
      return [c[0] + u[0] * rho * Math.sin(th) + nu[0] * rho * Math.cos(th), c[1] + u[1] * rho * Math.sin(th) + nu[1] * rho * Math.cos(th)];
    };
    out += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(R0 * 0.5)}" fill="${INK.waveLight}"/>`;
    out += ink(stroke(curl, (q) => 4 * (1 - q) + 0.6, 0, 1, 26));
  }
  return out;
}
/**
  The wave lid: cobalt shadow whose upper edge is a row of four breaking crests. The crests are
  their own layer over a flat cobalt base of the same shape without them, so eyes.ts can calm them
  flat as the eye falls asleep (the closed lid then reads as a smooth lid, not a pucker).
*/
const WAVE_BASE = CREASE - 10;
const waveLid = () => waveCrests(top, (t) => WAVE_BASE * (0.5 + 0.5 * Math.sin(Math.PI * t)), 13, 4);

// ── Closed-lid paintings ───────────────────────────────────────────────
/*
  Drawn where they show once the lid is all the way down: on the lid's surface, which then fills
  the opening, above the closed lash line (the lower lid line). The lid layer carries them
  CLOSED_SHIFT units higher, so they're out of sight above the eye until the lid lands.
*/
/** The closed lash line, inner -> outer, and the "up" side of it */
const lash0 = (t: number) => bot(1 - t);
const upLash = (t: number): Pt => {
  const n = downBot(1 - t);
  return [-n[0], -n[1]];
};
/** A curve across the closed lid, `k` of the way from the lash line up to the open lid line */
const across = (k: number) => (t: number): Pt => {
  const a = lash0(t);
  const b = top(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
};
/** The closed lash line in ink, `w` at its heaviest, sitting just above the lower lid */
const closedLine = (w: number, grow = false) =>
  ink(
    stroke(
      (t) => {
        const p = lash0(t);
        const n = upLash(t);
        const k = grow ? 0.6 + (w / 2) * t ** 1.4 : w / 2;
        return [p[0] + n[0] * k, p[1] + n[1] * k];
      },
      grow ? (u) => 1.2 + w * u ** 1.4 : swell(0.6, w),
      0.03,
      grow ? 1 : 0.97,
    ),
  );
/** A leaf: two arcs from base to tip, filled, with a center vein */
function leaf(base: Pt, dir: Pt, len: number, wide: number, fill: string) {
  const tip: Pt = [base[0] + dir[0] * len, base[1] + dir[1] * len];
  const nx = -dir[1] * wide;
  const ny = dir[0] * wide;
  const m: Pt = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2];
  return (
    `<path d="M${f(base[0])} ${f(base[1])} Q${f(m[0] + nx)} ${f(m[1] + ny)} ${f(tip[0])} ${f(tip[1])} Q${f(m[0] - nx)} ${f(m[1] - ny)} ${f(base[0])} ${f(base[1])}Z" fill="${fill}" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M${f(base[0])} ${f(base[1])} L${f(base[0] + dir[0] * len * 0.8)} ${f(base[1] + dir[1] * len * 0.8)}" stroke="${K}" stroke-width="0.8" stroke-linecap="round"/>`
  );
}
const unit = (x: number, y: number): Pt => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};
/** A crescent: the part of a disc (center c, radius R) outside a second disc offset by `off` (radius r), cream, inked */
function crescent(c: Pt, R: number, off: Pt, r: number) {
  const ic: Pt = [c[0] + off[0], c[1] + off[1]];
  const away = Math.atan2(-off[1], -off[0]); // the moon's fat side
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= 180; i++) {
    const a = away - Math.PI + (i / 180) * 2 * Math.PI;
    const p: Pt = [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R];
    if (Math.hypot(p[0] - ic[0], p[1] - ic[1]) >= r) outer.push(p);
  }
  for (let i = 180; i >= 0; i--) {
    const a = away - Math.PI + (i / 180) * 2 * Math.PI;
    const p: Pt = [ic[0] + Math.cos(a) * r, ic[1] + Math.sin(a) * r];
    if (Math.hypot(p[0] - c[0], p[1] - c[1]) < R) inner.push(p);
  }
  return `<path d="${pathOf([...outer, ...inner])}" fill="${INK.cream}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>`;
}
/** A painted wave line along `curve` (t from a to b), rolling gently, its outer end curling up and back */
function paintedWave(curve: (t: number) => Pt, a: number, b: number) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = a + ((b - a) * i) / 40;
    const p = curve(t);
    const n = normalOf(curve, t);
    const h = 2.9 * Math.sin(((t - a) / (b - a)) * Math.PI * 3);
    pts.push([p[0] + n[0] * h, p[1] + n[1] * h]);
  }
  // The curl: from the end, forward, up and back over itself
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 3];
  const ul = Math.hypot(end[0] - prev[0], end[1] - prev[1]);
  const u: Pt = [(end[0] - prev[0]) / ul, (end[1] - prev[1]) / ul];
  const nu: Pt = [u[1], -u[0]]; // up
  const R0 = 4.2;
  const c: Pt = [end[0] + nu[0] * R0, end[1] + nu[1] * R0];
  for (let i = 1; i <= 24; i++) {
    const q = i / 24;
    const th = q * Math.PI * 1.7;
    const rho = R0 * (1 - 0.55 * q);
    pts.push([c[0] + u[0] * rho * Math.sin(th) - nu[0] * rho * Math.cos(th), c[1] + u[1] * rho * Math.sin(th) - nu[1] * rho * Math.cos(th)]);
  }
  const d = `M${pts.map((p) => p.map(f).join(' ')).join(' L')}`;
  // Light blue, keylined in ink so it reads at band size
  return (
    `<path d="${d}" fill="none" stroke="${K}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${INK.waveLight}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
/** The painting on each design's closed lid (inside the opening) */
function closedArt(d: Design): string {
  const r = rng(DESIGNS.indexOf(d) * 53 + 5);
  switch (d) {
    case 'cobalt': {
      // A long winged liner along the closed lash line, heavier toward the outer corner, where it
      // meets the open eye's wing; above it a small cream crescent moon and two tiny stars
      const [mx, my] = across(0.56)(0.36);
      const star = ([x, y]: Pt, R: number) =>
        `<path d="${pathOf(Array.from({ length: 10 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? R * 0.42 : R;
          return [x + Math.cos(a) * rr, y + Math.sin(a) * rr] as Pt;
        }))}" fill="${INK.cream}" stroke="${K}" stroke-width="0.9" stroke-linejoin="round"/>`;
      return crescent([mx, my], 9.2, [4, -2.4], 7.8) + star(across(0.7)(0.56), 3.9) + star(across(0.38)(0.68), 3) + closedLine(9, true);
    }
    case 'waves':
      // Three light-blue wave lines painted across the lid, each ending in a curl
      return [0.3, 0.55, 0.8].map((k, i) => paintedWave(across(k), 0.16 + i * 0.03, 0.74 - i * 0.04)).join('') + closedLine(3.2);
    case 'yellow': {
      // A small sun with rays
      const [cx, cy] = across(0.5)(0.5);
      let rays = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.13;
        const d0 = 10.5;
        const len = i % 2 ? 5 : 8;
        const dir: Pt = [Math.cos(a), Math.sin(a)];
        rays += ink(stroke((t) => [cx + dir[0] * (d0 + len * t), cy + dir[1] * (d0 + len * t)], (u) => 2.6 * (1 - u) + 0.3, 0, 1, 6));
      }
      return rays + `<circle cx="${f(cx)}" cy="${f(cy)}" r="8" fill="var(--eyes-bg)" stroke="${K}" stroke-width="1.8"/>` + closedLine(3.2);
    }
    case 'petals': {
      // A flower: six white petals round a cobalt center
      const [cx, cy] = across(0.5)(0.52);
      let petals = '';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 360 + 15;
        petals += `<ellipse cx="${f(cx)}" cy="${f(cy - 9)}" rx="5.4" ry="8.6" transform="rotate(${f(a)} ${f(cx)} ${f(cy)})" fill="${INK.white}" stroke="${K}" stroke-width="1.5"/>`;
      }
      return petals + `<circle cx="${f(cx)}" cy="${f(cy)}" r="4.6" fill="${INK.cobalt}" stroke="${K}" stroke-width="1.5"/>` + closedLine(3.2);
    }
    case 'sage': {
      // A vine across the lid with a few leaves
      const vine = (t: number): Pt => {
        const p = across(0.42)(t);
        return [p[0], p[1] + 4 * Math.sin(t * Math.PI * 3)];
      };
      let leaves = '';
      [0.2, 0.36, 0.52, 0.68, 0.84].forEach((t, i) => {
        const p = vine(t);
        const side = i % 2 ? 1 : -1;
        leaves += leaf(p, unit(0.5, -0.86 * side), 15 + r() * 3, 6.2, INK.sage);
      });
      return ink(stroke(vine, swell(0.6, 1.8), 0.1, 0.92)) + leaves + closedLine(3.2);
    }
    case 'spikes':
      // A heavy closed liner, the starburst hangs below it (drop)
      return closedLine(5);
  }
}
/** Lashes that hang from the closed lash line (cobalt: fanned pen lashes; spikes: a sleeping starburst) */
function dropArt(d: Design): string {
  const r = rng(DESIGNS.indexOf(d) * 61 + 3);
  let out = '';
  if (d === 'cobalt')
    for (let i = 0; i < 11; i++) {
      const t = 0.14 + (i / 10) * 0.8; // inner -> outer
      const p = lash0(t);
      const n = downBot(1 - t);
      const fan = (t - 0.45) * 0.9;
      out += lash([p[0] + n[0], p[1] + n[1]], unit(n[0] + fan, n[1]), 9 + 19 * t ** 1.3 + r() * 2, [0.3 * t, 0.12], 2.2 + 1.4 * t);
    }
  if (d === 'spikes')
    for (const t of [0.12, 0.27, 0.42, 0.58, 0.73, 0.88]) {
      const p = lash0(t);
      const n = downBot(1 - t);
      const fan = (t - 0.5) * 1.6;
      out += wedge([p[0] + n[0] * 3, p[1] + n[1] * 3], unit(n[0] + fan, n[1]), 30 + 9 * Math.sin(Math.PI * t) + r() * 4, 8 + r() * 1.5);
    }
  return out;
}

// ── The six designs ────────────────────────────────────────────────────
export const DESIGNS = ['cobalt', 'sage', 'yellow', 'waves', 'petals', 'spikes'] as const;
export type Design = (typeof DESIGNS)[number];

/** Each design's layers (see the header comment) */
export interface EyeArt {
  design: Design;
  behind: string; // under the white (eyeshadow, petals)
  front: string; // static ink over everything (the crease)
  upper: string; // ink riding on the upper lid
  lower: string; // ink riding on the lower lid
  lid: string; // the upper eyelid with its closed-lid painting
  cover: string; // the lower lid
  drop: string; // lashes hanging from the closed lash line ('' if none)
  calm: string; // the wave crests, which calm flat as the eye falls asleep ('' if none)
}
const LINER = 12.5; // the liner band's maximum thickness: the heaviest line on every eye

/** The moving eyelid takes the eyeshadow's color right above the lid line (spikes: the band shows through). */
const LID_FILL: Record<Design, string> = {
  cobalt: INK.cobalt,
  waves: INK.cobalt,
  sage: INK.sageDeep,
  yellow: INK.yellow,
  petals: INK.yellow,
  spikes: 'var(--eyes-bg)',
};

function design(d: Design): EyeArt {
  const seed = DESIGNS.indexOf(d) * 97 + 11;
  const tearDuct = `<path d="M${INNER[0] + 1} ${INNER[1]} q5 -3 9 1" stroke="${K}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  const lid =
    lidShade +
    `<path d="${LID_PATH}" fill="${LID_FILL[d]}"/>` +
    `<path d="${LID_EDGE}" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>` +
    `<g transform="translate(0 ${f(-CLOSED_SHIFT)})">${closedArt(d)}</g>`;
  const cover = `<path d="${LOWER_PATH}" fill="${d === 'petals' ? INK.yellow : 'var(--eyes-bg)'}"/>`;
  const base = { design: d, lid, cover, drop: dropArt(d), calm: '' };
  // The standard upper lid (liner flick, mascara) and lower lid
  const upper = (flick: number) => mascara(LINER, seed + 3) + linerBand(LINER, flick);
  const lower = lowerLid(seed + 2) + tearDuct;
  switch (d) {
    case 'cobalt':
      return { ...base, behind: lidShadow(INK.cobalt), front: crease(seed + 1), upper: upper(30), lower };
    case 'sage':
      return { ...base, behind: lidShadow(INK.sage) + lidShadow(INK.sageDeep, CREASE - 15), front: crease(seed + 1), upper: upper(14), lower };
    case 'yellow':
      return { ...base, behind: lidShadow(INK.yellow, CREASE - 3, 14), front: crease(seed + 1), upper: upper(14), lower };
    case 'waves':
      // The wave crests are the shadow's edge, so this lid has no separate crease line
      return { ...base, behind: lidShadow(INK.cobalt, WAVE_BASE), calm: waveLid(), front: '', upper: upper(22), lower };
    case 'petals': {
      const r = rng(seed);
      let petals = `<ellipse cx="${EX}" cy="${EY}" rx="80" ry="46" fill="${INK.yellow}"/>`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const px = EX + Math.cos(a) * 76;
        const py = EY + Math.sin(a) * 44;
        const rot = (a * 180) / Math.PI + 90;
        petals += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="19" ry="${f(23 + r() * 2)}" transform="rotate(${f(rot)} ${f(px)} ${f(py)})" fill="${INK.yellow}" stroke="${K}" stroke-width="1.8"/>`;
      }
      petals += `<ellipse cx="${EX}" cy="${EY}" rx="76" ry="43" fill="${INK.yellow}"/>`;
      return { ...base, behind: petals, front: crease(seed + 1), upper: upper(14), lower };
    }
    case 'spikes': {
      // 1960s painted-on lashes: filled wedges in a starburst, and a heavy liner around the whole eye
      const r = rng(seed);
      let above = '';
      for (const t of [0.12, 0.27, 0.42, 0.57, 0.72, 0.87, 0.99]) {
        const root = linerTop(t, LINER);
        const n = upTop(t);
        const fan = (t - 0.5) * 0.9;
        const dir: Pt = [n[0] + fan, n[1]];
        const l = Math.hypot(...dir);
        above += wedge(root, [dir[0] / l, dir[1] / l], 30 + 10 * Math.sin(Math.PI * t) + r() * 5, 9 + r() * 2);
      }
      let below = '';
      for (const t of [0.1, 0.26, 0.43, 0.6, 0.78, 0.92]) {
        const p = bot(t);
        const n = downBot(t);
        const fan = (0.5 - t) * 0.9;
        const dir: Pt = [n[0] + fan, n[1]];
        const l = Math.hypot(...dir);
        below += wedge([p[0] + n[0] * 3, p[1] + n[1] * 3], [dir[0] / l, dir[1] / l], 20 + 7 * Math.sin(Math.PI * t) + r() * 4, 7.5 + r() * 1.5);
      }
      // Heavy liner all the way around: the upper band, plus a thick lower band
      const lowerBand = ink(stroke((t) => {
        const p = bot(t);
        const n = downBot(t);
        return [p[0] + n[0] * 2.4, p[1] + n[1] * 2.4];
      }, swell(2, 6), 0, 1));
      return { ...base, behind: '', front: crease(seed + 1), upper: above + linerBand(LINER + 1, 16), lower: below + lowerBand + tearDuct };
    }
  }
}
export const ART: Record<Design, EyeArt> = Object.fromEntries(DESIGNS.map((d) => [d, design(d)])) as Record<Design, EyeArt>;

// ── Half-drop repeat ───────────────────────────────────────────────────
/**
  Grid pitch in eye units: columns 172 apart, rows 132 apart; odd columns drop half a row.
  Tight enough that lashes, wings and petals nearly meet their neighbors, like a printed textile;
  the whites (132 × 52 units) always keep clear of each other.
*/
export const PITCH = { x: 172, y: 132 } as const;
export const MAX_ROT = 12;
export const SIZE_JITTER = 0.1;

export interface Layout {
  key: 'p' | 'm' | 'd';
  W: number;
  H: number;
  /** Rows visible down the strip; sets the scale, so density matches at every width */
  rows: number;
}
export const LAYOUTS: Layout[] = [
  { key: 'p', W: 420, H: 180, rows: 2 },
  { key: 'm', W: 800, H: 190, rows: 2.5 },
  // Desktop is generated 1.4× wider than it shows (EyesBand centers and crops it), so screens up
  // to about 2,000px get more pattern instead of a bigger one.
  { key: 'd', W: 1820, H: 210, rows: 3 },
];

export interface Placed {
  col: number;
  row: number;
  design: Design;
  iris: IrisColor;
  cx: number;
  cy: number;
  w: number;
  rot: number;
}
/** Design for a grid cell: (2·col + row) mod 6 keeps every touching neighbor different. */
export const designAt = (col: number, row: number): Design => DESIGNS[(((2 * col + row) % 6) + 6) % 6];

/** Iris weights per design: the cobalt designs lean blue, every design shows the whole range. */
const irisWeights = (d: Design): number[] => IRISES.map((c) => (c === 'blue' && (d === 'cobalt' || d === 'waves') ? 3 : 1));

/** Seeded iris colors, cell by cell, never repeating a touching neighbor's color. */
function assignIrises(cells: { col: number; row: number; design: Design }[], seed: number): IrisColor[] {
  const r = rng(seed);
  const out: IrisColor[] = [];
  cells.forEach((cell, i) => {
    const taken = new Set(cells.slice(0, i).flatMap((o, j) => (touching(o, cell) ? [out[j]] : [])));
    const w = irisWeights(cell.design).map((x, k) => (taken.has(IRISES[k]) ? 0 : x));
    let pick = r() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (pick >= w[k] || w[k] === 0) pick -= w[k++];
    out.push(IRISES[k]);
  });
  return out;
}

export function grid(L: Layout, seed: number) {
  const r = rng(seed);
  const k = L.H / (L.rows * PITCH.y); // strip px per eye unit
  const px = PITCH.x * k;
  const py = PITCH.y * k;
  const w = VB.w * k; // the 1.0× eye box width
  // Start a quarter cell in from the left and a third of a row down, so eyes are cut by every edge
  const x0 = px * 0.25;
  const y0 = py * 0.3;
  const halfW = (VB.w / 2) * k * (1 + SIZE_JITTER);
  const halfH = (VB.h / 2) * k * (1 + SIZE_JITTER);
  const placed: Placed[] = [];
  for (let col = -2; x0 + col * px - halfW < L.W; col++) {
    const cx = x0 + col * px;
    if (cx + halfW < 0) continue;
    const drop = ((col % 2) + 2) % 2 ? py / 2 : 0;
    for (let row = -2; y0 + drop + row * py - halfH < L.H; row++) {
      const cy = y0 + drop + row * py;
      if (cy + halfH < 0) continue;
      placed.push({
        col,
        row,
        design: designAt(col, row),
        iris: 'blue',
        cx,
        cy,
        w: w * (1 + (r() * 2 - 1) * SIZE_JITTER),
        rot: (r() * 2 - 1) * MAX_ROT,
      });
    }
  }
  // A separate stream, so iris colors never shift the sizes and tilts drawn above
  assignIrises(placed, seed + 1).forEach((c, i) => (placed[i].iris = c));
  return { placed, px, py, x0, y0, k };
}

export const SEEDS = { p: 1966, m: 1967, d: 1968 } as const;
export const PATTERNS = LAYOUTS.map((L) => ({ L, ...grid(L, SEEDS[L.key]) }));

// ── White overlap check (used by the tests) ────────────────────────────
const DEG = Math.PI / 180;
function inPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ── Iris geometry (used by the tests to check src/scripts/eyes.ts's travel) ──
/** Is a point inside the eye opening? */
export const inOpening = (x: number, y: number, poly: Pt[] = OPENING) => inPoly(x, y, poly);
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
/** Signed distance to the opening's edge: positive inside. */
export const openingClearance = (x: number, y: number, poly: Pt[] = OPENING) => {
  const d = Math.min(...poly.map((a, i) => segDist([x, y], a, poly[(i + 1) % poly.length])));
  return inOpening(x, y, poly) ? d : -d;
};
/** Fraction of the iris disc inside the opening (resting, or `poly`), with the iris moved by (ox, oy). */
export function irisVisible(ox: number, oy: number, poly: Pt[] = OPENING, step = 0.75) {
  let n = 0;
  let v = 0;
  for (let x = -IRIS_R; x <= IRIS_R; x += step)
    for (let y = -IRIS_R; y <= IRIS_R; y += step)
      if (x * x + y * y <= IRIS_R * IRIS_R) {
        n++;
        if (inOpening(IRIS_C[0] + ox + x, IRIS_C[1] + oy + y, poly)) v++;
      }
  return v / n;
}
/** Fraction of the iris's horizontal diameter (at its center height) hidden past the opening's edge. */
export function irisTuck(ox: number, oy: number, poly: Pt[] = OPENING) {
  let out = 0;
  let n = 0;
  for (let x = -IRIS_R; x <= IRIS_R; x += 0.25) {
    n++;
    if (!inOpening(IRIS_C[0] + ox + x, IRIS_C[1] + oy, poly)) out++;
  }
  return out / n;
}
/** Smallest clearance from the pupil and both catchlights to the opening's edge (negative = clipped). */
export function pupilClearance(ox: number, oy: number, poly: Pt[] = OPENING) {
  const cx = IRIS_C[0] + ox;
  const cy = IRIS_C[1] + oy;
  let m = Infinity;
  for (let a = 0; a < 360; a += 4) {
    const t = (a * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    for (const [x, y] of [
      [cx + PUPIL_R * c, cy + PUPIL_R * s],
      [cx + CATCHLIGHT.dx + CATCHLIGHT.rx * c, cy + CATCHLIGHT.dy + CATCHLIGHT.ry * s],
      [cx + SPARK.dx + SPARK.r * c, cy + SPARK.dy + SPARK.r * s],
    ] as Pt[])
      m = Math.min(m, openingClearance(x, y, poly));
  }
  return m;
}

const SAMPLES: Pt[] = [];
for (let x = 14; x <= 146; x += 6) for (let y = 26; y <= 100; y += 4) if (inPoly(x, y, OPENING)) SAMPLES.push([x - EX, y - EY]);
const toStrip = (p: Placed, u: number, v: number): Pt => {
  const k = p.w / VB.w;
  const c = Math.cos(p.rot * DEG);
  const s = Math.sin(p.rot * DEG);
  return [p.cx + (u * c - v * s) * k, p.cy + (u * s + v * c) * k];
};
const toLocal = (p: Placed, x: number, y: number): Pt => {
  const k = VB.w / p.w;
  const dx = (x - p.cx) * k;
  const dy = (y - p.cy) * k;
  const c = Math.cos(-p.rot * DEG);
  const s = Math.sin(-p.rot * DEG);
  return [dx * c - dy * s, dx * s + dy * c];
};
/** Do two placed eyes' whites overlap at all? */
export const whitesOverlap = (a: Placed, b: Placed) =>
  SAMPLES.some(([u, v]) => inPoly(EX + toLocal(b, ...toStrip(a, u, v))[0], EY + toLocal(b, ...toStrip(a, u, v))[1], OPENING)) ||
  SAMPLES.some(([u, v]) => inPoly(EX + toLocal(a, ...toStrip(b, u, v))[0], EY + toLocal(a, ...toStrip(b, u, v))[1], OPENING));
