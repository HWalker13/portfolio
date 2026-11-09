/*
  Turntable behavior, as a custom element (<turn-table>).

  Why a custom element and not `client:visible`: Astro's client:* directives only apply to
  framework components (React, Svelte, …). A plain <script> in an .astro file is bundled as
  a module and runs on load. So we get the same "do nothing until it's on screen" effect with
  an IntersectionObserver, and the custom element gives us connect/disconnect lifecycle for free.

  Rendering rule: the only DOM writes per frame are two `transform: rotate()` values.
  Layout is read once per drag (getBoundingClientRect on pointerdown), never per frame.
*/
import {
  PARAMS,
  RPM_33,
  isAtRest,
  normalizeAngle,
  pointerAngle,
  releaseVelocity,
  stepArm,
  stepPlatter,
  unwrap,
  type PlatterState,
  type PointerSample,
} from './physics';

/** Tonearm angles (degrees, clockwise around the pivot). 27° puts the stylus on the outer grooves. */
const ARM_REST = 0;
const ARM_PLAY = 27;
/** Arrow-key nudge. */
const NUDGE_DEG = 15;
/** Ignore pointer samples this close to the spindle; the angle there is all noise. */
const DEAD_ZONE_PX = 8;

class TurnTable extends HTMLElement {
  private record!: HTMLElement;
  private disc!: HTMLElement;
  private arm!: SVGElement;
  private button!: HTMLButtonElement;
  private status!: HTMLElement;

  private platter: PlatterState = { angle: 0, velocity: 0 };
  private motorOn = false;
  private armAngle = ARM_REST;

  private dragging = false;
  private pointerId = -1;
  private center = { x: 0, y: 0 };
  private pointerUnwrapped = 0;
  private grabOffset = 0;
  private samples: PointerSample[] = [];

  private visible = false;
  private raf = 0;
  private lastTime = 0;
  private renderedAngle = Number.NaN;
  private renderedArm = Number.NaN;

  private reduceMotion!: MediaQueryList;
  private observer?: IntersectionObserver;
  private abort?: AbortController;

  connectedCallback() {
    this.record = this.querySelector('.record')!;
    this.disc = this.querySelector('.disc')!;
    this.arm = this.querySelector('.arm')!;
    this.button = this.querySelector('.motor')!;
    this.status = this.querySelector('[data-status]')!;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Reduced motion: the record starts still and the arm rests. Dragging and the button still work.
    this.setMotor(!this.reduceMotion.matches, { instant: true, announce: false });

    this.abort = new AbortController();
    const opts = { signal: this.abort.signal };

    this.record.addEventListener('pointerdown', this.onPointerDown, opts);
    this.record.addEventListener('pointermove', this.onPointerMove, opts);
    this.record.addEventListener('pointerup', this.onPointerUp, opts);
    this.record.addEventListener('pointercancel', this.onPointerUp, opts);
    this.record.addEventListener('lostpointercapture', this.onPointerUp, opts);
    this.record.addEventListener('keydown', this.onKeyDown, opts);
    this.button.addEventListener('click', () => this.setMotor(!this.motorOn), opts);
    document.addEventListener('visibilitychange', this.onVisibility, opts);
    this.reduceMotion.addEventListener(
      'change',
      (e) => {
        if (e.matches && this.motorOn) this.setMotor(false, { instant: true });
      },
      opts,
    );

    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? false;
      if (this.visible) this.start();
      else this.stop();
    });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.stop();
    this.observer?.disconnect();
    this.abort?.abort();
  }

  // ── Loop ────────────────────────────────────────────────────────────────

  private armTarget() {
    return this.motorOn ? ARM_PLAY : ARM_REST;
  }

  /** Is there anything left to animate? If not, the loop sleeps until something changes. */
  private needsFrames() {
    return this.dragging || !isAtRest(this.platter, this.motorOn) || this.armAngle !== this.armTarget();
  }

  private canRun() {
    return this.visible && !document.hidden && this.needsFrames();
  }

  private start() {
    if (this.raf || !this.canRun()) return;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number) => {
    this.raf = 0;
    // stepPlatter/stepArm clamp dt to PARAMS.maxDt, so a long frame can't make the record jump.
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!this.dragging) this.platter = stepPlatter(this.platter, this.motorOn, dt);
    this.armAngle = this.reduceMotion.matches
      ? this.armTarget()
      : stepArm(this.armAngle, this.motorOn, ARM_REST, ARM_PLAY, dt);

    this.render();
    if (this.canRun()) this.raf = requestAnimationFrame(this.frame);
  };

  /** The only DOM writes: two rotations, and only when the value changed. */
  private render() {
    if (this.platter.angle !== this.renderedAngle) {
      this.disc.style.transform = `rotate(${this.platter.angle.toFixed(2)}deg)`;
      this.renderedAngle = this.platter.angle;
    }
    if (this.armAngle !== this.renderedArm) {
      this.arm.style.transform = `rotate(${this.armAngle.toFixed(2)}deg)`;
      this.renderedArm = this.armAngle;
    }
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  // ── Motor ───────────────────────────────────────────────────────────────

  private setMotor(on: boolean, { instant = false, announce = true } = {}) {
    this.motorOn = on;
    this.button.setAttribute('aria-pressed', String(on));
    if (instant) {
      this.platter = { ...this.platter, velocity: on ? RPM_33 : 0 };
      this.armAngle = this.armTarget();
      this.render();
    }
    if (announce) this.status.textContent = on ? 'Motor on. The record is spinning.' : 'Motor off.';
    this.start();
  }

  // ── Pointer: grab, spin, scratch ────────────────────────────────────────

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.dragging) return; // ignore a second finger

    // One layout read per drag. The .record box doesn't rotate, so its rect is stable.
    const rect = this.record.getBoundingClientRect();
    this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    const a = pointerAngle(this.center.x, this.center.y, e.clientX, e.clientY);
    this.pointerUnwrapped = a;
    this.grabOffset = this.platter.angle - a;
    this.samples = [{ t: e.timeStamp / 1000, angle: a }];

    this.dragging = true;
    this.pointerId = e.pointerId;
    this.platter = { ...this.platter, velocity: 0 }; // a hand on the record stops it
    this.record.setPointerCapture(e.pointerId);
    this.start();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.center.x;
    const dy = e.clientY - this.center.y;
    if (dx * dx + dy * dy < DEAD_ZONE_PX * DEAD_ZONE_PX) return;

    const raw = pointerAngle(this.center.x, this.center.y, e.clientX, e.clientY);
    this.pointerUnwrapped = unwrap(this.pointerUnwrapped, raw);
    this.platter = { ...this.platter, angle: normalizeAngle(this.pointerUnwrapped + this.grabOffset) };

    const t = e.timeStamp / 1000;
    this.samples.push({ t, angle: this.pointerUnwrapped });
    // Keep only what releaseVelocity could use.
    while (this.samples.length > 2 && t - this.samples[0]!.t > PARAMS.sampleWindow * 2) this.samples.shift();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = -1;
    // Let go: keep whatever spin the hand gave it. The motor (or brake) takes it from here.
    const velocity = e.type === 'pointerup' ? releaseVelocity(this.samples, e.timeStamp / 1000) : 0;
    this.platter = { ...this.platter, velocity };
    this.samples = [];
    if (this.record.hasPointerCapture(e.pointerId)) this.record.releasePointerCapture(e.pointerId);
    this.start();
  };

  // ── Keyboard ────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? NUDGE_DEG : -NUDGE_DEG;
      this.platter = { ...this.platter, angle: normalizeAngle(this.platter.angle + delta) };
      this.render();
    } else if (e.key === ' ') {
      e.preventDefault(); // don't scroll the page
      if (!e.repeat) this.setMotor(!this.motorOn);
    }
  };
}

if (!customElements.get('turn-table')) customElements.define('turn-table', TurnTable);
