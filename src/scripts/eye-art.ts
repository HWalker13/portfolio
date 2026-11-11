/*
  The eyes band's art and layout, as plain data, so it can be tested (eyes.test.ts) and rendered
  at build time by EyesBand.astro. Nothing here runs in the browser.

  Style: an original 1960s pop-art textile print. Hand-inked black line work with a clear weight
  hierarchy (heaviest to finest): the upper liner band, then lashes and wedge spikes, then the
  lower lid and crease, then hatching. Irises with fine radiating pen hatching, a dark limbal ring,
  a big pupil and a white catchlight; the upper lid covers the top of the iris.

  Five designs, cycled across a half-drop repeat:
    cobalt ... cobalt-blue lid, the liner's flick extended into a wing
    sage ..... sage-green lid shadow
    yellow ... yellow lid shadow swept up toward the brow
    petals ... the eye framed by a yellow flower-shaped petal shadow
    spikes ... 1960s painted-on lashes: filled black wedges radiating above and below,
               with a heavy liner around the whole eye

  The iris (with its hatching, pupil and catchlight) is its own layer, `.look`, clipped to the eye
  opening, so when src/scripts/eyes.ts slides it toward the cursor it moves under the lids.

  Layout: a half-drop repeat, like wallpaper (grid()). Even grid, every other column dropped by
  half a cell, uniform size (±10%) and tilt (±12°) from a fixed seed, designs cycling so no two
  identical eyes touch, and the pattern bleeding off all four edges of the strip.
*/

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
export const OPENING_PATH = pathOf(OPENING);

/*
  The iris: about half the opening's width (the opening is 132 units wide; the iris is 66).
  Its top sits well under the upper lid; its bottom just meets the lower lid line.
*/
export const IRIS_R = 33;
export const IRIS_C: Pt = [80, 53];

// ── Inks ───────────────────────────────────────────────────────────────
export const INK = {
  ink: '#16110D',
  white: '#FFFDF6',
  shade: '#9A938A',
  cobalt: '#1F4FA8',
  sage: '#9DB48A',
  sageDeep: '#83A06F',
  yellow: '#F2C230',
  blueIris: '#3E73C2',
  brownIris: '#7A4A26',
} as const;
const K = INK.ink;

/** Deterministic PRNG (mulberry32) */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
/** The upper lid's shadow on the eyeball, a soft band under the lid line */
const lidShade = `<path d="${stroke(top, () => 12, 0.02, 0.98)}" fill="${K}" fill-opacity="0.12" transform="translate(0 5)"/>`;
export const SHADE = lidShade + cornerShade();

/** The iris layer: base, depth, radiating pen hatching, limbal ring, pupil, catchlight. */
function iris(color: string, seed: number) {
  const r = rng(seed);
  const [cx, cy] = IRIS_C;
  const R = IRIS_R;
  let lines = '';
  for (let i = 0; i < 84; i++) {
    const a = (i / 84) * Math.PI * 2 + r() * 0.03;
    const r0 = 14 + r() * 1.5;
    const r1 = R - 1.5 - r() * (i % 3 === 0 ? 2 : 9);
    lines += `M${f(cx + Math.cos(a) * r0)} ${f(cy + Math.sin(a) * r0)} L${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)} `;
  }
  return (
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="21" fill="#FFFFFF" fill-opacity="0.15"/>` +
    `<path d="${lines}" stroke="${K}" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R - 1.4}" fill="none" stroke="${K}" stroke-width="2.8"/>` +
    `<circle cx="${cx}" cy="${cy}" r="13.5" fill="${K}"/>` +
    `<ellipse cx="${cx + 9}" cy="${cy - 3}" rx="5.6" ry="4.6" fill="${INK.white}"/>` +
    `<circle cx="${cx - 9}" cy="${cy + 10}" r="1.9" fill="${INK.white}" fill-opacity="0.85"/>`
  );
}

// ── The five designs ───────────────────────────────────────────────────
export const DESIGNS = ['cobalt', 'sage', 'yellow', 'petals', 'spikes'] as const;
export type Design = (typeof DESIGNS)[number];

export interface EyeArt {
  design: Design;
  behind: string; // under the white (eyeshadow, petals)
  iris: string; // the moving layer
  front: string; // ink over everything
}
const LINER = 12.5; // the liner band's maximum thickness: the heaviest line on every eye

function design(d: Design): EyeArt {
  const seed = DESIGNS.indexOf(d) * 97 + 11;
  const tearDuct = `<path d="M${INNER[0] + 1} ${INNER[1]} q5 -3 9 1" stroke="${K}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  const standard = (flick: number) => crease(seed + 1) + lowerLid(seed + 2) + mascara(LINER, seed + 3) + linerBand(LINER, flick) + tearDuct;
  switch (d) {
    case 'cobalt':
      return { design: d, behind: lidShadow(INK.cobalt), iris: iris(INK.blueIris, seed), front: standard(30) };
    case 'sage':
      return { design: d, behind: lidShadow(INK.sage) + lidShadow(INK.sageDeep, CREASE - 15), iris: iris(INK.brownIris, seed), front: standard(14) };
    case 'yellow':
      return { design: d, behind: lidShadow(INK.yellow, CREASE - 3, 14), iris: iris(INK.blueIris, seed), front: standard(14) };
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
      return { design: d, behind: petals, iris: iris(INK.brownIris, seed), front: standard(14) };
    }
    case 'spikes': {
      // 1960s painted-on lashes: filled wedges in a starburst, and a heavy liner around the whole eye
      const r = rng(seed);
      let wedges = '';
      const above = [0.12, 0.27, 0.42, 0.57, 0.72, 0.87, 0.99];
      for (const t of above) {
        const root = linerTop(t, LINER);
        const n = upTop(t);
        const fan = (t - 0.5) * 0.9;
        const dir: Pt = [n[0] + fan, n[1]];
        const l = Math.hypot(...dir);
        wedges += wedge(root, [dir[0] / l, dir[1] / l], 30 + 10 * Math.sin(Math.PI * t) + r() * 5, 9 + r() * 2);
      }
      const below = [0.1, 0.26, 0.43, 0.6, 0.78, 0.92];
      for (const t of below) {
        const p = bot(t);
        const n = downBot(t);
        const fan = (0.5 - t) * 0.9;
        const dir: Pt = [n[0] + fan, n[1]];
        const l = Math.hypot(...dir);
        wedges += wedge([p[0] + n[0] * 3, p[1] + n[1] * 3], [dir[0] / l, dir[1] / l], 20 + 7 * Math.sin(Math.PI * t) + r() * 4, 7.5 + r() * 1.5);
      }
      // Heavy liner all the way around: the upper band, plus a thick lower band
      const lowerBand = ink(stroke((t) => {
        const p = bot(t);
        const n = downBot(t);
        return [p[0] + n[0] * 2.4, p[1] + n[1] * 2.4];
      }, swell(2, 6), 0, 1));
      return { design: d, behind: '', iris: iris(INK.blueIris, seed), front: wedges + lowerBand + linerBand(LINER + 1, 16) + crease(seed + 1) + tearDuct };
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
  cx: number;
  cy: number;
  w: number;
  rot: number;
}
/** Design for a grid cell: (2·col + row) mod 5 keeps every touching neighbor different. */
export const designAt = (col: number, row: number): Design => DESIGNS[(((2 * col + row) % 5) + 5) % 5];

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
        cx,
        cy,
        w: w * (1 + (r() * 2 - 1) * SIZE_JITTER),
        rot: (r() * 2 - 1) * MAX_ROT,
      });
    }
  }
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
