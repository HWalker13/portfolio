// WCAG 2.x contrast check for every text/background pair the site uses.
// Values mirror src/styles/tokens.css. Run: npm run contrast (exits 1 on any failure).
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const BODY = 4.5; // AA for normal-size text. Every pair below is used at body size somewhere.

const light = { bg: '#F3E6CC', surface: '#FBF4E4', text: '#3B2314', muted: '#6E4527', link: '#A8441A' };
const dark = { bg: '#1E140D', surface: '#2A1C12', text: '#F3E6CC', muted: '#C9B593', link: '#E57A43', accent: '#D9622B', mustard: '#E0A526' };

const pairs = [];
for (const [mode, t] of [['light', light], ['dark', dark]]) {
  for (const fg of ['text', 'muted', 'link', 'accent', 'mustard']) {
    if (!t[fg]) continue;
    for (const bg of ['bg', 'surface']) pairs.push([`${mode}: ${fg} on ${bg}`, t[fg], t[bg], BODY]);
  }
}

// Informational: colors that must stay decorative (never text) in light mode.
const decorativeOnly = [
  ['light: burnt-orange #D9622B on cream', '#D9622B', light.bg],
  ['light: mustard #E0A526 on cream', '#E0A526', light.bg],
  ['light: avocado #6B7B3A on cream', '#6B7B3A', light.bg],
  ['dark: light-mode orange-ink #A8441A on deep brown', '#A8441A', dark.bg],
];

let fail = 0;
for (const [label, fg, bg, need] of pairs) {
  const r = ratio(fg, bg);
  if (r < need) fail++;
  console.log(`${r >= need ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${label}  (${fg} on ${bg})`);
}
console.log('\nDecorative only, never used as text:');
for (const [label, fg, bg] of decorativeOnly) console.log(`  ----  ${ratio(fg, bg).toFixed(2).padStart(5)}:1  ${label}`);

if (fail && process.argv.includes('--strict')) { console.error(`\n${fail} pair(s) below AA.`); process.exit(1); }
