/*
  Eyes band: pupils follow the cursor, clamped inside each eye.

  - One pointermove listener on window, coalesced into one requestAnimationFrame.
  - Writes are transform only (translate on each eye's .look group). Layout reads (eye centers
    and rotations) happen on load and resize, never per frame.
  - Eyes are rotated (±15°), so the pointer direction is turned into each eye's own frame before
    clamping; the pupil then moves along the eye's axis, not the screen's.
  - Touch-only devices (no hover): the eyes glance around slowly on their own, and blink now and then.
  - Still under prefers-reduced-motion, and while the hero's "Pause motion" toggle is on
    (<html data-motion="paused">, announced with a 'motionchange' event).
  - The loop only runs while the band is on screen and the tab is visible.
*/

/**
  Max iris travel in SVG units. The iris is half the opening's width and already tucked under
  both lids, so it moves a little sideways and barely up and down, and always stays in the opening.
*/
export const TRAVEL_X = 12;
export const TRAVEL_Y = 4;
/** Distance (CSS px) at which the pupils reach full travel. Closer than this, they track less. */
const REACH = 260;

interface Eye {
  el: SVGSVGElement;
  look: SVGGElement;
  cx: number; // page coordinates of the eye center
  cy: number;
  rot: number; // radians
  x: number; // current pupil offset (eye frame)
  y: number;
  tx: number; // target pupil offset (eye frame)
  ty: number;
}

/** Clamp a direction to the eye's ellipse of travel, scaled by how far away the target is. */
export function pupilOffset(dx: number, dy: number, reach = REACH): [number, number] {
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return [0, 0];
  const strength = Math.min(1, d / reach);
  return [(dx / d) * TRAVEL_X * strength, (dy / d) * TRAVEL_Y * strength];
}

/** A screen-space vector expressed in the frame of an eye rotated by `rot` radians. */
export function toEyeFrame(dx: number, dy: number, rot: number): [number, number] {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  return [dx * c - dy * s, dx * s + dy * c];
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
  if (reduce.matches) return; // still, looking straight ahead

  const root = document.documentElement;
  const paused = () => root.dataset.motion === 'paused';
  const touchOnly = window.matchMedia('(hover: none)').matches;
  const eyes: Eye[] = [...band.querySelectorAll<SVGSVGElement>('.eye')].map((el) => ({
    el,
    look: el.querySelector<SVGGElement>('.look')!,
    cx: 0,
    cy: 0,
    rot: 0,
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
  }));
  let shown: Eye[] = [];

  let visible = false;
  let raf = 0;
  let pointer: { x: number; y: number } | null = null; // client coordinates
  let glanceTimer = 0;
  let blinkTimer = 0;

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

  const frame = () => {
    raf = 0;
    if (!visible) return;
    if (pointer) {
      const px = pointer.x + window.scrollX;
      const py = pointer.y + window.scrollY;
      for (const e of shown) [e.tx, e.ty] = pupilOffset(...toEyeFrame(px - e.cx, py - e.cy, e.rot));
    }
    // Glancing eyes drift slowly; cursor-following eyes catch up quickly.
    const ease = pointer ? 0.3 : 0.07;
    let moving = false;
    for (const e of shown) {
      e.x += (e.tx - e.x) * ease;
      e.y += (e.ty - e.y) * ease;
      if (Math.abs(e.tx - e.x) > 0.05 || Math.abs(e.ty - e.y) > 0.05) moving = true;
      e.look.style.transform = `translate(${e.x.toFixed(2)}px, ${e.y.toFixed(2)}px)`;
    }
    if (moving) raf = requestAnimationFrame(frame);
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
      e.tx = Math.cos(a + j) * TRAVEL_X * r;
      e.ty = Math.sin(a + j) * TRAVEL_Y * r;
    }
    kick();
    glanceTimer = window.setTimeout(glance, 1800 + Math.random() * 1600);
  };
  const blink = () => {
    if (!shown.length) return;
    const e = shown[Math.floor(Math.random() * shown.length)];
    e.el.classList.remove('blink');
    requestAnimationFrame(() => e.el.classList.add('blink'));
    blinkTimer = window.setTimeout(blink, 1400 + Math.random() * 2600);
  };

  const startTimers = () => {
    if (paused()) return;
    if (!pointer && !glanceTimer) glance();
    if (!blinkTimer) blinkTimer = window.setTimeout(blink, 1200);
  };
  const stopTimers = () => {
    clearTimeout(glanceTimer);
    clearTimeout(blinkTimer);
    glanceTimer = blinkTimer = 0;
  };
  /** Paused: stop everything and look straight ahead, instantly (no easing, that's motion too). */
  const freeze = () => {
    stopTimers();
    cancelAnimationFrame(raf);
    raf = 0;
    for (const e of eyes) {
      e.x = e.y = e.tx = e.ty = 0;
      e.look.style.transform = '';
      e.el.classList.remove('blink');
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
        kick();
      },
      { passive: true },
    );
  }

  document.addEventListener('motionchange', () => {
    if (paused()) freeze();
    else if (visible) {
      measure();
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
