/*
  Eyes band: the irises side-eye the cursor, the eyes blink, and they get sleepy.

  - One pointermove listener on window and one requestAnimationFrame loop for every eye.
    Writes are transform only: translate on each eye's .look group (the iris) and on its .lid.
    Layout reads (eye centers and rotations) happen on load and resize, never per frame.
  - Side-eye: each eye turns the pointer direction into its own (rotated) frame, aims at the edge
    of an almond-shaped travel range, and reaches it once the pointer is ~170px away. Horizontal
    travel runs deep toward the corners; vertical travel is small, so the upper lid always keeps
    the top of the iris and the iris never rolls out of view. The limits keep the pupil and its
    catchlights fully visible at full deflection (checked in eyes.test.ts against eye-art.ts).
  - Blinks: every 2–5 s one random visible eye blinks (~150ms), never the same eye twice running.
  - Sleepy: 10 s without pointer movement, or the pointer leaving the window, and every lid droops
    a third closed over 1.5 s; the next pointer move opens them quickly.
  - Touch-only devices (no hover): the eyes glance around on their own and blink; no drooping.
  - Still under prefers-reduced-motion (no blinks, no drooping), and while the hero's "Pause
    motion" toggle is on (<html data-motion="paused">, announced with a 'motionchange' event).
  - Timers and the loop only run while the band is on screen and the tab is visible.
*/

// ── Side-eye (pure, tested) ────────────────────────────────────────────
/** Pointer distance (CSS px) at which an eye looks as hard as it can. */
export const REACH = 170;
/**
  Travel limits in eye units (the iris is 66 wide). Sideways the iris presses into the corner;
  as it does, it follows the almond's midline down (the corners sit lower than the iris's rest
  position), more toward the lower inner corner. Up/down travel is small and fades toward the
  corners, where the opening is too narrow to give.
*/
export const TRAVEL = {
  inner: 40, // toward the inner corner (left, -x)
  outer: 40, // toward the outer corner (right, +x)
  followInner: 10, // how far down the iris rides at the inner corner
  followOuter: 6,
  up: 0.6, // the upper lid already hides the iris's top: looking up barely lifts it
  down: 5,
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

/** The iris offset (eye units) for an aim (h, v). */
export function irisOffset(h: number, v: number): [number, number] {
  const x = h < 0 ? h * TRAVEL.inner : h * TRAVEL.outer;
  const follow = h < 0 ? TRAVEL.followInner * h * h : TRAVEL.followOuter * h * h;
  const room = 1 - h * h; // vertical give, gone at the corners
  const y = follow + (v < 0 ? v * TRAVEL.up : v * TRAVEL.down) * room;
  return [x, y];
}

/** A screen-space vector expressed in the frame of an eye rotated by `rot` radians. */
export function toEyeFrame(dx: number, dy: number, rot: number): [number, number] {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  return [dx * c - dy * s, dx * s + dy * c];
}

/** Frame-rate independent easing of a value toward a target (rate k per second). */
export const ease = (value: number, target: number, k: number, dt: number) => target + (value - target) * Math.exp(-k * dt);

// ── Blinks (pure, tested) ──────────────────────────────────────────────
export const BLINK_MS = 150;
/** 2–5 s until the next blink, from a random number in [0, 1). */
export const blinkDelay = (rand: number) => 2000 + rand * 3000;
/** A random eye index, never `last` (when there's a choice). */
export function pickBlinkEye(count: number, last: number, rand: number): number {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.floor(rand * count);
  const i = Math.floor(rand * (count - 1));
  return i >= last ? i + 1 : i;
}
/** How closed a blinking lid is, `ms` into the blink: shut at the midpoint, open at both ends. */
export const blinkClosure = (ms: number) => (ms <= 0 || ms >= BLINK_MS ? 0 : Math.sin((Math.PI * ms) / BLINK_MS));

// ── Sleepy eyes (pure, tested) ─────────────────────────────────────────
export const SLEEP_AFTER = 10_000;
export const DROOP = 1 / 3; // a third closed: heavy-lidded, pupils still showing
export const DROOP_MS = 1500;
export const WAKE_MS = 150;
export type Wake = 'awake' | 'drooping';
/**
  Next wake state. Pointer movement always wakes; otherwise the pointer leaving the window, or
  SLEEP_AFTER ms without movement, starts the droop.
*/
export function wakeStep(state: Wake, input: { idleMs: number; left: boolean; moved: boolean }): Wake {
  if (input.moved) return 'awake';
  if (input.left || input.idleMs >= SLEEP_AFTER) return 'drooping';
  return state;
}
/** Lid closure (0 open, 1 shut) moving toward its target: slow to droop, quick to open. */
export function stepLid(closure: number, target: number, dtMs: number): number {
  if (target > closure) return Math.min(target, closure + (DROOP / DROOP_MS) * dtMs);
  return Math.max(target, closure - (1 / WAKE_MS) * dtMs);
}

// ── DOM ────────────────────────────────────────────────────────────────
interface Eye {
  el: SVGSVGElement;
  look: SVGGElement;
  lid: SVGGElement;
  cx: number; // page coordinates of the eye center
  cy: number;
  rot: number; // radians
  x: number; // current iris offset (eye units)
  y: number;
  tx: number; // target iris offset
  ty: number;
  closure: number; // the lid as last drawn
}

/** "0deg" | "12.5deg" | "none" → radians */
function parseRotate(v: string): number {
  const m = v.match(/(-?[\d.]+)deg/);
  return m ? (Number(m[1]) * Math.PI) / 180 : 0;
}

export function startEyes() {
  const band = document.querySelector<HTMLElement>('[data-eyes]');
  if (!band) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return; // still, looking straight ahead, no blinks, no drooping

  const root = document.documentElement;
  const paused = () => root.dataset.motion === 'paused';
  const touchOnly = window.matchMedia('(hover: none)').matches;
  const lidRest = Number(band.dataset.lidRest);
  const lidTravel = Number(band.dataset.lidTravel);
  const eyes: Eye[] = [...band.querySelectorAll<SVGSVGElement>('.eye')].map((el) => ({
    el,
    look: el.querySelector<SVGGElement>('.look')!,
    lid: el.querySelector<SVGGElement>('.lid')!,
    cx: 0,
    cy: 0,
    rot: 0,
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    closure: 0,
  }));
  let shown: Eye[] = [];

  let visible = false;
  let raf = 0;
  let last = 0;
  let pointer: { x: number; y: number } | null = null; // client coordinates
  let glanceTimer = 0;
  let blinkTimer = 0;
  let idleTimer = 0;
  let lastMove = performance.now();
  let wake: Wake = 'awake';
  let sleepClosure = 0;
  let blinking: { eye: Eye; start: number } | null = null;
  let lastBlink = -1;

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
  };

  const drawLid = (e: Eye, closure: number) => {
    if (Math.abs(closure - e.closure) < 0.002) return;
    e.closure = closure;
    e.lid.style.transform = closure ? `translate(0px, ${(lidRest + closure * lidTravel).toFixed(2)}px)` : '';
  };

  const frame = (now: number) => {
    raf = 0;
    if (!visible) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (pointer) {
      const px = pointer.x + window.scrollX;
      const py = pointer.y + window.scrollY;
      for (const e of shown) [e.tx, e.ty] = irisOffset(...aim(...toEyeFrame(px - e.cx, py - e.cy, e.rot)));
    }
    // Cursor-following eyes catch up quickly; glancing eyes drift
    const k = pointer ? 14 : 4;
    let moving = false;
    for (const e of shown) {
      e.x = ease(e.x, e.tx, k, dt);
      e.y = ease(e.y, e.ty, k, dt);
      if (Math.abs(e.tx - e.x) > 0.05 || Math.abs(e.ty - e.y) > 0.05) moving = true;
      else [e.x, e.y] = [e.tx, e.ty];
      e.look.style.transform = `translate(${e.x.toFixed(2)}px, ${e.y.toFixed(2)}px)`;
    }

    sleepClosure = stepLid(sleepClosure, wake === 'drooping' ? DROOP : 0, dt * 1000);
    if (sleepClosure !== (wake === 'drooping' ? DROOP : 0)) moving = true;
    let blinkC = 0;
    if (blinking) {
      blinkC = blinkClosure(now - blinking.start);
      if (now - blinking.start >= BLINK_MS) blinking = null;
      else moving = true;
    }
    for (const e of shown) drawLid(e, Math.max(sleepClosure, blinking && e === blinking.eye ? blinkC : 0));

    if (moving) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => {
    if (!raf && visible && !paused()) raf = requestAnimationFrame(frame);
  };

  // All eyes glance the same general way, each a little differently, like a crowd turning.
  const glance = () => {
    if (pointer || paused()) return;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() < 0.25 ? 0 : 0.5 + Math.random() * 0.5;
    for (const e of shown) {
      const j = (Math.random() - 0.5) * 0.5;
      [e.tx, e.ty] = irisOffset(...aim(Math.cos(a + j), Math.sin(a + j), 1).map((n) => n * r) as [number, number]);
    }
    kick();
    glanceTimer = window.setTimeout(glance, 1800 + Math.random() * 1600);
  };
  const blink = () => {
    if (shown.length) {
      lastBlink = pickBlinkEye(shown.length, lastBlink, Math.random());
      blinking = { eye: shown[lastBlink], start: performance.now() };
      kick();
    }
    blinkTimer = window.setTimeout(blink, blinkDelay(Math.random()));
  };
  /** Re-checks idleness when it could have run out; pointer moves just update lastMove. */
  const idleCheck = () => {
    idleTimer = 0;
    const idleMs = performance.now() - lastMove;
    const next = wakeStep(wake, { idleMs, left: false, moved: false });
    if (next !== wake) {
      wake = next;
      kick();
    } else if (wake === 'awake') idleTimer = window.setTimeout(idleCheck, SLEEP_AFTER - idleMs);
  };

  const startTimers = () => {
    if (paused()) return;
    if (!pointer && !glanceTimer) glance();
    if (!blinkTimer) blinkTimer = window.setTimeout(blink, blinkDelay(Math.random()));
    if (!touchOnly && !idleTimer && wake === 'awake') idleTimer = window.setTimeout(idleCheck, Math.max(0, SLEEP_AFTER - (performance.now() - lastMove)));
  };
  const stopTimers = () => {
    clearTimeout(glanceTimer);
    clearTimeout(blinkTimer);
    clearTimeout(idleTimer);
    glanceTimer = blinkTimer = idleTimer = 0;
  };
  /** Paused: stop everything, eyes open and looking straight ahead, instantly (easing is motion too). */
  const freeze = () => {
    stopTimers();
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    blinking = null;
    wake = 'awake';
    sleepClosure = 0;
    for (const e of eyes) {
      e.x = e.y = e.tx = e.ty = 0;
      e.look.style.transform = '';
      drawLid(e, 0);
    }
  };

  if (!touchOnly) {
    window.addEventListener(
      'pointermove',
      (ev) => {
        if (ev.pointerType === 'touch' || paused()) return;
        if (!pointer) {
          clearTimeout(glanceTimer);
          glanceTimer = 0;
        }
        pointer = { x: ev.clientX, y: ev.clientY };
        lastMove = performance.now();
        wake = wakeStep(wake, { idleMs: 0, left: false, moved: true });
        if (visible && !idleTimer) idleTimer = window.setTimeout(idleCheck, SLEEP_AFTER);
        kick();
      },
      { passive: true },
    );
    // The pointer left the window: droop now
    document.addEventListener('pointerout', (ev) => {
      if (ev.relatedTarget || paused()) return;
      wake = wakeStep(wake, { idleMs: performance.now() - lastMove, left: true, moved: false });
      kick();
    });
  }

  document.addEventListener('motionchange', () => {
    if (paused()) freeze();
    else if (visible) {
      measure();
      lastMove = performance.now();
      startTimers();
      kick();
    }
  });

  const ro = new ResizeObserver(() => {
    measure();
    kick();
  });
  ro.observe(document.documentElement);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && document.visibilityState === 'visible';
    if (visible) {
      measure();
      startTimers();
      kick();
    } else stopTimers();
  }).observe(band);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      visible = false;
      stopTimers();
    } else if (band.getBoundingClientRect().bottom > 0 && band.getBoundingClientRect().top < innerHeight) {
      visible = true;
      startTimers();
      kick();
    }
  });
}
