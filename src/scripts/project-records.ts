/*
  The small project records in the reel. Each one spins at 33⅓ RPM while its section is
  focused (it holds the viewport's center line, or has keyboard focus) or hovered, and eases to
  a stop otherwise, always coming to rest upright so the name on the label reads.

  - One rAF loop for all records, transform only (rotate on the [data-spin] wrapper).
  - Asleep when the reel is offscreen, while "Pause motion" is on (<html data-motion="paused">,
    announced with 'motionchange'), and never started under prefers-reduced-motion.
  - The motion itself is a pure function, stepSpin, unit-tested in project-records.test.ts.
*/
import { approach, clampDt, RPM_33 } from './physics';

export const SPIN = {
  /** Spin-up: same pull as the turntable motor (~92% of 33⅓ RPM after 1 s). */
  spinUpK: 2.5,
  /** Braking, °/s². From 33⅓ RPM that's 0.8 s and 83° to stop. */
  brake: 250,
  /** Slowest it creeps toward its rest angle, so a brief hover still finishes in a few seconds. */
  minCoast: 120,
} as const;

export interface Spin {
  /** Rotation in [0, 360) while spinning; up to stopAt while stopping. */
  angle: number;
  /** °/s, never negative: these records only turn forward. */
  velocity: number;
  /** The upright angle (a multiple of 360) it's braking toward, or null. */
  stopAt: number | null;
}

export const REST: Spin = { angle: 0, velocity: 0, stopAt: null };

export function isResting(s: Spin): boolean {
  return s.velocity === 0 && s.stopAt === null;
}

/**
  One step. Active: the motor pulls toward 33⅓ RPM. Inactive: pick the next upright angle it
  can reach with comfortable braking, then follow the braking curve v = √(2·a·remaining) so it
  lands exactly upright, never overshooting and never turning backward.
*/
export function stepSpin(s: Spin, active: boolean, rawDt: number): Spin {
  const dt = clampDt(rawDt);
  if (active) {
    const velocity = approach(s.velocity, RPM_33, SPIN.spinUpK, dt);
    return { angle: (s.angle + velocity * dt) % 360, velocity, stopAt: null };
  }
  if (isResting(s)) return s;
  const stopAt = s.stopAt ?? Math.ceil((s.angle + (s.velocity * s.velocity) / (2 * SPIN.brake)) / 360) * 360;
  const remaining = stopAt - s.angle;
  // A slow record (a brief hover) eases up to a gentle coast instead of crawling for a whole turn
  const coast = s.velocity < SPIN.minCoast ? approach(s.velocity, SPIN.minCoast, SPIN.spinUpK, dt) : s.velocity;
  const velocity = Math.min(coast, Math.sqrt(2 * SPIN.brake * remaining));
  const angle = Math.min(s.angle + velocity * dt, stopAt);
  if (stopAt - angle < 0.05) return REST;
  return { angle, velocity, stopAt };
}

export function startProjectRecords() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reel = document.querySelector<HTMLElement>('[data-reel]');
  if (!reel) return;
  const root = document.documentElement;
  const paused = () => root.dataset.motion === 'paused';

  const records = [...reel.querySelectorAll<HTMLElement>('[data-proj]')].flatMap((section) => {
    const el = section.querySelector<HTMLElement>('[data-spin]');
    return el ? [{ section, el, spin: REST, hovered: false, focused: false }] : [];
  });

  let onScreen = false;
  let raf = 0;
  let last = 0;

  /** The section holding the viewport's center line. */
  const centered = () => {
    const mid = window.innerHeight / 2;
    return records.findIndex(({ section }) => {
      const r = section.getBoundingClientRect();
      return r.top <= mid && r.bottom > mid;
    });
  };

  const draw = (r: (typeof records)[number]) => {
    r.el.style.transform = isResting(r.spin) ? '' : `rotate(${r.spin.angle.toFixed(2)}deg)`;
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const c = centered();
    let moving = false;
    records.forEach((r, i) => {
      r.spin = stepSpin(r.spin, i === c || r.hovered || r.focused, dt);
      draw(r);
      if (!isResting(r.spin) || i === c || r.hovered || r.focused) moving = true;
    });
    if (moving) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  const kick = () => {
    if (!raf && onScreen && !paused() && !reduce.matches && document.visibilityState === 'visible') {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  /** Stop instantly, upright. Used for pause and offscreen (no easing: that would be motion too). */
  const halt = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    records.forEach((r) => {
      r.spin = REST;
      draw(r);
    });
  };

  records.forEach((r) => {
    r.section.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      r.hovered = true;
      kick();
    });
    r.section.addEventListener('pointerleave', () => {
      r.hovered = false;
    });
    r.section.addEventListener('focusin', () => {
      r.focused = true;
      kick();
    });
    r.section.addEventListener('focusout', (e) => {
      if (!r.section.contains(e.relatedTarget as Node | null)) r.focused = false;
    });
  });

  window.addEventListener('scroll', kick, { passive: true });
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) kick();
    else halt();
  }).observe(reel);
  document.addEventListener('motionchange', () => (paused() ? halt() : kick()));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick();
  });
  reduce.addEventListener('change', () => (reduce.matches ? halt() : kick()));
}
