/*
  Projects reel: the curved card wheel, the 01/04 counter buttons, and demo playback.

  The wheel follows normal page scroll; it never scrolls or snaps the page. Each frame:
    1. read window.scrollY (no layout reads: section centers are measured on resize only)
    2. turn it into a continuous card index p (0 = first card centered, 1 = second, ...)
    3. place each card on a cylinder by its distance from p: transform, opacity, filter only
  The loop only runs while something is changing (scroll, resize, tilt easing) and the reel
  is on screen.

  Playback: only the focused card plays (wheel), or the card that's in view (inline, phones).
  Reduced motion: no wheel (CSS hides it), no autoplay, Play buttons only.
*/

// ── Pure geometry (unit-tested in reel.test.ts) ───────────────────────────
/** Degrees of cylinder between neighboring cards. */
export const STEP_DEG = 40;
/** Cards further than this from the focus are hidden. */
export const MAX_VISIBLE = 2.2;

/**
  Continuous index from the viewport's center line and each section's center (page px).
  Between two section centers it interpolates linearly; outside them it clamps.
*/
export function reelIndex(viewCenter: number, centers: number[]): number {
  if (centers.length === 0) return 0;
  if (viewCenter <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (viewCenter <= centers[i + 1]) return i + (viewCenter - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return centers.length - 1;
}

export interface CardPose {
  /** px down from the focus position */
  y: number;
  /** px into the screen (negative = further away) */
  z: number;
  /** rotateX in degrees: cards above tip their top edge away, cards below their bottom edge */
  rotX: number;
  scale: number;
  opacity: number;
  blur: number;
  fringe: number;
  hidden: boolean;
}

/** Where a card sits on the wheel, given its signed distance d from the focus (in cards). */
export function cardPose(d: number, radius: number): CardPose {
  const ad = Math.abs(d);
  const a = (d * STEP_DEG * Math.PI) / 180;
  return {
    y: Math.sin(a) * radius,
    // Off-focus cards also step back a little, so a neighbor's near edge never cuts through the focus
    z: (Math.cos(a) - 1) * radius - Math.min(ad, 1) * radius * 0.12,
    rotX: -d * STEP_DEG,
    scale: 1 - Math.min(ad, 2) * 0.07,
    // Dimming is done with brightness (in the filter); opacity only fades the far cards out,
    // so the wave behind never shows through a neighbor card.
    opacity: Math.max(0, Math.min(1, 1 - (ad - 1.2) * 1.2)),
    // Quantized to quarter pixels so tiny scroll changes don't re-rasterize the blur
    blur: Math.round(Math.min(ad, 2) * 3 * 4) / 4,
    fringe: Math.min(1, ad * 1.4),
    hidden: ad > MAX_VISIBLE,
  };
}

// ── DOM ───────────────────────────────────────────────────────────────────
export function startReel() {
  const reel = document.querySelector<HTMLElement>('[data-reel]');
  if (!reel) return;
  const sections = [...reel.querySelectorAll<HTMLElement>('[data-proj]')];
  const wheel = reel.querySelector<HTMLElement>('[data-wheel]');
  const wheelCards = [...reel.querySelectorAll<HTMLElement>('.vcard[data-variant="wheel"]')];
  const inlineCards = [...reel.querySelectorAll<HTMLElement>('.vcard[data-variant="inline"]')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wheelMode = window.matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)');

  setupCounter(reel, reduce);
  setupPlayButtons(reel);

  // ── Wheel ──
  let centers: number[] = [];
  let radius = 380;
  let onScreen = false;
  let raf = 0;
  let focused = -1;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };

  const measure = () => {
    centers = sections.map((s) => {
      const r = s.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2;
    });
    const card = wheelCards[0];
    // Arc length between neighbors ≈ one card height, so cards sit edge to edge on the cylinder
    if (card) radius = card.offsetHeight * 1.45;
  };

  const render = () => {
    raf = 0;
    if (!wheelMode.matches || !onScreen) return;
    const p = reelIndex(window.scrollY + window.innerHeight / 2, centers);

    tilt.x += (tilt.tx - tilt.x) * 0.12;
    tilt.y += (tilt.ty - tilt.y) * 0.12;
    const tilting = Math.abs(tilt.tx - tilt.x) > 0.002 || Math.abs(tilt.ty - tilt.y) > 0.002;

    wheelCards.forEach((card, i) => {
      const d = i - p;
      const pose = cardPose(d, radius);
      if (pose.hidden) {
        card.style.visibility = 'hidden';
        return;
      }
      card.style.visibility = '';
      // The focused card leans toward the pointer; the lean fades as it rolls away.
      const lean = Math.max(0, 1 - Math.abs(d));
      const ry = tilt.x * 7 * lean;
      const rx = pose.rotX - tilt.y * 6 * lean;
      card.style.transform = `translate3d(0, ${pose.y.toFixed(1)}px, ${pose.z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${pose.scale.toFixed(3)})`;
      card.style.opacity = pose.opacity.toFixed(3);
      card.style.filter = pose.blur ? `blur(${pose.blur}px) brightness(${(1 - Math.min(Math.abs(d), 1.5) * 0.3).toFixed(2)})` : '';
      const fringe = card.querySelector<HTMLElement>('.fringe');
      if (fringe) fringe.style.opacity = pose.fringe.toFixed(2);
    });

    const nowFocused = Math.round(p);
    if (nowFocused !== focused) {
      focused = nowFocused;
      wheelCards.forEach((card, i) => {
        // Only the focused card can be reached by keyboard or pointer
        card.inert = i !== focused;
        setPlaying(card, i === focused && !reduce.matches);
      });
    }
    if (tilting) raf = requestAnimationFrame(render);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  if (wheel) {
    window.addEventListener('scroll', kick, { passive: true });
    new ResizeObserver(() => {
      measure();
      kick();
    }).observe(reel);
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) {
        measure();
        kick();
      } else {
        wheelCards.forEach((c) => setPlaying(c, false));
        focused = -1;
      }
    }).observe(reel);
    wheel.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = wheel.getBoundingClientRect();
      tilt.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      tilt.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    });
    wheel.addEventListener('pointerleave', () => {
      tilt.tx = tilt.ty = 0;
      kick();
    });
    wheelMode.addEventListener('change', () => {
      focused = -1;
      measure();
      kick();
    });
  }

  // ── Inline cards (phones): autoplay muted while mostly visible, unless reduced motion ──
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (wheelMode.matches) continue;
          setPlaying(e.target as HTMLElement, e.intersectionRatio >= 0.6 && !reduce.matches);
        }
      },
      { threshold: [0, 0.6] },
    );
    inlineCards.forEach((c) => io.observe(c));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') [...wheelCards, ...inlineCards].forEach((c) => setPlaying(c, false));
    else {
      focused = -1;
      kick();
    }
  });
}

/** Cards the visitor paused stay paused until they press Play again. */
const userPaused = new WeakSet<HTMLElement>();

function setPlaying(card: HTMLElement, play: boolean) {
  const video = card.querySelector('video');
  if (!video) return;
  if (play && !userPaused.has(card)) {
    video.play().then(
      () => syncButton(card, true),
      () => syncButton(card, false), // autoplay blocked: leave the Play button showing
    );
  } else {
    video.pause();
    syncButton(card, false);
  }
}

function syncButton(card: HTMLElement, playing: boolean) {
  const btn = card.querySelector<HTMLButtonElement>('[data-play]');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(playing));
  const text = btn.querySelector('.vplay-text');
  if (text) text.textContent = playing ? 'Pause' : 'Play';
}

function setupPlayButtons(reel: HTMLElement) {
  reel.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-play]');
    if (!btn) return;
    const card = btn.closest<HTMLElement>('.vcard')!;
    const video = card.querySelector('video')!;
    if (video.paused) {
      userPaused.delete(card);
      setPlaying(card, true);
    } else {
      userPaused.add(card);
      setPlaying(card, false);
    }
  });
}

/** Up/down buttons: scroll to the neighbor section and move focus to its heading. */
function setupCounter(reel: HTMLElement, reduce: MediaQueryList) {
  reel.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-go]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.go!);
    if (!target) return;
    target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    const heading = target.querySelector<HTMLElement>('h2, h3');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  });
}
