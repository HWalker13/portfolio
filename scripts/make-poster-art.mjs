/*
  The gig poster's art: an original 1970s-style illustrated space scene, written once as a
  static SVG (public/textures/poster-space.svg). No filters, no animation: the browser decodes
  it once and never repaints it.

    sky ....... deep muted green, soft sun-ray stripes behind the planet, cream and mustard stars,
                a few small orange planets (one hot-pink accent)
    planet .... a big orange "brain planet": its surface is stylized brain folds drawn like the
                bands on a gas giant, with mustard and cream highlights (figuring things out)
    rocket .... a small cream-and-orange rocket launching out of the clouds toward the planet,
                on a flame trail (shipping)
    ground .... layered rolling clouds and hills in greens, cream and mustard, with flowers
    frame ..... a thin ornate mustard border with decorative corners
    print ..... a few key shapes printed slightly off-register, like a two-pass screen print
                (the riso grain is the site's shared grain layer, added in CSS)

  The text (NOW BOOKING tag, name banner, date band) is HTML in GigPoster.astro, on solid cream.
  Original art: inspired by the style of retro travel/space posters, copying none.
  Deterministic: same seed, same file. Run: npm run poster-art
*/
import { writeFileSync } from 'node:fs';

const OUT = 'public/textures/poster-space.svg';
const W = 720;
const H = 1000;

// Poster inks (poster-only; see CLAUDE.md)
const SKY = '#2F4A36';
const RAY = '#36553E';
const CREAM = '#F3E6CC';
const MUSTARD = '#E0A526';
const ORANGE = '#E0702A';
const ORANGE_DK = '#B04C17';
const CHOC = '#3B2314';
const PINK = '#E8508A';
const GREEN_1 = '#3F6638';
const GREEN_2 = '#5C8A3C';
const GREEN_3 = '#8CBF3F';
const OLIVE = '#6B7B3A';

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(1969);
const f = (n) => (Math.round(n * 10) / 10).toString();

const parts = [];
const add = (s) => parts.push(s);

// ── Sky and sun rays ─────────────────────────────────────────────────────
const PX = 372; // brain planet center
const PY = 360;
const PR = 168;
add(`<rect width="${W}" height="${H}" fill="${SKY}"/>`);
{
  const n = 28;
  let d = '';
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const R = 1400;
    d += `M${PX} ${PY} L${f(PX + Math.cos(a0) * R)} ${f(PY + Math.sin(a0) * R)} L${f(PX + Math.cos(a1) * R)} ${f(PY + Math.sin(a1) * R)}Z`;
  }
  add(`<path d="${d}" fill="${RAY}"/>`);
  add(`<circle cx="${PX}" cy="${PY}" r="${PR + 26}" fill="none" stroke="${MUSTARD}" stroke-opacity="0.45" stroke-width="3" stroke-dasharray="2 9"/>`);
}

// ── Stars ────────────────────────────────────────────────────────────────
const star4 = (x, y, s, c) =>
  `<path d="M${f(x)} ${f(y - s)} Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)} Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)} Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)}Z" fill="${c}"/>`;
for (let i = 0; i < 70; i++) {
  const x = 40 + r() * (W - 80);
  const y = 40 + r() * 560;
  if (Math.hypot(x - PX, y - PY) < PR + 40) continue; // keep the planet clear
  const big = r() < 0.22;
  const c = r() < 0.65 ? CREAM : MUSTARD;
  add(big ? star4(x, y, 5 + r() * 6, c) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 1.8)}" fill="${c}"/>`);
}

// ── Small planets ────────────────────────────────────────────────────────
const smallPlanet = (x, y, rad, body, band, ring) =>
  `<circle cx="${x}" cy="${y}" r="${rad}" fill="${body}" stroke="${CHOC}" stroke-width="2"/>` +
  `<path d="M${x - rad} ${y} Q${x} ${y + rad * 0.35} ${x + rad} ${y}" stroke="${band}" stroke-width="${f(rad * 0.22)}" fill="none"/>` +
  (ring ? `<ellipse cx="${x}" cy="${y}" rx="${f(rad * 1.7)}" ry="${f(rad * 0.42)}" fill="none" stroke="${ring}" stroke-width="3" transform="rotate(-18 ${x} ${y})"/>` : '');
add(smallPlanet(112, 150, 26, ORANGE, ORANGE_DK, CREAM));
add(smallPlanet(628, 168, 15, PINK, CREAM, null)); // the hot-pink accent
add(smallPlanet(616, 520, 20, ORANGE, MUSTARD, MUSTARD));
add(smallPlanet(92, 452, 11, MUSTARD, ORANGE_DK, null));

// ── The brain planet ─────────────────────────────────────────────────────
{
  add(`<defs><clipPath id="planet"><circle cx="${PX}" cy="${PY}" r="${PR}"/></clipPath></defs>`);
  // Off-register mustard plate, peeking out down and to the right
  add(`<circle cx="${PX + 7}" cy="${PY + 6}" r="${PR}" fill="${MUSTARD}"/>`);
  add(`<circle cx="${PX}" cy="${PY}" r="${PR}" fill="${ORANGE}"/>`);
  let folds = '';
  let lights = '';
  // Fold bands, like a gas giant: wavy horizontal sulci with tight little tucks (the "gyri")
  for (let y0 = PY - PR + 18, k = 0; y0 < PY + PR; y0 += 24, k++) {
    const phase = r() * 6;
    const amp = 5 + r() * 5;
    let d = '';
    for (let x = PX - PR - 10; x <= PX + PR + 10; x += 6) {
      const y = y0 + Math.sin(x / 15 + phase) * amp + Math.sin(x / 5.5 + phase * 2) * 2.4;
      d += `${d ? 'L' : 'M'}${f(x)} ${f(y)} `;
    }
    folds += `<path d="${d}" stroke="${ORANGE_DK}" stroke-width="${f(4.5 + r() * 2.5)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (k % 2 === 0)
      lights += `<path d="${d}" transform="translate(-3 -6)" stroke="${k % 4 === 0 ? MUSTARD : CREAM}" stroke-opacity="${k % 4 === 0 ? 0.85 : 0.6}" stroke-width="2.2" fill="none" stroke-dasharray="${f(18 + r() * 30)} ${f(14 + r() * 24)}"/>`;
  }
  // The fissure between the two halves: one long S down the middle
  const fissure = `M${PX + 6} ${PY - PR} C${PX - 30} ${PY - 80} ${PX + 34} ${PY - 10} ${PX - 4} ${PY + 60} S${PX + 20} ${PY + 140} ${PX - 2} ${PY + PR}`;
  add(
    `<g clip-path="url(#planet)">${folds}${lights}` +
      `<path d="${fissure}" stroke="${ORANGE_DK}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
      `<path d="${fissure}" transform="translate(-4 -2)" stroke="${CREAM}" stroke-opacity="0.5" stroke-width="2.5" fill="none"/>` +
      // Shading: a soft crescent on the lower right
      `<circle cx="${PX + 60}" cy="${PY + 56}" r="${PR}" fill="${CHOC}" fill-opacity="0.2"/></g>`,
  );
  // A cream glint on the upper left, then the key line
  add(`<path d="M${PX - 128} ${PY - 74} A${PR - 22} ${PR - 22} 0 0 1 ${PX - 44} ${PY - 136}" stroke="${CREAM}" stroke-width="6" stroke-linecap="round" fill="none" stroke-opacity="0.85"/>`);
  add(`<circle cx="${PX}" cy="${PY}" r="${PR}" fill="none" stroke="${CHOC}" stroke-width="4"/>`);
}

// ── Clouds and rolling hills (behind the rocket's launch) ────────────────
/** A rolling layer: a smooth wave across the poster, filled to the bottom */
function hill(y0, amp, period, phase, fill, line) {
  let d = `M-10 ${H + 10} L-10 ${f(y0)}`;
  for (let x = -10; x <= W + 10; x += 12) d += ` L${x} ${f(y0 + Math.sin(x / period + phase) * amp + Math.sin(x / (period * 0.37) + phase * 1.7) * amp * 0.25)}`;
  d += ` L${W + 10} ${H + 10}Z`;
  return `<path d="${d}" fill="${fill}"${line ? ` stroke="${line}" stroke-width="3"` : ''}/>`;
}
/** A 70s cloud bank: a row of overlapping bumps on a flat base */
function cloudBank(y, bumps, fill, line) {
  let out = '';
  for (const [x, rad] of bumps) out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${line}" stroke-width="3"/>`;
  return out + `<rect x="-10" y="${y}" width="${W + 20}" height="60" fill="${fill}"/>`;
}

// ── Rocket and flame trail ───────────────────────────────────────────────
const RX = 222;
const RY = 548;
const RANG = 28; // degrees clockwise from straight up: toward the planet
const trail = (w, c) =>
  `<path d="M${RX - 14} ${RY + 44} C${RX - 34} ${RY + 92} ${RX - 66} ${RY + 116} ${RX - 92} ${RY + 170}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
add(trail(34, MUSTARD) + trail(20, ORANGE) + trail(8, CREAM));

add(cloudBank(676, [[30, 46], [118, 56], [210, 40], [302, 62], [412, 48], [502, 64], [612, 50], [702, 44]], CREAM, MUSTARD));
add(hill(716, 22, 70, 0.4, GREEN_1, CHOC));
add(hill(766, 18, 54, 2.1, OLIVE, null));
{
  let d = '';
  for (let x = -10; x <= W + 10; x += 12) d += `${d ? 'L' : 'M'}${x} ${f(804 + Math.sin(x / 62 + 1.1) * 16)} `;
  add(`<path d="${d}" stroke="${MUSTARD}" stroke-width="10" fill="none"/>`);
}
add(hill(814, 16, 62, 1.1, GREEN_2, null));
add(hill(878, 14, 48, 3.3, GREEN_3, CHOC));
add(hill(940, 10, 80, 0.2, GREEN_1, null));

// Smoke puffs at the base of the flame, sitting on the cloud bank
// Smoke puffs where the flame meets the cloud bank
for (const [x, y, s] of [
  [RX - 56, RY + 104, 20],
  [RX - 30, RY + 112, 15],
  [RX - 80, RY + 116, 14],
])
  add(`<circle cx="${x}" cy="${y}" r="${s}" fill="${CREAM}" stroke="${MUSTARD}" stroke-width="2.5"/>`);

{
  const shape = `M0 -58 C20 -36 20 20 14 48 L-14 48 C-20 20 -20 -36 0 -58Z`;
  const body =
    `<path d="M-16 34 L-30 58 L-12 50Z M16 34 L30 58 L12 50Z" fill="${ORANGE}" stroke="${CHOC}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="${shape}" fill="${CREAM}" stroke="${CHOC}" stroke-width="3"/>` +
    `<path d="M0 -58 C9 -48 13 -38 14 -30 L-14 -30 C-13 -38 -9 -48 0 -58Z" fill="${ORANGE}" stroke="${CHOC}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="0" cy="-6" r="8" fill="${SKY}" stroke="${ORANGE}" stroke-width="3.5"/>` +
    `<path d="M-14 30 L14 30" stroke="${ORANGE}" stroke-width="4"/>` +
    `<path d="M-9 48 Q0 74 9 48Z" fill="${MUSTARD}"/>`;
  // Off-register orange plate behind the rocket, then the rocket
  add(`<g transform="translate(${RX + 4} ${RY + 3}) rotate(${RANG})"><path d="${shape}" fill="${ORANGE}"/></g>`);
  add(`<g transform="translate(${RX} ${RY}) rotate(${RANG})">${body}</g>`);
}

// ── Flowers on the hills ─────────────────────────────────────────────────
const flower = (x, y, s, petal, center) => {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * s * 0.7;
    const py = y + Math.sin(a) * s * 0.7;
    out += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(s * 0.55)}" ry="${f(s * 0.32)}" transform="rotate(${f((a * 180) / Math.PI)} ${f(px)} ${f(py)})" fill="${petal}" stroke="${CHOC}" stroke-width="1.6"/>`;
  }
  return out + `<circle cx="${x}" cy="${y}" r="${f(s * 0.42)}" fill="${center}" stroke="${CHOC}" stroke-width="1.6"/>`;
};
for (const [x, y, s, p, c] of [
  [70, 856, 18, ORANGE, CREAM],
  [168, 912, 14, CREAM, ORANGE],
  [560, 848, 20, CREAM, ORANGE],
  [652, 914, 15, ORANGE, CREAM],
  [470, 918, 12, PINK, CREAM], // the second hot-pink accent
  [622, 786, 11, ORANGE, MUSTARD],
])
  add(flower(x, y, s, p, c));

// ── Ornate border ────────────────────────────────────────────────────────
{
  const i1 = 14;
  const i2 = 24;
  add(`<rect x="${i1}" y="${i1}" width="${W - i1 * 2}" height="${H - i1 * 2}" rx="6" fill="none" stroke="${MUSTARD}" stroke-width="3"/>`);
  add(`<rect x="${i2}" y="${i2}" width="${W - i2 * 2}" height="${H - i2 * 2}" rx="3" fill="none" stroke="${MUSTARD}" stroke-width="1.5"/>`);
  const corner = (x, y, sx, sy) =>
    `<g transform="translate(${x} ${y}) scale(${sx} ${sy})">` +
    `<path d="M0 34 A34 34 0 0 1 34 0" fill="none" stroke="${MUSTARD}" stroke-width="3"/>` +
    `<path d="M0 50 A50 50 0 0 1 50 0" fill="none" stroke="${MUSTARD}" stroke-width="1.5"/>` +
    `<path d="M16 8 L22 16 L16 24 L10 16Z" fill="${MUSTARD}"/>` +
    `<circle cx="40" cy="40" r="3" fill="${CREAM}"/>` +
    `</g>`;
  add(corner(i1, i1, 1, 1) + corner(W - i1, i1, -1, 1) + corner(i1, H - i1, 1, -1) + corner(W - i1, H - i1, -1, -1));
  for (const [x, y] of [
    [W / 2, i1],
    [W / 2, H - i1],
    [i1, H / 2],
    [W - i1, H / 2],
  ])
    add(`<circle cx="${x}" cy="${y}" r="5" fill="${MUSTARD}" stroke="${SKY}" stroke-width="2"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>\n`;
writeFileSync(OUT, svg);
console.log(`${OUT}  ${(svg.length / 1024).toFixed(1)} KB`);
