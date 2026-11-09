/*
  Generates the shag-rug background tiles once, ahead of time:
    public/textures/rug.webp       (light theme)
    public/textures/rug-dark.webp  (dark theme: same fibers, darker and moodier)

  Why pre-generate instead of using a live SVG feTurbulence filter: a filter behind the turntable
  could get re-rasterized while the record spins on top of it. A static tile is decoded once
  and never repainted.

  The tile is seamless: every fiber wraps around the edges (coordinates mod SIZE), and the low-frequency
  "clumping" noise uses a lattice whose period divides SIZE.

  Fibers are shaded dark at the root and bright at the tip, and the tip color is the
  brightest the palette allows. So no pixel is brighter than the lightest fiber color, and
  scripts/contrast.mjs checks hero text against the brightest pixel actually in the file.

  Run: npm run rug   (deterministic: same seed → same tile)
*/
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SIZE = 512; // shown at 256 CSS px, so it's sharp on 2x screens
const OUT = 'public/textures';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const PALETTES = {
  light: {
    base: hex('#2F4A23'),
    shadow: hex('#16230f'),
    fibers: [
      [hex('#4E6B2E'), 0.5],
      [hex('#7A8F3A'), 0.22],
      [hex('#3C5726'), 0.28],
    ],
  },
  dark: {
    base: hex('#1A2914'),
    shadow: hex('#0a1007'),
    fibers: [
      [hex('#2E4220'), 0.5],
      [hex('#4A5A26'), 0.22],
      [hex('#24361A'), 0.28],
    ],
  },
};

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise: lattice of `cells` × `cells`, smoothstep-interpolated, wraps at SIZE. */
function makeNoise(rand, cells) {
  const g = Array.from({ length: cells * cells }, () => rand());
  const at = (i, j) => g[((j % cells) + cells) % cells * cells + (((i % cells) + cells) % cells)];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / SIZE) * cells;
    const fy = (y / SIZE) * cells;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = s(fx - i);
    const v = s(fy - j);
    const a = at(i, j) * (1 - u) + at(i + 1, j) * u;
    const b = at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u;
    return a * (1 - v) + b * v;
  };
}

/** Build the fiber geometry once so both themes share the exact same rug. */
function buildFibers() {
  const rand = mulberry32(1977);
  const flow = makeNoise(rand, 4);
  const fibers = [];
  const tufts = Math.round((SIZE * SIZE) / 150);
  for (let n = 0; n < tufts; n++) {
    const cx = rand() * SIZE;
    const cy = rand() * SIZE;
    // Shag lies in loosely coherent directions: a smooth flow field plus per-tuft scatter.
    const theta = flow(cx, cy) * Math.PI * 4 + (rand() - 0.5) * 1.6;
    const count = 5 + Math.floor(rand() * 4);
    for (let k = 0; k < count; k++) {
      fibers.push({
        x: cx + (rand() - 0.5) * 4,
        y: cy + (rand() - 0.5) * 4,
        dir: theta + (rand() - 0.5) * 1.1,
        bend: (rand() - 0.5) * 0.12,
        len: 12 + rand() * 14,
        width: 3 + rand() * 2.2,
        pick: rand(),
      });
    }
  }
  return { fibers, clump: makeNoise(mulberry32(7), 8) };
}

function render({ fibers, clump }, pal) {
  const px = new Float32Array(SIZE * SIZE * 3);
  // Base pile with gentle clumping so the rug isn't perfectly flat.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const k = 0.75 + clump(x, y) * 0.35;
      const o = (y * SIZE + x) * 3;
      for (let c = 0; c < 3; c++) px[o + c] = pal.base[c] * k;
    }
  }

  const dab = (x, y, r, col, alpha) => {
    const x0 = Math.floor(x - r - 1);
    const y0 = Math.floor(y - r - 1);
    for (let yy = y0; yy <= y + r + 1; yy++) {
      for (let xx = x0; xx <= x + r + 1; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
        const a = alpha * Math.max(0, Math.min(1, r - d + 0.5));
        if (a <= 0) continue;
        const o = ((((yy % SIZE) + SIZE) % SIZE) * SIZE + (((xx % SIZE) + SIZE) % SIZE)) * 3;
        for (let c = 0; c < 3; c++) px[o + c] = px[o + c] * (1 - a) + col[c] * a;
      }
    }
  };

  const pickColor = (p) => {
    let acc = 0;
    for (const [col, w] of pal.fibers) if ((acc += w) >= p) return col;
    return pal.fibers[0][0];
  };

  for (const f of fibers) {
    const tip = pickColor(f.pick);
    const steps = Math.ceil(f.len / 0.6);
    // Pass 1: soft shadow offset down-right, so fibers look like they stand on the pile.
    // Pass 2: the fiber itself, dark at the root and brightening to the tip color.
    for (const pass of [0, 1]) {
      let x = f.x + (pass === 0 ? 1.2 : 0);
      let y = f.y + (pass === 0 ? 1.8 : 0);
      let dir = f.dir;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const r = (f.width / 2) * (1 - 0.35 * t);
        if (pass === 0) {
          dab(x, y, r + 0.6, pal.shadow, 0.18);
        } else {
          const m = 0.35 + 0.65 * t;
          const col = tip.map((v, c) => pal.shadow[c] * (1 - m) + v * m);
          dab(x, y, r, col, 0.9);
        }
        x += Math.cos(dir) * 0.6;
        y += Math.sin(dir) * 0.6;
        dir += f.bend;
      }
    }
  }

  const out = Buffer.alloc(SIZE * SIZE * 3);
  for (let i = 0; i < px.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(px[i])));
  return out;
}

mkdirSync(OUT, { recursive: true });
const geometry = buildFibers();
for (const [name, pal] of Object.entries(PALETTES)) {
  const raw = render(geometry, pal);
  const file = `${OUT}/${name === 'light' ? 'rug' : 'rug-dark'}.webp`;
  const info = await sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .webp({ quality: 70, effort: 6 })
    .toFile(file);
  console.log(`${file}  ${SIZE}×${SIZE}  ${(info.size / 1024).toFixed(1)} KB`);
}
