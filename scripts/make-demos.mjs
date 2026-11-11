/*
  Builds the terminal demo videos for the project reel.

    1. VHS records each tape in scripts/demos/<name>/<name>.tape (real commands, real output)
       to scripts/demos/out/<name>-raw.mp4 (1280 × 720).
    2. Key moments are found in the recording itself: a moment is the first frame where a given
       line of the terminal gets ink. So caption timing follows the real output, never a guess.
    3. A title card, caption strips and highlight boxes are drawn in the site's fonts (headless
       Chrome, like the OG card) and composited with ffmpeg:
         title card (1.3 s) → terminal on top, 80 px caption strip below (1280 × 800)
    4. Writes public/videos/<name>.webm, <name>.mp4 and <name>-poster.webp, each under 2 MB.

  Captions only restate what's on screen. Needs vhs, ffmpeg and a local Chrome (CHROME_PATH).
  Run: npm run demos [-- name ...]
*/
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const OUT = 'scripts/demos/out';
const PUBLIC = 'public/videos';
const W = 1280;
const TERM_H = 720;
const STRIP = 80;
const H = TERM_H + STRIP;
const FPS = 30;
const TITLE_S = 1.3;
/** The last frame (the payoff, with its highlight) holds this long so it can be read */
const HOLD_S = 1.4;
const MAX_BYTES = 2 * 1024 * 1024;

/*
  Terminal geometry from the tapes (FontSize 19, LineHeight 1.08, Padding 30): line n (0-based)
  sits at y = TOP + n * LINE. Measured from a frame, not assumed; adjust if a tape's font changes.
*/
const TOP = 31;
const LINE = 27.4;
const lineBox = (n, x = 30, w = 260) => ({ x, y: Math.round(TOP + n * LINE), w, h: Math.round(LINE) - 4 });

const DEMOS = {
  kache: {
    title: 'Kache',
    subtitle: 'Replication through a network partition',
    /*
      Each moment starts when `line` first gets ink. To time a caption to a command, point it at
      the line just after the command: that line inks the moment Enter is pressed.
    */
    moments: [
      { line: 0, caption: 'Primary :6379 replicates every write to the replica :6380' },
      { line: 8, caption: 'Link cut. Both servers stay up; the primary keeps taking writes' },
      { line: 15, caption: 'The replica is 3 writes behind' },
      {
        line: 22,
        caption: 'Link back: the replica caught up, 5 of 5 writes, none lost',
        strong: true,
        box: { fromLine: 17, toLine: 22, x: 22, w: 180 },
      },
    ],
  },
  nfl: {
    title: 'NFL Game Predictor',
    subtitle: 'The 2026 live record, replayed',
    moments: [
      { line: 0, caption: 'A copy of the repo, scratch mode: the official record, nothing re-predicted' },
      { line: 4, caption: 'Week 7 picks as logged before kickoff, next to the final scores' },
      { line: 11, caption: 'Model 0.595 vs. home-team baseline 0.473. The Vegas favorite does better: 0.608' },
      {
        line: 17,
        caption: 'ROI is positive, but mean CLV is negative (p = 0.70): no edge claimed',
        strong: true,
        box: { fromLine: 15, toLine: 17, x: 22, w: 1236 },
      },
    ],
  },
};

/** Run a tool; on failure, report its own error text instead of raw buffers. */
function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  } catch (err) {
    throw new Error(`${cmd} failed:\n${err.stderr?.toString().trim() || err.message}`);
  }
}
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── Fonts for the overlays (the site's own files) ─────────────────────
// Encoded file URLs: the repo path has a space in it ("Personal Projects").
const font = (pkg, file) => pathToFileURL(require.resolve(`${pkg}/files/${file}`)).href;
const FONTS = `
  @font-face { font-family: Fraunces; src: url('${font('@fontsource-variable/fraunces', 'fraunces-latin-full-normal.woff2')}'); font-weight: 100 900; }
  @font-face { font-family: DM Sans; src: url('${font('@fontsource-variable/dm-sans', 'dm-sans-latin-wght-normal.woff2')}'); font-weight: 100 1000; }
  @font-face { font-family: JetBrains Mono; src: url('${font('@fontsource-variable/jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}'); font-weight: 100 800; }
  * { margin: 0; box-sizing: border-box; }
  html, body { background: transparent; }
`;

// Rendered from a file, not setContent: an about:blank page may not load file:// fonts.
async function renderPng(page, html, width, height, path) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const file = `${path}.html`;
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style></head><body>${html}</body></html>`);
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  // Load every face explicitly: fonts.ready can resolve before layout has requested them.
  const loaded = await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  if (!loaded.some((f) => /DM Sans/.test(f))) throw new Error(`overlay fonts didn't load (${loaded.join(', ') || 'none'})`);
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

const titleCard = (d) => `
  <div style="width:${W}px;height:${H}px;background:#1E140D;position:relative;overflow:hidden;font-family:DM Sans">
    <div style="position:absolute;left:0;right:0;bottom:120px;display:grid;gap:10px">
      <span style="height:18px;background:#D9622B"></span>
      <span style="height:18px;background:#E0A526"></span>
      <span style="height:18px;background:#8A5A35"></span>
    </div>
    <div style="position:absolute;left:96px;top:190px">
      <p style="font-family:JetBrains Mono;font-weight:700;font-size:26px;letter-spacing:.2em;color:#E0A526">DEMO</p>
      <h1 style="margin-top:18px;font-family:Fraunces;font-variation-settings:'SOFT' 100,'WONK' 0;font-weight:900;font-size:130px;line-height:.95;color:#F3E6CC">${d.title}</h1>
      <p style="margin-top:26px;font-size:40px;font-weight:500;color:#E2CFAA">${d.subtitle}</p>
    </div>
  </div>`;

const strip = (text, strong) => `
  <div style="width:${W}px;height:${STRIP}px;display:flex;align-items:center;gap:18px;padding:0 40px;
    background:${strong ? '#E0A526' : '#2A1C12'};border-top:3px solid ${strong ? '#F2C230' : '#3B2314'};font-family:DM Sans">
    <span style="flex:none;width:14px;height:14px;border-radius:50%;background:${strong ? '#3B2314' : '#E0A526'}"></span>
    <span style="font-size:30px;font-weight:${strong ? 700 : 500};color:${strong ? '#3B2314' : '#F3E6CC'}">${text}</span>
  </div>`;

const boxOverlay = (b) => {
  const y = Math.round(TOP + b.fromLine * LINE) - 5;
  const h = Math.round((b.toLine - b.fromLine + 1) * LINE) + 8;
  return `<div style="width:${W}px;height:${TERM_H}px;position:relative">
    <div style="position:absolute;left:${b.x}px;top:${y}px;width:${b.w}px;height:${h}px;border:4px solid #E0A526;border-radius:12px;
      box-shadow:0 0 0 4px rgb(30 20 13 / .6)"></div></div>`;
};

/** Seconds at which each moment's line first gets ink (bright pixels) in the raw recording. */
function findMoments(raw, moments) {
  const frames = sh('ffmpeg', ['-v', 'error', '-i', raw, '-vf', `fps=${FPS},format=gray`, '-f', 'rawvideo', '-'], {
    maxBuffer: 1 << 30,
  });
  const size = W * TERM_H;
  const n = Math.floor(frames.length / size);
  return moments.map((m) => {
    const b = lineBox(m.line, m.x ?? 30, m.w ?? 260);
    for (let i = 0; i < n; i++) {
      let lit = 0;
      for (let y = b.y; y < b.y + b.h; y += 2)
        for (let x = b.x; x < b.x + b.w; x += 2) if (frames[i * size + y * W + x] > 120) lit++;
      if (lit > 12) return i / FPS;
    }
    throw new Error(`moment never appeared: line ${m.line} "${m.caption}"`);
  });
}

async function build(name, page) {
  const d = DEMOS[name];
  const raw = `${OUT}/${name}-raw.mp4`;
  console.log(`[${name}] recording ${name}.tape`);
  sh('vhs', [`scripts/demos/${name}/${name}.tape`]);
  const dur = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]).toString());
  const at = findMoments(raw, d.moments);
  // Moment 0 starts the strip at once; every later moment starts when its line appears.
  at[0] = 0;
  console.log(`[${name}] moments at ${at.map((t) => t.toFixed(2)).join(', ')} s of ${dur.toFixed(2)} s`);

  const tmp = `${OUT}/${name}`;
  mkdirSync(tmp, { recursive: true });
  await renderPng(page, titleCard(d), W, H, `${tmp}/title.png`);
  for (const [i, m] of d.moments.entries()) {
    await renderPng(page, strip(m.caption, m.strong), W, STRIP, `${tmp}/strip-${i}.png`);
    if (m.box) await renderPng(page, boxOverlay(m.box), W, TERM_H, `${tmp}/box-${i}.png`);
  }

  // ffmpeg graph: terminal padded to 1280 × 800, strips and boxes enabled at their moments,
  // then the title card in front with a short crossfade.
  const end = dur + HOLD_S;
  const inputs = ['-loop', '1', '-t', String(TITLE_S), '-i', `${tmp}/title.png`, '-i', raw];
  const layers = [];
  d.moments.forEach((m, i) => {
    inputs.push('-i', `${tmp}/strip-${i}.png`);
    layers.push({ idx: inputs.filter((x) => x === '-i').length - 1, x: 0, y: TERM_H, from: at[i], to: at[i + 1] ?? end + 1 });
    if (m.box) {
      inputs.push('-i', `${tmp}/box-${i}.png`);
      layers.push({ idx: inputs.filter((x) => x === '-i').length - 1, x: 0, y: 0, from: at[i], to: end + 1 });
    }
  });
  let graph = `[1:v]fps=${FPS},tpad=stop_mode=clone:stop_duration=${HOLD_S},pad=${W}:${H}:0:0:color=#1E140D,setsar=1[base0];`;
  layers.forEach((l, i) => {
    graph += `[base${i}][${l.idx}:v]overlay=${l.x}:${l.y}:enable='between(t,${l.from.toFixed(3)},${l.to.toFixed(3)})'[base${i + 1}];`;
  });
  graph += `[0:v]fps=${FPS},scale=${W}:${H},setsar=1,format=yuv420p[title];[base${layers.length}]format=yuv420p[main];`;
  graph += `[title][main]xfade=transition=fade:duration=0.3:offset=${(TITLE_S - 0.3).toFixed(2)}[v]`;

  const master = `${tmp}/master.mp4`;
  sh('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', master]);

  mkdirSync(PUBLIC, { recursive: true });
  const mp4 = `${PUBLIC}/${name}.mp4`;
  const webm = `${PUBLIC}/${name}.webm`;
  const poster = `${PUBLIC}/${name}-poster.webp`;
  // Terminal footage is flat color and text: high CRF stays crisp and lands far under 2 MB.
  sh('ffmpeg', ['-v', 'error', '-y', '-i', master, '-an', '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  sh('ffmpeg', ['-v', 'error', '-y', '-i', master, '-an', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', webm]);
  // Poster: the final frame (the payoff, with its highlight), 960 px wide: sharp at the card's
  // display size on 2x screens, and a fraction of the bytes of a full-size JPEG.
  // (ffmpeg grabs the frame as PNG; sharp encodes the WebP, since not every ffmpeg build has libwebp.)
  const frame = `${tmp}/poster.png`;
  sh('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.2', '-i', master, '-frames:v', '1', '-update', '1', frame]);
  await sharp(frame).resize(960).webp({ quality: 74 }).toFile(poster);

  for (const f of [mp4, webm, poster]) {
    const bytes = statSync(f).size;
    if (bytes > MAX_BYTES) throw new Error(`${f} is ${(bytes / 1e6).toFixed(2)} MB (limit 2 MB)`);
    console.log(`  ${f}  ${(bytes / 1024).toFixed(0)} KB`);
  }
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DEMOS);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
try {
  for (const n of names) {
    if (!DEMOS[n]) throw new Error(`unknown demo "${n}" (have: ${Object.keys(DEMOS).join(', ')})`);
    await build(n, page);
  }
} finally {
  await browser.close();
}
