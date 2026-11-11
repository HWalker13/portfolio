/*
  WCAG 2.x contrast check for every text/background pair the site uses.
  Colors are read straight from src/styles/tokens.css (light :root, then the dark-mode
  override), so this script can't drift from the CSS.

  Grain never sits behind text (see tokens.css), so every pair here is ink on a clean color.

  Run: npm run contrast   (exits 1 if any pair misses its requirement)
*/
import { readFileSync } from 'node:fs';

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

  // Page text on cream / paper (tracklist sleeve, About, liner notes)
  for (const fg of ['--text', '--text-muted', '--link']) {
    for (const bg of ['--bg', '--surface']) check(`${mode}: ${fg} on ${bg}`, c(fg), c(bg), BODY);
  }
  if (mode === 'dark') {
    for (const fg of ['--burnt-orange', '--mustard']) {
      for (const bg of ['--bg', '--surface']) check(`${mode}: ${fg} on ${bg}`, c(fg), c(bg), BODY);
    }
  }
  check(`${mode}: focus ring on --bg`, c('--focus'), c('--bg'), UI);

  // Hero / orange stage (and the top nav on it)
  check(`${mode}: hero text on --hero-bg`, c('--hero-text'), c('--hero-bg'), BODY);
  check(`${mode}: hero text where the marquee passes behind it`, c('--hero-text'), c('--hero-marquee'), BODY);
  check(`${mode}: hero name fill against its --headline-keyline`, c('--headline-fill'), c('--headline-keyline'), BODY);
  check(`${mode}: hero focus ring on --hero-bg`, c('--hero-focus'), c('--hero-bg'), UI);
  check(`${mode}: "Pause motion" pressed (--hero-bg text on --hero-text)`, c('--hero-bg'), c('--hero-text'), BODY);
  check(`${mode}: --pill-text on --pill-bg`, c('--pill-text'), c('--pill-bg'), BODY);
  check(`${mode}: --pill-text on --pill-bg-hover`, c('--pill-text'), c('--pill-bg-hover'), BODY);
  // Now playing caption: a paper tag under the turntable, the same in both themes.
  check(`${mode}: "Now playing:" key (--now-playing-key on --pill-bg)`, c('--now-playing-key'), c('--pill-bg'), BODY);

  // Projects reel
  for (const fg of ['--reel-text', '--reel-muted', '--reel-accent']) check(`${mode}: reel ${fg} on --reel-bg`, c(fg), c('--reel-bg'), BODY);
  check(`${mode}: reel focus ring on --reel-bg`, c('--reel-focus'), c('--reel-bg'), UI);
  check(`${mode}: reel step button border on --reel-bg`, c('--reel-muted'), c('--reel-bg'), UI);
  check(`${mode}: reel step button hover (chocolate on --reel-accent)`, c('--chocolate'), c('--reel-accent'), BODY);

  // Footer strip
  for (const fg of ['--colophon-text', '--colophon-muted', '--mustard']) check(`${mode}: footer ${fg} on --colophon-bg`, c(fg), c('--colophon-bg'), BODY);

  // Let's talk: cream title and subline on the plain-chocolate patch under them
  check(`${mode}: Let's talk text on --wallpaper-bg`, c('--talk-text'), c('--wallpaper-bg'), BODY);
  check(`${mode}: board focus halo (cream) on cork`, c('--cream'), c('--cork-bg'), UI);
}

// Let's talk type sits straight on the wallpaper: check cream against every wallpaper ink.
const svgInks = (file) => [...new Set(readFileSync(new URL(`../public/textures/${file}`, import.meta.url), 'utf8').match(/#[0-9A-Fa-f]{6}/g))];
for (const [file, tok] of [['flowers.svg', light], ['flowers-dark.svg', dark]]) {
  for (const ink of svgInks(file)) check(`Let's talk cream on wallpaper ink (${file})`, toRgb(resolve(tok, '--talk-text')), toRgb(ink), BODY);
}

// Theme-independent surfaces: static demo cards, board items, poster inks
const T = (n) => toRgb(resolve(light, n));
for (const bg of ['--burnt-orange', '--mustard', '--powder', '--cream']) check(`static demo card: deep brown on ${bg}`, T('--deep-brown'), T(bg), BODY);
check('video Play button and static card button: chocolate on paper', T('--chocolate'), T('--paper'), BODY);
check('static card button hover: chocolate on mustard', T('--chocolate'), T('--mustard'), BODY);
check('board item ink on paper (note, index card, polaroid, resume)', T('--item-ink'), T('--paper'), BODY);
check('board item ink over a note rule line (powder)', T('--item-ink'), T('--note-rule'), BODY);
check('ticket stub ink on --ticket-bg', T('--item-ink'), T('--ticket-bg'), BODY);
check('LinkedIn "in" mark (slate ink) on paper', T('--slate-ink'), T('--paper'), BODY);
// Poster: every word is chocolate on a solid cream tag, banner or band (the art is never behind text)
check('poster: chocolate on its cream tag, banner and band', T('--chocolate'), T('--cream'), BODY);
check('board focus ring (deep brown) inside its cream halo', T('--deep-brown'), T('--cream'), UI);

// Record labels: title/artist ink on each label's background (src/data/records.json).
const records = JSON.parse(readFileSync(new URL('../src/data/records.json', import.meta.url), 'utf8'));
for (const r of records) check(`label: ${r.album}`, toRgb(r.label.ink), toRgb(r.label.bg), BODY);
// Details that sit behind text
const byDetail = (d) => records.find((r) => r.label.detail === d);
const plaque = byDetail('plaque');
check(`label detail: ${plaque.album} title on the white street-sign plaque`, toRgb(plaque.label.ink), toRgb('#FFFFFF'), BODY);
const notebook = byDetail('notebook');
check(`label detail: ${notebook.album} artist over a ruled line (#7D2F10)`, toRgb(notebook.label.ink), toRgb('#7D2F10'), BODY);

console.log(rows.join('\n'));

// ── Informational: colors that must stay decorative (never text) ─────────
const l = (n) => toRgb(resolve(light, n));
const d = (n) => toRgb(resolve(dark, n));
const info = [
  ['light: --burnt-orange on --bg (text uses --orange-ink instead)', l('--burnt-orange'), l('--bg')],
  ['light: --mustard on --bg', l('--mustard'), l('--bg')],
  ['light: --avocado on --bg', l('--avocado'), l('--bg')],
  ['--slate on cream (why the LinkedIn mark uses --slate-ink)', l('--slate'), l('--cream')],
  ['--slate on chocolate', l('--slate'), l('--chocolate')],
  ['wallpaper flowers: muted cream (#76604A) on chocolate (pattern, never text)', toRgb('#76604a'), l('--chocolate')],
  ['dark: light-mode --orange-ink on --bg', l('--orange-ink'), d('--bg')],
  ['hero name: cream directly on orange, without the keyline', l('--cream'), l('--burnt-orange')],
  ['orange on chocolate (why reel links are cream with an orange underline)', l('--burnt-orange'), l('--chocolate')],
  ['poster ink: orange plate on cream (art only)', l('--poster-orange'), l('--cream')],
];
console.log('\nDecorative only, never used as text:');
for (const [label, fg, bg] of info) console.log(`  ----  ${ratio(fg, bg).toFixed(2).padStart(5)}:1  ${label}`);

if (fail) {
  console.error(`\n${fail} pair(s) below requirement.`);
  if (process.argv.includes('--strict')) process.exit(1);
}
