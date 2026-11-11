/*
  Generates the static print textures once, ahead of time:
    public/textures/grain.png   risograph-style grain: dark specks on transparent, tiled at 200px
    public/textures/cork.webp   corkboard: warm brown base with dark and light flecks

  Why pre-generate instead of a live SVG feTurbulence filter: a filter can get re-rasterized
  whenever something animates above it (the turntable, the marquee, the reel). A small static
  tile is decoded once and never repainted.

  Grain strength is NOT baked in: every grain layer is drawn at opacity var(--grain), one token
  in tokens.css. Set it to 0 to remove the texture site-wide.

  Both tiles are seamless (all coordinates wrap mod SIZE). Deterministic: same seed, same files.
  Run: npm run textures
*/
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = 'public/textures';
mkdirSync(OUT, { recursive: true });

// Small deterministic PRNG (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Grain ────────────────────────────────────────────────────────────────
// Riso grain is clumpy, not uniform: single specks plus small 2–3px clusters, in near-black.
{
  const SIZE = 200;
  const rand = rng(1977);
  const px = new Uint8Array(SIZE * SIZE * 2); // grey + alpha
  const dot = (x, y, a) => {
    const i = (((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)) * 2;
    px[i] = 20;
    px[i + 1] = Math.min(255, px[i + 1] + a);
  };
  for (let n = 0; n < SIZE * SIZE * 0.16; n++) {
    const x = Math.floor(rand() * SIZE);
    const y = Math.floor(rand() * SIZE);
    const a = 90 + Math.floor(rand() * 165);
    dot(x, y, a);
    if (rand() < 0.18) {
      dot(x + 1, y, a * 0.7);
      dot(x, y + 1, a * 0.6);
      if (rand() < 0.4) dot(x + 1, y + 1, a * 0.5);
    }
  }
  const info = await sharp(Buffer.from(px), { raw: { width: SIZE, height: SIZE, channels: 2 } })
    .png({ palette: true, colours: 16, compressionLevel: 9, effort: 10 })
    .toFile(`${OUT}/grain.png`);
  console.log(`${OUT}/grain.png  ${(info.size / 1024).toFixed(1)} KB`);
}

// ── Cork ─────────────────────────────────────────────────────────────────
{
  const SIZE = 320; // shown at 160 CSS px (sharp on 2x screens)
  const rand = rng(1973);
  const base = [138, 88, 48]; // darker, warmer: the board sits in the same lamp-lit room
  const px = new Float32Array(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const jitter = (rand() - 0.5) * 18;
    px[i * 3] = base[0] + jitter;
    px[i * 3 + 1] = base[1] + jitter * 0.85;
    px[i * 3 + 2] = base[2] + jitter * 0.6;
  }
  const blob = (cx, cy, r, tint, strength) => {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y) / r;
        if (d > 1) continue;
        const k = strength * (1 - d * d);
        const i = (((cy + y + SIZE) % SIZE) * SIZE + ((cx + x + SIZE) % SIZE)) * 3;
        for (let c = 0; c < 3; c++) px[i + c] = px[i + c] * (1 - k) + tint[c] * k;
      }
    }
  };
  // Granules: dark pockets and pale crumbs, mostly 1–3px like real agglomerated cork.
  for (let n = 0; n < 2600; n++) {
    const dark = rand() < 0.6;
    const r = 1 + Math.floor(rand() ** 2 * 4);
    blob(
      Math.floor(rand() * SIZE),
      Math.floor(rand() * SIZE),
      r,
      dark ? [70, 40, 20] : [176, 124, 72],
      dark ? 0.55 + rand() * 0.35 : 0.4 + rand() * 0.3,
    );
  }
  const out = Buffer.alloc(SIZE * SIZE * 3);
  for (let i = 0; i < px.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(px[i])));
  const info = await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .webp({ quality: 70, effort: 6 })
    .toFile(`${OUT}/cork.webp`);
  console.log(`${OUT}/cork.webp  ${(info.size / 1024).toFixed(1)} KB`);
}

// ── Flower wallpaper ─────────────────────────────────────────────────────
// An original 70s repeat on the same chocolate as the project sections, so Let's talk reads as
// part of the same room. Big eight-petal daisies and round five-petal blooms in MUTED orange,
// dusty slate and dull cream, all low contrast against the ground: a pattern, not a poster.
// The drawing is 120 units, scaled up to a 162px tile so the flowers read larger.
// Every flower stays inside the tile, so the repeat is seamless. Dark theme: same, dimmer.
{
  const tile = ({ bg, a, s, c }) => {
    const petals = (cx, cy, n, dist, rx, ry, fill, rot = 0) =>
      Array.from({ length: n }, (_, i) => {
        const deg = rot + (360 / n) * i;
        return `<ellipse cx="${cx}" cy="${cy - dist}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${deg} ${cx} ${cy})"/>`;
      }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="162" height="162" viewBox="0 0 120 120">
<rect width="120" height="120" fill="${bg}"/>
${petals(32, 32, 8, 15, 7.5, 13, a)}<circle cx="32" cy="32" r="9" fill="${c}"/><circle cx="32" cy="32" r="4" fill="${a}"/>
${petals(90, 88, 5, 12, 10, 10, s, 18)}<circle cx="90" cy="88" r="7.5" fill="${c}"/><circle cx="90" cy="88" r="2.6" fill="${s}"/>
<circle cx="92" cy="26" r="4" fill="${s}"/><circle cx="104" cy="38" r="2.6" fill="${c}"/><circle cx="80" cy="40" r="2.6" fill="${a}"/>
<circle cx="26" cy="92" r="4" fill="${a}"/><circle cx="14" cy="80" r="2.6" fill="${c}"/><circle cx="38" cy="104" r="2.6" fill="${s}"/>
</svg>`;
  };
  writeFileSync(`${OUT}/flowers.svg`, tile({ bg: '#3B2314', a: '#7E4426', s: '#4A5A5C', c: '#76604A' }));
  writeFileSync(`${OUT}/flowers-dark.svg`, tile({ bg: '#1E140D', a: '#5A2F1A', s: '#33403F', c: '#4F4133' }));
  console.log(`${OUT}/flowers.svg, flowers-dark.svg`);
}
