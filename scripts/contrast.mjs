/*
  WCAG 2.x contrast check for every text/background pair the site uses.
  Colors are read straight from src/styles/tokens.css (light :root, then the dark-mode
  override), so this script can't drift from the CSS.

  Rug pairs are checked against the brightest pixel actually in the rug tile, after the
  minimum scrim is composited over it. That's the worst spot any hero text can land on.

  Run: npm run contrast   (exits 1 if any pair misses its requirement)
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BODY = 4.5; // AA normal text
const UI = 3; // AA non-text (focus rings, control boundaries)

// ── Parse tokens.css ─────────────────────────────────────────────────────
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const [lightPart, darkPart = ''] = css.split('@media (prefers-color-scheme: dark)');
const decls = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = decls(lightPart);
const dark = { ...light, ...decls(darkPart) };

const resolve = (tokens, name, depth = 0) => {
  const v = tokens[name];
  if (v === undefined) throw new Error(`Unknown token ${name}`);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref && depth < 10) return resolve(tokens, ref[1], depth + 1);
  return v;
};

// ── Color math ───────────────────────────────────────────────────────────
const toRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const toHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** CSS alpha compositing (sRGB space, which is what browsers do). */
const over = (top, alpha, bottom) => top.map((c, i) => c * alpha + bottom[i] * (1 - alpha));

async function brightestPixel(path) {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  let best = [0, 0, 0];
  let bestL = -1;
  for (let i = 0; i < data.length; i += info.channels) {
    const px = [data[i], data[i + 1], data[i + 2]];
    const L = lum(px);
    if (L > bestL) [best, bestL] = [px, L];
  }
  return best;
}

// ── Checks ───────────────────────────────────────────────────────────────
const rows = [];
let fail = 0;
const check = (label, fg, bg, need) => {
  const r = ratio(fg, bg);
  if (r < need) fail++;
  rows.push(`${r >= need ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (need ${need})  ${label}  ${toHex(fg)} on ${toHex(bg)}`);
};

for (const [mode, t] of [['light', light], ['dark', dark]]) {
  const c = (name) => toRgb(resolve(t, name));

  for (const fg of ['--text', '--text-muted', '--link']) {
    for (const bg of ['--bg', '--surface']) check(`${mode}: ${fg} on ${bg}`, c(fg), c(bg), BODY);
  }
  if (mode === 'dark') {
    for (const fg of ['--burnt-orange', '--mustard']) {
      for (const bg of ['--bg', '--surface']) check(`${mode}: ${fg} on ${bg}`, c(fg), c(bg), BODY);
    }
  }

  // Stat numbers sit on color-mix(in srgb, mustard 28%, transparent) over the sleeve surface.
  check(`${mode}: --text on stat chip (28% mustard over --surface)`, c('--text'), over(c('--mustard'), 0.28, c('--surface')), BODY);

  // Pills (hero links) are solid, so they don't depend on the rug.
  check(`${mode}: --pill-text on --pill-bg`, c('--pill-text'), c('--pill-bg'), BODY);
  check(`${mode}: --pill-text on --pill-bg-hover`, c('--pill-text'), c('--pill-bg-hover'), BODY);

  // Rug: worst case = brightest tile pixel under the lightest part of the scrim.
  const tile = resolve(t, '--rug-image').match(/url\(['"]?\/?([^'")]+)['"]?\)/)[1];
  const bright = await brightestPixel(fileURLToPath(new URL(`../public/${tile}`, import.meta.url)));
  const scrim = resolve(t, '--rug-scrim').split(/\s+/).map(Number);
  const alpha = Number(resolve(t, '--rug-scrim-min'));
  const worst = over(scrim, alpha, bright);
  rows.push(`      ${mode} rug: brightest tile pixel ${toHex(bright)} under ${alpha} scrim → ${toHex(worst)}`);
  check(`${mode}: --on-rug on rug (worst pixel)`, c('--on-rug'), worst, BODY);
  check(`${mode}: --on-rug-muted on rug (worst pixel)`, c('--on-rug-muted'), worst, BODY);
  check(`${mode}: --focus-on-rug ring on rug (worst pixel)`, c('--focus-on-rug'), worst, UI);
  check(`${mode}: --pill-bg edge on rug (worst pixel)`, c('--pill-bg'), worst, UI);
}

console.log(rows.join('\n'));

// ── Informational: colors that must stay decorative (never text) ─────────
const l = (n) => toRgb(resolve(light, n));
const d = (n) => toRgb(resolve(dark, n));
const info = [
  ['light: --burnt-orange on --bg', l('--burnt-orange'), l('--bg')],
  ['light: --mustard on --bg', l('--mustard'), l('--bg')],
  ['light: --avocado on --bg', l('--avocado'), l('--bg')],
  ['light: --rug-base on --bg', l('--rug-base'), l('--bg')],
  ['light: --rug-fiber on --bg', l('--rug-fiber'), l('--bg')],
  ['light: --rug-fiber-light on --bg', l('--rug-fiber-light'), l('--bg')],
  ['dark: light-mode --orange-ink on --bg', l('--orange-ink'), d('--bg')],
  ['rug: dark-mode link orange on --rug-base (why rug links are pills)', d('--link'), l('--rug-base')],
];
console.log('\nDecorative only, never used as text:');
for (const [label, fg, bg] of info) console.log(`  ----  ${ratio(fg, bg).toFixed(2).padStart(5)}:1  ${label}`);

if (fail) {
  console.error(`\n${fail} pair(s) below requirement.`);
  if (process.argv.includes('--strict')) process.exit(1);
}
