/*
  Builds the reel videos that come from screen recordings (the terminal demos are
  scripts/make-demos.mjs).

  The source recording is a local, unedited QuickTime capture in scripts/recordings/ (gitignored:
  ~21 MB, and the finished files are what ships). For each one:
    1. trim to the chosen window and crop to the page content as a 16:10 frame (the card's shape)
    2. 30 fps, 1280 × 800, no audio
    3. write public/videos/<name>.webm, <name>.mp4 and <name>-poster.webp, each under 2 MB
  The poster is the clip's first frame, so a card that hasn't started playing (or never will,
  under reduced motion) shows exactly what the video opens on.

  Run: npm run recordings [-- name ...]
*/
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'scripts/recordings';
const PUBLIC = 'public/videos';
const W = 1280;
const H = 800;
const FPS = 30;
const MAX_BYTES = 2 * 1024 * 1024;

/*
  start/end in seconds of the source. crop is in source pixels (3150 × 1960 Retina capture):
  the page's content column with a little margin, as tall as 16:10 allows from the top.
*/
const RECORDINGS = {
  nfl: {
    // The live picks site: Week 11 header and record, a Details panel opening, then Week 3's
    // graded results and another Details panel. Ends before the capture toolbar appears.
    file: 'nfl-site.mov',
    start: 0.5,
    end: 13.5,
    crop: { x: 420, y: 0, w: 2280, h: 1425 },
  },
};

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`${cmd} failed:\n${err.stderr?.toString().trim() || err.message}`);
  }
}

async function build(name) {
  const r = RECORDINGS[name];
  if (!r) throw new Error(`unknown recording "${name}" (have: ${Object.keys(RECORDINGS).join(', ')})`);
  const src = join(SRC, r.file);
  if (!existsSync(src)) throw new Error(`${src} is missing: copy the original capture there first`);
  console.log(name);

  const { x, y, w, h } = r.crop;
  const vf = `crop=${w}:${h}:${x}:${y},fps=${FPS},scale=${W}:${H}:flags=lanczos,setsar=1,format=yuv420p`;
  const trim = ['-ss', String(r.start), '-to', String(r.end), '-i', src];
  const mp4 = `${PUBLIC}/${name}.mp4`;
  const webm = `${PUBLIC}/${name}.webm`;
  const poster = `${PUBLIC}/${name}-poster.webp`;

  // A web page is mostly flat UI and text, so these CRFs stay crisp well under 2 MB.
  sh('ffmpeg', ['-v', 'error', '-y', ...trim, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-tune', 'animation', '-movflags', '+faststart', mp4]);
  sh('ffmpeg', ['-v', 'error', '-y', ...trim, '-an', '-vf', vf, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', webm]);

  // First frame of the finished clip as the poster (ffmpeg grabs PNG; sharp encodes the WebP).
  const frame = join(mkdtempSync(join(tmpdir(), 'rec-')), 'poster.png');
  sh('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-frames:v', '1', frame]);
  await sharp(frame).resize(960).webp({ quality: 74 }).toFile(poster);

  for (const f of [mp4, webm, poster]) {
    const bytes = statSync(f).size;
    if (bytes > MAX_BYTES) throw new Error(`${f} is ${(bytes / 1e6).toFixed(2)} MB (limit 2 MB)`);
    console.log(`  ${f}  ${(bytes / 1024).toFixed(0)} KB`);
  }
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RECORDINGS);
for (const n of names) await build(n);
