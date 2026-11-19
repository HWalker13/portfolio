/*
  Eyes band: the irises follow the cursor, the lids follow the irises, each eye blinks on its own
  clock, and the whole band falls asleep when nobody's around, then wakes up groggy.

  - One pointermove listener on window and one requestAnimationFrame loop for every eye.
    Writes are transform only (translate/matrix on the iris, the lids and the lid ink), and only
    when a value changed. Layout reads (eye centers and rotations) happen on load and resize.
  - Gaze: each eye turns the pointer direction into its own (rotated) frame and aims at the edge of
    an almond-shaped travel range: ±40 units sideways, about 35–40% of that up and down, reaching
    it once the pointer is ~170px away. The lids follow: looking up lifts the upper lid (so the
    pupil never slides under it), looking down lowers it; the lower lid moves a little less. The
    pupil and its catchlights stay fully visible at every gaze (checked in eyes.test.ts against
    the geometry in eye-art.ts).
  - Blinks: every eye has its own 10–15 s clock (seeded per eye, jittered each time); about one in
    six blinks is a double. Touching eyes never blink at the same moment. Only open eyes blink.
  - Sleep: 10 s without pointer movement (or the pointer leaving the window) and the lids droop a
    third closed; at 30 s they close all the way, one by one over ~3 s, showing the painted art on
    each closed lid. The next move wakes them one by one over ~1.25 s: each opens slowly to half,
    flutters once or twice, pauses, then opens and looks at the cursor. Drowsy eyes wake quicker,
    with one flutter.
  - Touch-only devices (no hover): the eyes glance around on their own and blink; they never sleep.
  - Still under prefers-reduced-motion (open, looking ahead, no blinks or sleep). The hero's "Pause
    motion" toggle (<html data-motion="paused">, announced with a 'motionchange' event) freezes
    everything where it is; un-pausing picks up where it left off.
  - Timers and the loop only run while the band is on screen and the tab is visible.
*/

/** Deterministic PRNG (mulberry32). Shared with eye-art.ts. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
  Do two grid cells touch (sideways, up/down or diagonally)? Same column: adjacent rows. Neighboring
  columns: within one row pitch vertically (the half-drop makes two cells on each side touch).
*/
export const touching = (a: { col: number; row: number }, b: { col: number; row: number }) => {
  if (a.col === b.col) return Math.abs(a.row - b.row) === 1;
  if (Math.abs(a.col - b.col) !== 1) return false;
  const drop = (c: number) => (((c % 2) + 2) % 2) / 2;
  return Math.abs(a.row + drop(a.col) - (b.row + drop(b.col))) < 1;
};

// ── Gaze (pure, tested) ────────────────────────────────────────────────
/** Pointer distance (CSS px) at which an eye looks as hard as it can. */
export const REACH = 170;
/**
  Travel limits in eye units (the iris is 66 wide). Sideways the iris presses into the corner and
  follows the almond's midline down (the corners sit lower than the iris's rest position). Up and
  down are about 35–40% of sideways; the vertical give narrows toward the corners, like the almond.
*/
export const TRAVEL = {
  inner: 40, // toward the inner corner (left, -x)
  outer: 40, // toward the outer corner (right, +x)
  followInner: 10, // how far down the iris rides at the inner corner
  followOuter: 6,
  up: 14,
  down: 15,
} as const;

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/**
  Where to aim, as (h, v) in -1..1: the direction to the pointer pushed out to a squarish
  (superellipse) boundary, so a diagonal still strains hard sideways, scaled by an eased strength
  that reaches 1 at REACH px.
*/
export function aim(dx: number, dy: number, reach = REACH): [number, number] {
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return [0, 0];
  const c = dx / d;
  const s = dy / d;
  const P = 4;
  const k = (Math.abs(c) ** P + Math.abs(s) ** P) ** (-1 / P);
  const strength = easeOut(Math.min(1, d / reach));
  return [c * k * strength, s * k * strength];
}

/**
  Vertical gaze (eye units, + down), without the corner follow: what the lids track. It narrows
  toward the corners like the almond, more so looking down, where the corner follow already
  carries the iris down.
*/
export const irisLift = (h: number, v: number) => (v < 0 ? v * TRAVEL.up * (1 - 0.45 * h * h) : v * TRAVEL.down * (1 - 0.8 * h * h));

/** The iris offset (eye units) for an aim (h, v). */
export function irisOffset(h: number, v: number): [number, number] {
  const x = h < 0 ? h * TRAVEL.inner : h * TRAVEL.outer;
  const follow = (h < 0 ? TRAVEL.followInner : TRAVEL.followOuter) * h * h;
  return [x, follow + irisLift(h, v)];
}

/** A screen-space vector expressed in the frame of an eye rotated by `rot` radians. */
export function toEyeFrame(dx: number, dy: number, rot: number): [number, number] {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  return [dx * c - dy * s, dx * s + dy * c];
}

/** Frame-rate independent easing of a value toward a target (rate k per second). */
export const ease = (value: number, target: number, k: number, dt: number) => target + (value - target) * Math.exp(-k * dt);

// ── Lids follow the gaze (pure, tested) ────────────────────────────────
/**
  How far each lid moves (eye units at its apex, + down) per unit of vertical gaze. Looking up, the
  upper lid lifts a little further than the iris (its corners hinge, so it lifts less there, where
  an up-diagonal glance goes), keeping the pupil clear and showing white under the iris; looking
  down it lowers a little over half as far. The lower lid moves a little less than the upper.
  `corners`: the share of the lower lid's move that the corners (where the lids meet) share, so
  the upper lid stretches less.
*/
export const LID_FOLLOW = { up: 1.15, down: 0.6, lower: 0.6, corners: 0.6 } as const;
export interface LidPose {
  upper: number; // upper lid apex displacement
  lower: number; // lower lid apex displacement
  corners: number; // both corners
}
export function lidPose(h: number, v: number): LidPose {
  const y = irisLift(h, v);
  const upper = y * (y < 0 ? LID_FOLLOW.up : LID_FOLLOW.down);
  const lower = upper * LID_FOLLOW.lower;
  return { upper, lower, corners: lower * LID_FOLLOW.corners };
}

/**
  Lid geometry from eye-art.ts (handed to the browser on the band's data-lid attribute): the line
  through the two corners (y = a + m·x), each lid apex's signed distance from it, and how far the
  upper lid slides to close at rest.
*/
export interface LidGeom {
  a: number;
  m: number;
  top: number; // upper lid apex distance from the corner line (negative: above)
  bot: number; // lower lid apex distance (positive: below)
  travel: number;
  extra: number; // how much further the lid slides once it's shut, to bring the closed-lid art down
}
/**
  A lid's transform as a CSS/SVG matrix(1, b, 0, d, 0, f): every point moves vertically in
  proportion to its distance from the corner line (so the corners stay put while the apex moves by
  `apex`), then everything shifts by `corners`.
*/
export function lidMatrix(apex: number, dist: number, corners: number, g: LidGeom): [number, number, number] {
  const k = (apex - corners) / dist; // the scale factor, minus 1
  return [-k * g.m, 1 + k, corners - k * g.a];
}
/**
  How far the upper lid slides down at closure c (0 open, 1 shut) from a pose: in step with the
  closure across the opening (a third closed covers a third of it), plus a last slide past the lower
  lid near the end, out of sight, that brings the closed-lid painting down into the opening.
*/
export const lidSlide = (c: number, p: LidPose, g: LidGeom) => c * (g.travel + p.lower - p.upper) + c ** 8 * g.extra;

// ── Blinks (pure, tested) ──────────────────────────────────────────────
export const BLINK_MS = 150;
export const DOUBLE_GAP = 60;
export const DOUBLE_ODDS = 1 / 6;
export const blinkLength = (double: boolean) => (double ? 2 * BLINK_MS + DOUBLE_GAP : BLINK_MS);
/** How closed a blinking lid is, `ms` into the blink: shut at each midpoint, open at the ends. */
export function blinkClosure(ms: number, double = false): number {
  if (ms <= 0 || ms >= blinkLength(double)) return 0;
  if (double && ms > BLINK_MS) return blinkClosure(ms - BLINK_MS - DOUBLE_GAP);
  return Math.sin((Math.PI * ms) / BLINK_MS);
}
export const BLINK_EVERY = { min: 10_000, max: 15_000 } as const;
/** Gap between neighbors' blinks */
const NEIGHBOR_GAP = 120;
/**
  The next interval for an eye with clock `base` (10.5–13.9 s, from the seed): jittered ±0.8 s and
  kept ≥ 600 ms under the 15 s cap, which leaves room for waiting on a blinking neighbor.
*/
export const blinkInterval = (base: number, rand: number) =>
  Math.min(BLINK_EVERY.max - 600, Math.max(BLINK_EVERY.min, base + (rand - 0.5) * 1600));

export interface Blink {
  next: number; // when this eye blinks next (ms)
  start: number; // when its current blink started (-Infinity: none yet)
  double: boolean;
}
const blinkEnd = (b: Blink) => b.start + blinkLength(b.double);
/**
  Starts every due blink at `now`. An eye that can't blink (closed or waking) tries again an
  interval later; an eye with a blinking neighbor waits until that blink is over. Returns whether
  any blink is running.
*/
export function scheduleBlinks(
  blinks: Blink[],
  bases: number[],
  neighbors: number[][],
  now: number,
  rand: () => number,
  canBlink: (i: number) => boolean,
): boolean {
  let any = false;
  blinks.forEach((b, i) => {
    if (now >= b.next) {
      const busy = Math.max(-Infinity, ...neighbors[i].map((j) => blinkEnd(blinks[j])));
      if (!canBlink(i)) b.next = now + blinkInterval(bases[i], rand());
      else if (busy > now) b.next = busy + NEIGHBOR_GAP;
      else {
        b.start = now;
        b.double = rand() < DOUBLE_ODDS;
        b.next = now + blinkInterval(bases[i], rand());
      }
    }
    if (now < blinkEnd(b)) any = true;
  });
  return any;
}

// ── Sleep (pure, tested) ───────────────────────────────────────────────
export const DROWSY_AFTER = 10_000;
export const ASLEEP_AFTER = 30_000;
export type Stage = 'awake' | 'drowsy' | 'asleep';
/** The band's stage from the time since the pointer last moved, and whether it left the window. */
export const stageAt = (idleMs: number, left: boolean): Stage =>
  idleMs >= ASLEEP_AFTER ? 'asleep' : idleMs >= DROWSY_AFTER || left ? 'drowsy' : 'awake';

export const DROOP = 1 / 3; // drowsy: a third closed, pupils still showing
export const DROOP_MS = 1500;
export const CLOSE_MS = 1200; // from drowsy to shut
/** Eyes drift off one by one over this long, and wake one by one over WAKE_STAGGER. */
export const SLEEP_STAGGER = 3000;
export const WAKE_STAGGER = 1250;

/** Each eye's own seeded timing */
export interface Timing {
  blinkBase: number;
  sleepDelay: number;
  wakeDelay: number;
  flutters: 1 | 2;
}
export function eyeTiming(i: number): Timing {
  const r = rng(1969 + i * 7919);
  return {
    blinkBase: 10_500 + r() * 3400,
    sleepDelay: r() * SLEEP_STAGGER,
    wakeDelay: r() * WAKE_STAGGER,
    flutters: r() < 0.5 ? 1 : 2,
  };
}

/** A wake-up: lid keyframes [ms, closure], and when the eye turns back to the cursor. */
export interface Plan {
  from: number;
  keys: [number, number][];
  lookAt: number;
}
/** Groggy above this closure (was asleep), quick below it (was drowsy). */
const GROGGY = 0.55;
export function wakePlan(c0: number, flutters: 1 | 2): Plan {
  const keys: [number, number][] = [];
  if (c0 > GROGGY) {
    keys.push([600, 0.5]); // slowly, to about half
    for (let i = 0; i < flutters; i++) keys.push([90, 0.85], [130, 0.5], [70, 0.5]); // sleepy flutters
    keys.push([380, 0.5]); // a pause
  } else keys.push([80, Math.min(0.9, c0 + 0.4)], [120, c0], [140, c0]); // one flutter
  const lookAt = keys.reduce((t, k) => t + k[0], 0);
  keys.push([c0 > GROGGY ? 260 : 180, 0]); // open and look
  return { from: c0, keys, lookAt };
}
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Lid closure `t` ms into a plan, or null once it's done. */
export function planClosure(p: Plan, t: number): number | null {
  let c = p.from;
  for (const [ms, to] of p.keys) {
    if (t < ms) return c + (to - c) * smooth(t / ms);
    t -= ms;
    c = to;
  }
  return null;
}

export interface Lids {
  closure: number; // sleep closure (blinks add on top)
  plan: Plan | null;
  t: number; // ms into the plan
}
/**
  One step of an eye's sleep lids. `stageMs`: time since the band entered `stage`. Drowsy: droop
  toward a third. Asleep: hold the droop until this eye's turn, then close. Awake: once this eye's
  wake turn comes, play the wake plan (groggy from asleep, quick from drowsy).
*/
export function stepLids(l: Lids, stage: Stage, stageMs: number, dtMs: number, timing: Timing): Lids {
  if (stage !== 'awake') {
    const target = stage === 'asleep' && stageMs >= timing.sleepDelay ? 1 : DROOP;
    const rate = target === 1 ? (1 - DROOP) / CLOSE_MS : DROOP / DROOP_MS;
    const c = l.closure < target ? Math.min(target, l.closure + rate * dtMs) : Math.max(target, l.closure - rate * dtMs);
    return { closure: c, plan: null, t: 0 };
  }
  if (l.plan) {
    const t = l.t + dtMs;
    const c = planClosure(l.plan, t);
    return c === null ? { closure: 0, plan: null, t: 0 } : { closure: c, plan: l.plan, t };
  }
  if (l.closure <= 0) return l;
  const delay = l.closure > GROGGY ? timing.wakeDelay : timing.wakeDelay * 0.3;
  if (stageMs < delay) return l;
  return { closure: l.closure, plan: wakePlan(l.closure, timing.flutters), t: 0 };
}
/** Is the eye looking (at the cursor, or around)? Not while closing or asleep, nor until a wake plan opens it. */
export const isLooking = (l: Lids, stage: Stage) => (stage === 'awake' ? !l.plan || l.t >= l.plan.lookAt : l.closure <= DROOP + 1e-6);
/** Fully open and free to blink */
export const isOpen = (l: Lids) => l.closure === 0 && !l.plan;
/** Nothing left to animate for this stage: open, drooped, or shut */
export const lidsSettled = (l: Lids, stage: Stage) =>
  !l.plan && l.closure === (stage === 'awake' ? 0 : stage === 'drowsy' ? DROOP : 1);

/**
  Squash toward the corner line to `s` of full height (1: as drawn, 0: flat, so nothing shows): the
  wave crests calm this way as the eye falls asleep.
*/
export const calmMatrix = (s: number, g: LidGeom): [number, number, number] => [-(s - 1) * g.m, s, -(s - 1) * g.a];
/** Hanging lashes (cobalt, spikes) drop out of the closed lash line over the last fifth of a close. */
export const DROP_HIDE = 44;
export const dropReveal = (closure: number) => smooth(Math.max(0, Math.min(1, (closure - 0.8) / 0.2)));

// ── DOM ────────────────────────────────────────────────────────────────
interface Eye {
  el: SVGSVGElement;
  parts: (SVGElement | null)[]; // look, lid, cover, upper, lower, drop and calm (only some designs)
  drawn: string[];
  col: number;
  row: number;
  cx: number; // page coordinates of the eye center
  cy: number;
  rot: number; // radians
  h: number; // current aim
  v: number;
  th: number; // target aim
  tv: number;
  lids: Lids;
  timing: Timing;
  blink: Blink;
}

/** "0deg" | "12.5deg" | "none" → radians */
function parseRotate(v: string): number {
  const m = v.match(/(-?[\d.]+)deg/);
  return m ? (Number(m[1]) * Math.PI) / 180 : 0;
}
const f2 = (n: number) => n.toFixed(2);
const fm = (m: [number, number, number]) => `matrix(1,${m[0].toFixed(4)},0,${m[1].toFixed(4)},0,${f2(m[2])})`;

export function startEyes() {
  const band = document.querySelector<HTMLElement>('[data-eyes]');
  if (!band) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return; // still: open, looking straight ahead, no blinks, no sleep

  const root = document.documentElement;
  const paused = () => root.dataset.motion === 'paused';
  const touchOnly = window.matchMedia('(hover: none)').matches;
  const geom = JSON.parse(band.dataset.lid!) as LidGeom;
  const eyes: Eye[] = [...band.querySelectorAll<SVGSVGElement>('.eye')].map((el, i) => {
    const timing = eyeTiming(i);
    return {
      el,
      parts: ['.look', '.lid', '.cover', '.upper', '.lower', '.drop', '.calm'].map((s) => el.querySelector<SVGElement>(s)),
      drawn: [],
      col: Number(el.dataset.col),
      row: Number(el.dataset.row),
      cx: 0,
      cy: 0,
      rot: 0,
      h: 0,
      v: 0,
      th: 0,
      tv: 0,
      lids: { closure: 0, plan: null, t: 0 },
      timing,
      blink: { next: 0, start: -Infinity, double: false },
    };
  });
  let shown: Eye[] = [];
  let neighbors: number[][] = [];

  let visible = false;
  let raf = 0;
  let last = 0;
  let pointer: { x: number; y: number } | null = null; // client coordinates
  let glanceTimer = 0;
  let blinkTimer = 0;
  let idleTimer = 0;
  let lastMove = performance.now();
  let left = false;
  let stage: Stage = 'awake';
  let stageStart = lastMove;
  let pausedAt = 0;

  const measure = () => {
    shown = [];
    const bandBox = band.getBoundingClientRect();
    for (const e of eyes) {
      const r = e.el.getBoundingClientRect();
      if (!r.width) continue; // not in this breakpoint's layout
      if (r.right < bandBox.left || r.left > bandBox.right) continue; // cropped off the side of the band
      // Rotation is about the eye's center, so the bounding box stays centered on it.
      e.cx = r.left + r.width / 2 + window.scrollX;
      e.cy = r.top + r.height / 2 + window.scrollY;
      e.rot = parseRotate(getComputedStyle(e.el).rotate);
      shown.push(e);
    }
    neighbors = shown.map((a) => shown.flatMap((b, j) => (touching(a, b) ? [j] : [])));
  };
  /** Blinks start spread out, and nobody owes one after time offscreen. */
  const spreadBlinks = (now: number) => {
    for (const e of eyes) if (e.blink.next < now) e.blink.next = now + Math.random() * e.timing.blinkBase;
  };

  const write = (e: Eye, i: number, value: string) => {
    const el = e.parts[i];
    if (!el || e.drawn[i] === value) return;
    e.drawn[i] = value;
    el.style.transform = value;
  };
  const draw = (e: Eye, now: number) => {
    const [x, y] = irisOffset(e.h, e.v);
    write(e, 0, x || y ? `translate(${f2(x)}px,${f2(y)}px)` : '');
    const pose = lidPose(e.h, e.v);
    const upper = fm(lidMatrix(pose.upper, geom.top, pose.corners, geom));
    const lower = fm(lidMatrix(pose.lower, geom.bot, pose.corners, geom));
    const c = Math.max(e.lids.closure, blinkClosure(now - e.blink.start, e.blink.double));
    write(e, 1, `translate(0px,${f2(lidSlide(c, pose, geom))}px) ${upper}`);
    write(e, 2, lower);
    write(e, 3, upper);
    write(e, 4, lower);
    const drop = dropReveal(c);
    write(e, 5, drop === 1 ? 'none' : `translate(0px,${f2((drop - 1) * DROP_HIDE)}px)`);
    // The wave crests calm flat as the eye falls asleep (sleep only: a blink leaves them be)
    const calm = 1 - dropReveal(e.lids.closure);
    write(e, 6, calm === 1 ? '' : fm(calmMatrix(calm, geom)));
    return c > 0;
  };

  const frame = (now: number) => {
    raf = 0;
    if (!visible || paused()) return;
    const dtMs = last ? Math.min(50, now - last) : 0;
    last = now;
    let moving = false;

    if (!touchOnly) {
      const next = stageAt(now - lastMove, left);
      if (next !== stage) {
        stage = next;
        stageStart = now;
      }
    }
    if (pointer) {
      const px = pointer.x + window.scrollX;
      const py = pointer.y + window.scrollY;
      for (const e of shown) [e.th, e.tv] = aim(...toEyeFrame(px - e.cx, py - e.cy, e.rot));
    }
    // Cursor-following eyes catch up quickly; glancing eyes drift; closing eyes settle ahead
    const k = pointer ? 14 : 4;
    for (const e of shown) {
      e.lids = stepLids(e.lids, stage, now - stageStart, dtMs, e.timing);
      if (!lidsSettled(e.lids, stage)) moving = true;
      const look = isLooking(e.lids, stage);
      const th = look ? e.th : 0;
      const tv = look ? e.tv : 0;
      e.h = ease(e.h, th, k, dtMs / 1000);
      e.v = ease(e.v, tv, k, dtMs / 1000);
      if (Math.abs(th - e.h) > 0.002 || Math.abs(tv - e.v) > 0.002) moving = true;
      else [e.h, e.v] = [th, tv];
    }
    if (scheduleBlinks(shown.map((e) => e.blink), shown.map((e) => e.timing.blinkBase), neighbors, now, Math.random, (i) => isOpen(shown[i].lids)))
      moving = true;
    for (const e of shown) draw(e, now);

    if (moving) raf = requestAnimationFrame(frame);
    else {
      last = 0;
      armBlinkTimer(now);
    }
  };
  const kick = () => {
    if (!raf && visible && !paused()) raf = requestAnimationFrame(frame);
  };
  /** While the loop is idle, one timer wakes it for the next due blink. */
  const armBlinkTimer = (now: number) => {
    clearTimeout(blinkTimer);
    if (!shown.length || !visible || paused()) return;
    const due = Math.min(...shown.map((e) => e.blink.next));
    blinkTimer = window.setTimeout(kick, Math.max(0, due - now));
  };

  // All eyes glance the same general way, each a little differently, like a crowd turning.
  const glance = () => {
    if (pointer || paused()) return;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() < 0.25 ? 0 : 0.5 + Math.random() * 0.5;
    for (const e of shown) {
      const j = (Math.random() - 0.5) * 0.5;
      [e.th, e.tv] = aim(Math.cos(a + j), Math.sin(a + j), 1).map((n) => n * r) as [number, number];
    }
    kick();
    glanceTimer = window.setTimeout(glance, 1800 + Math.random() * 1600);
  };
  /** Wakes the loop when the idle clock crosses the next stage (drowsy at 10 s, asleep at 30 s). */
  const armIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (touchOnly || !visible || paused()) return;
    const idle = performance.now() - lastMove;
    const next = idle < DROWSY_AFTER ? DROWSY_AFTER : idle < ASLEEP_AFTER ? ASLEEP_AFTER : 0;
    if (next)
      idleTimer = window.setTimeout(() => {
        kick();
        armIdleTimer();
      }, next - idle);
  };

  const startTimers = () => {
    if (paused()) return;
    if (touchOnly && !glanceTimer) glance();
    armIdleTimer();
    armBlinkTimer(performance.now());
  };
  const stopTimers = () => {
    clearTimeout(glanceTimer);
    clearTimeout(blinkTimer);
    clearTimeout(idleTimer);
    glanceTimer = blinkTimer = idleTimer = 0;
  };

  if (!touchOnly) {
    window.addEventListener(
      'pointermove',
      (ev) => {
        if (ev.pointerType === 'touch' || paused()) return;
        pointer = { x: ev.clientX, y: ev.clientY };
        const now = performance.now();
        const wasIdle = now - lastMove >= DROWSY_AFTER || left;
        lastMove = now;
        left = false;
        if (wasIdle) armIdleTimer();
        else if (visible && !idleTimer) armIdleTimer();
        kick();
      },
      { passive: true },
    );
    // The pointer left the window: drowsy now
    document.addEventListener('pointerout', (ev) => {
      if (ev.relatedTarget || paused()) return;
      left = true;
      kick();
    });
  }

  // Pause freezes everything where it is; resuming shifts every clock by the time spent paused.
  document.addEventListener('motionchange', () => {
    if (paused()) {
      stopTimers();
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      pausedAt = performance.now();
    } else {
      const shift = pausedAt ? performance.now() - pausedAt : 0;
      pausedAt = 0;
      lastMove += shift;
      stageStart += shift;
      for (const e of eyes) {
        e.blink.next += shift;
        e.blink.start += shift;
      }
      if (visible) {
        measure();
        startTimers();
        kick();
      }
    }
  });

  const ro = new ResizeObserver(() => {
    measure();
    kick();
  });
  ro.observe(document.documentElement);

  const show = () => {
    visible = true;
    measure();
    spreadBlinks(performance.now());
    startTimers();
    kick();
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && document.visibilityState === 'visible') show();
    else {
      visible = false;
      stopTimers();
    }
  }).observe(band);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      visible = false;
      stopTimers();
    } else if (band.getBoundingClientRect().bottom > 0 && band.getBoundingClientRect().top < innerHeight) show();
  });
}
