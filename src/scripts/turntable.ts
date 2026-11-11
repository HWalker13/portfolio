/*
  Turntable behavior, as a custom element (<turn-table>).

  Why a custom element and not `client:visible`: Astro's client:* directives only apply to
  framework components (React, Svelte, …). A plain <script> in an .astro file is bundled as
  a module and runs on load. So we get the same "do nothing until it's on screen" effect with
  an IntersectionObserver, and the custom element gives us connect/disconnect lifecycle for free.

  How it "plays":
    - The needle's position comes from how far the record has actually turned (physics.ts:
      stepProgress → needleRadius → armAngleForRadius). Flick forward and the arm jumps in,
      scratch backwards and it moves back out. With the motor off the arm is up, so nothing moves it.
    - At the run-out groove the record swaps: a small state machine (advanceSwap) runs
      stopping → unloading → loading → starting over ~3 s of simulated time, so it pauses
      with the page.

  Rendering rule: the only per-frame DOM writes are transforms (record rotate, arm rotate,
  record slide). Layout is read once per drag (getBoundingClientRect on pointerdown).
  Changing which label is shown happens once per swap, while the record is out of sight.
*/
import records from '../data/records.json';
import {
  PARAMS,
  RPM_33,
  advanceSwap,
  isAtRest,
  isEndOfSide,
  needleAngle,
  nextIndex,
  normalizeAngle,
  pointerAngle,
  SLIDE_DISTANCE,
  recordSlide,
  releaseVelocity,
  requestSwap,
  stepPlatter,
  stepProgress,
  stepTonearm,
  unwrap,
  type PlatterState,
  type PointerSample,
  type Swap,
  type Tonearm,
} from './physics';

/** Tonearm rest angle (degrees, clockwise around the pivot). */
const ARM_REST = 0;
/** Arrow-key nudge. */
const NUDGE_DEG = 15;
/** Ignore pointer samples this close to the spindle; the angle there is all noise. */
const DEAD_ZONE_PX = 8;

class TurnTable extends HTMLElement {
  private record!: HTMLElement;
  private disc!: HTMLElement;
  private arm!: SVGElement;
  private motorBtn!: HTMLButtonElement;
  private switchBtn!: HTMLButtonElement;
  private status!: HTMLElement;
  private caption!: HTMLElement;
  private labels: SVGGElement[] = [];

  private platter: PlatterState = { angle: 0, velocity: 0 };
  private motorOn = false;
  private tonearm: Tonearm = { angle: ARM_REST, down: false };
  /** 0 = lead-in groove, 1 = run-out groove */
  private progress = 0;
  private recordIndex = 0;
  private swap: Swap = null;
  /** Record offset during a swap, in record heights */
  private slide = 0;
  /** How far this swap slides the record (record heights), measured when the swap starts */
  private slideDistance = SLIDE_DISTANCE;
  /** Rotation from drags and arrow keys since the last frame (°, unwrapped) */
  private pendingDelta = 0;

  private dragging = false;
  private pointerId = -1;
  private center = { x: 0, y: 0 };
  private pointerUnwrapped = 0;
  private grabOffset = 0;
  private samples: PointerSample[] = [];

  private visible = false;
  private raf = 0;
  private lastTime = 0;
  private rendered = { angle: NaN, arm: NaN, slide: NaN };

  private reduceMotion!: MediaQueryList;
  private observer?: IntersectionObserver;
  private abort?: AbortController;

  connectedCallback() {
    this.record = this.querySelector('.record')!;
    this.disc = this.querySelector('.disc')!;
    this.arm = this.querySelector('.arm')!;
    this.motorBtn = this.querySelector('.motor')!;
    this.switchBtn = this.querySelector('.switch')!;
    this.status = this.querySelector('[data-status]')!;
    this.caption = this.querySelector('[data-now-playing]')!;
    this.labels = [...this.querySelectorAll<SVGGElement>('[data-record]')];
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The page always starts on the first record, at the lead-in.
    // Reduced motion: the record starts still with the arm at rest.
    const autoplay = !this.reduceMotion.matches;
    this.motorOn = autoplay;
    this.platter = { angle: 0, velocity: autoplay ? RPM_33 : 0 };
    this.tonearm = autoplay ? { angle: needleAngle(0), down: true } : { angle: ARM_REST, down: false };
    this.motorBtn.setAttribute('aria-pressed', String(autoplay));
    this.render();

    this.abort = new AbortController();
    const opts = { signal: this.abort.signal };

    this.record.addEventListener('pointerdown', this.onPointerDown, opts);
    this.record.addEventListener('pointermove', this.onPointerMove, opts);
    this.record.addEventListener('pointerup', this.onPointerUp, opts);
    this.record.addEventListener('pointercancel', this.onPointerUp, opts);
    this.record.addEventListener('lostpointercapture', this.onPointerUp, opts);
    this.record.addEventListener('keydown', this.onKeyDown, opts);
    this.motorBtn.addEventListener('click', () => this.setMotor(!this.motorOn), opts);
    this.switchBtn.addEventListener('click', () => this.startSwap(), opts);
    document.addEventListener('visibilitychange', this.onVisibility, opts);
    this.reduceMotion.addEventListener(
      'change',
      (e) => {
        if (!e.matches) return;
        // Switching to reduced motion mid-swap: finish it instantly.
        if (this.swap) this.finishSwapInstantly();
        if (this.motorOn) this.setMotor(false);
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

  /** Is there anything left to animate? If not, the loop sleeps until something changes. */
  private needsFrames() {
    const armSettled = this.motorOn ? this.tonearm.down : this.tonearm.angle === ARM_REST;
    return (
      this.dragging ||
      this.swap !== null ||
      this.pendingDelta !== 0 ||
      !isAtRest(this.platter, this.motorOn) ||
      !armSettled
    );
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
    // Every step function clamps dt to PARAMS.maxDt, so a long frame can't make anything jump.
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // 1. Record swap state machine
    if (this.swap) {
      const s = advanceSwap(this.swap, dt);
      this.swap = s.swap;
      if (s.changeRecord) this.loadRecord(nextIndex(this.recordIndex, records.length));
      if (s.phase === 'starting' || s.done) this.setMotorState(true);
      else if (s.phase) this.setMotorState(false);
      this.slide = recordSlide(s.phase, s.t, this.slideDistance);
    }

    // 2. Platter: free-spinning unless a hand is on it
    let delta = this.pendingDelta;
    this.pendingDelta = 0;
    if (!this.dragging) {
      this.platter = stepPlatter(this.platter, this.motorOn, dt);
      delta += this.platter.delta ?? 0;
    }

    // 3. Needle: only a needle in the groove follows the record
    const needleDown = this.tonearm.down && this.motorOn && !this.swap;
    this.progress = stepProgress(this.progress, delta, needleDown);
    this.tonearm = this.reduceMotion.matches ? this.snapArm() : stepTonearm(this.tonearm, this.motorOn, this.progress, dt, ARM_REST);

    // 4. End of the side
    if (needleDown && isEndOfSide(this.progress)) this.endOfSide();

    this.render();
    if (this.canRun()) this.raf = requestAnimationFrame(this.frame);
  };

  /** Reduced motion: the arm doesn't swing, it's simply where it should be. */
  private snapArm(): Tonearm {
    return this.motorOn ? { angle: needleAngle(this.progress), down: true } : { angle: ARM_REST, down: false };
  }

  /** The only DOM writes: transforms, and only when a value changed. */
  private render() {
    const { angle } = this.platter;
    if (angle !== this.rendered.angle) {
      this.disc.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      this.rendered.angle = angle;
    }
    if (this.tonearm.angle !== this.rendered.arm) {
      this.arm.style.transform = `rotate(${this.tonearm.angle.toFixed(2)}deg)`;
      this.rendered.arm = this.tonearm.angle;
    }
    if (this.slide !== this.rendered.slide) {
      this.record.style.transform = this.slide ? `translateY(${(this.slide * 100).toFixed(2)}%)` : '';
      this.rendered.slide = this.slide;
    }
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  // ── Motor, end of side, swap ────────────────────────────────────────────

  /** Start/Stop button and Space. Ignored mid-swap: the swap drives the motor. */
  private setMotor(on: boolean) {
    if (this.swap) return;
    // Starting again at the run-out cues back to the lead-in.
    if (on && isEndOfSide(this.progress)) this.progress = 0;
    this.setMotorState(on);
    this.start();
  }

  private setMotorState(on: boolean) {
    if (this.motorOn === on) return;
    this.motorOn = on;
    this.motorBtn.setAttribute('aria-pressed', String(on));
  }

  private endOfSide() {
    // Reduced motion: no auto-advance to the next record; the motor stops and the arm returns.
    if (this.reduceMotion.matches) this.setMotorState(false);
    else this.startSwap();
  }

  /** Switch record button, and the end of a side. A press during a swap is ignored. */
  private startSwap() {
    const { swap, accepted } = requestSwap(this.swap);
    if (!accepted) return;
    if (this.reduceMotion.matches) {
      // No slide: the next record is simply on the platter. The motor state doesn't change.
      this.loadRecord(nextIndex(this.recordIndex, records.length));
      this.render();
      return;
    }
    this.dragging = false;
    this.slideDistance = this.measureSlide();
    this.swap = swap;
    this.start();
  }

  /**
    One layout read per swap: on the home page the turntable sits on the orange stage, and the
    album sleeve covers everything below the stage's bottom edge ([data-swap-edge]). Slide until
    the record's top edge is past it, so the record tucks fully under the sleeve at any layout.
    Elsewhere, use the default.
  */
  private measureSlide(): number {
    const edge = this.closest('[data-swap-edge]');
    if (!edge) return SLIDE_DISTANCE;
    const rec = this.record.getBoundingClientRect();
    const needed = (edge.getBoundingClientRect().bottom - rec.top) / rec.height;
    return Math.max(SLIDE_DISTANCE, needed + 0.05);
  }

  private finishSwapInstantly() {
    if (!this.swap) return;
    const { phase } = advanceSwap(this.swap, 0);
    if (phase === 'stopping' || phase === 'unloading') this.loadRecord(nextIndex(this.recordIndex, records.length));
    this.swap = null;
    this.slide = 0;
    this.render();
  }

  /** Put record `i` on the platter: new label, back to the lead-in, needle up. */
  private loadRecord(i: number) {
    this.labels[this.recordIndex]?.setAttribute('display', 'none');
    this.labels[this.recordIndex]?.removeAttribute('data-current');
    this.recordIndex = i;
    this.labels[i]?.removeAttribute('display');
    this.labels[i]?.setAttribute('data-current', '');
    this.platter = { angle: 0, velocity: 0 };
    this.progress = 0;
    this.tonearm = { angle: this.tonearm.angle, down: false };
    const r = records[i]!;
    this.caption.textContent = `${r.album} · ${r.artist}`;
    this.status.textContent = `Now playing: ${r.album} by ${r.artist}`;
    // Anything else showing the current record (the record pinned on the Let's talk board) follows this.
    document.dispatchEvent(new CustomEvent('turntable:record', { detail: { index: i } }));
  }

  // ── Pointer: grab, spin, scratch ────────────────────────────────────────

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.dragging || this.swap) return; // ignore a second finger, and the record mid-swap

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
    const next = unwrap(this.pointerUnwrapped, raw);
    this.pendingDelta += next - this.pointerUnwrapped; // the needle follows the hand, both ways
    this.pointerUnwrapped = next;
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
      if (this.swap) return;
      const delta = e.key === 'ArrowRight' ? NUDGE_DEG : -NUDGE_DEG;
      this.platter = { ...this.platter, angle: normalizeAngle(this.platter.angle + delta) };
      this.pendingDelta += delta;
      this.render();
      this.start();
    } else if (e.key === ' ') {
      e.preventDefault(); // don't scroll the page
      if (!e.repeat) this.setMotor(!this.motorOn);
    }
  };
}

if (!customElements.get('turn-table')) customElements.define('turn-table', TurnTable);
