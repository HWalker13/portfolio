# Holden Anderson — Portfolio Site

This file is the spec for this repo. Read all of it before writing code, and re-read the relevant section before each milestone.

## Why this site exists

I'm Holden Anderson, a CS student at CSU San Bernardino, graduating May 2027. I'm applying to new-grad 2027 and junior roles in backend, infrastructure and AI engineering.

Every claim on my resume is self-reported, and recruiters have no way to check it in 8 seconds. **This site's job is to turn those claims into evidence a stranger can check in under a minute**: live App Store link, PyPI packages, public repos, real numbers with context.

Three audiences, in priority order:
1. **Recruiters** skimming for 30 seconds. They must see who I am, what I build, and links to proof without scrolling far.
2. **Engineers/hiring managers** who click into a project. They want the hard problem, the decision I made, and the trade-off.
3. **Founders** I cold-message. They want to see that I ship.

Personality is the differentiator, but never at the cost of audience #1. If an effect slows down skimming, cut it.

## Stack (and why)

- **Astro + TypeScript.** The site is almost entirely static content, and Astro ships zero JS by default. The only interactive piece (the turntable) is a single island. I need to be able to explain this choice in an interview.
- **Plain CSS with custom properties** (no Tailwind). The design is very custom, so utility classes wouldn't save much, and tokens on `:root` make theming easy.
- **The turntable is vanilla TypeScript + SVG** inside an Astro component, loaded with `client:visible`. No React or animation libraries. It doesn't need them.
- **Project content lives in an Astro content collection** (`src/content/projects/*.md`) with typed frontmatter (zod schema), so adding a project later means adding one Markdown file.
- **Deploy target: Vercel**, static output. Don't deploy anything yourself; I'll connect the repo.
- No analytics, no cookies, no backend.

## Design direction: 70s soul / funk

The vibe is a warm 1970s record store and album sleeve. It should be confident and fun, but still readable and professional.

**Palette (define as tokens on `:root`):**
- `--cream` #F3E6CC (page background)
- `--paper` #FBF4E4 (cards/surfaces)
- `--chocolate` #3B2314 (primary text)
- `--burnt-orange` #D9622B (primary accent, links)
- `--mustard` #E0A526 (secondary accent)
- `--avocado` #6B7B3A (tertiary, use sparingly)
- `--walnut` #6E4527 (wood tones, turntable plinth)

Add a dark theme under `@media (prefers-color-scheme: dark)` using deep brown (#1E140D) as the background and cream text, with the same accents. Every text/background pair must meet WCAG AA contrast. Check orange-on-cream in particular, and darken the orange for body-size link text if needed.

**Type:**
- Display/headings: **Fraunces** from Google Fonts, using the soft, heavy variable axes for a Cooper-Black-ish 70s feel.
- Body: a clean, highly readable sans (**DM Sans** or similar).
- Monospace for numbers/code: **JetBrains Mono** or similar.

**Motifs, used with restraint:** stacked 70s stripes (orange/mustard/brown) as section dividers, rounded corners, subtle paper grain, record-sleeve framing on project cards.

**Do NOT do these** (they make the site look AI-generated or templated):
- A gradient blob hero, "Hi, I'm Holden 👋", or emoji anywhere
- Typing-effect headlines or "I'm a passionate developer who…" copy
- A grid of identical cards each with a row of 8 tech pills
- Parallax, scroll-jacking, or a custom cursor
- Stock icons for every skill

## Site structure

### Home (`/`), a single page

1. **Hero:** name, a one-line description (e.g., "Backend & AI engineer. I build things from scratch to understand them."), and the **turntable** as the visual centerpiece. Primary links are always visible: GitHub, LinkedIn, Resume (PDF), Email.
2. **Tracklist (projects):** styled like the back of an album sleeve, as a numbered track listing split into **Side A** and **Side B**. Each "track" shows the project name, a one-line description, 1–2 headline numbers, and proof links (App Store / PyPI / GitHub), plus a link to its liner-notes page. It must scan like a list, not a puzzle.
   - Side A: 1. Lovely, 2. NFL Game Predictor
   - Side B: 3. swapLLM + swaptrace, 4. Kache
3. **About:** 3–4 sentences, plus the stack I actually use: Python, FastAPI, TypeScript, React Native (Expo), PostgreSQL, Redis, Docker, AWS (EC2/ECS), pytest.
4. **Footer/contact:** email, links, and a small "built with Astro" note.

### Project pages (`/projects/[slug]`), the "liner notes"

Use the same template for each project:
- Title, role/date, stack, and proof links at the top
- **The problem** (2–3 sentences)
- **What I built** (short; a simple diagram is welcome where it helps, as inline SVG)
- **The hard part / the decision**. This is the most important section.
- **Results** with numbers, always next to their baseline or context
- **What I'd do differently**

Keep each page readable in about 2 minutes.

## The turntable (the personality feature)

This is the part that should feel like me. Build it as `src/components/Turntable.astro`, with its script in `src/scripts/turntable.ts`.

**Look:** a top-down or slight 3/4 view of a 70s turntable. Walnut wood-grain plinth, metal platter, black vinyl with visible grooves and a light sheen, a center label in burnt orange/mustard reading "HOLDEN ANDERSON / SIDE A / 33⅓", a tonearm, and a small start/stop button. Build it in SVG, with CSS gradients for the sheen. No raster images are needed.

**Behavior:**
- It **spins on its own** at 33⅓ RPM (one rotation every 1.8s) on load, with the tonearm resting on the record.
- **The visitor can grab the record and spin it** with mouse or touch, using Pointer Events. Track angular velocity from pointer movement around the center. On release, the record keeps that momentum and eases back toward 33⅓ RPM, as if the motor is pulling it back up to speed. Spinning backwards should work too, like a scratch.
- **Start/stop button:** stopping winds the platter down over about 1s and lifts the tonearm off the record. Starting does the reverse.
- The sheen/highlight stays fixed while the grooves rotate, so the spin reads as real.
- **No audio.** Visual only.

**Engineering requirements:**
- Animate with `requestAnimationFrame`, and only change `transform: rotate()`. No layout thrash.
- Pause the loop when the turntable is offscreen (IntersectionObserver) and when the tab is hidden (`visibilitychange`).
- `touch-action: none` only on the record itself, so page scrolling on mobile still works everywhere else.
- **`prefers-reduced-motion`:** no auto-spin, and the record starts still. Dragging still works.
- **Accessible:** the button is a real `<button>` with `aria-pressed`. The record is focusable with an `aria-label`, Left/Right arrows nudge it, and Space toggles the motor. Decorative SVG parts are `aria-hidden`.
- Works on a 375px-wide phone, with the turntable scaling down.
- Isolate the physics (angle, velocity, friction, motor torque) in small pure functions so they're easy to read and tweak.

## Project content (source of truth)

These facts come from my resume and past work. **Use only these numbers and claims. Never invent metrics, users, ratings or features.** If you want a fact that isn't here, leave a `<!-- TODO(Holden): ... -->` comment instead of guessing.

### 1. Lovely, "Lovely: Relationship Growth" (iOS)
- **Role:** Co-Founder & Founding Engineer, Lovely LLC, Nov 2025–present
- **Proof:** App Store: https://apps.apple.com/us/app/lovely-relationship-growth/id6758863491 (the codebase is private, so there's no repo link)
- **Stack:** FastAPI, React Native (Expo, New Architecture), Firebase/Firestore, RevenueCat, EAS Build
- **What I built:**
  - A provider-agnostic AI gateway in FastAPI that routes across GPT-4o-mini and Claude 3 Sonnet, with prompt orchestration and cross-session memory injection, so the app isn't locked into one LLM provider.
  - Four layers of security on a multi-tenant user dataset: Fernet field-level encryption with per-user key derivation, Firestore-backed sliding-window rate limiting, and HMAC-verified RevenueCat webhooks with replay protection.
  - A 305-line Firestore security ruleset with default-deny access, per-user isolation, append-only messages, and payload size caps, tested with 30+ pytest files.
  - Fixed cold-start crashes under React Native's New Architecture via lazy Firebase initialization and deferred notification handlers. This unblocked stable distribution to 40+ beta users and the production App Store release.
- **Hard part to emphasize:** keeping the app provider-agnostic, and handling users' private relationship data safely.

### 2. NFL Game Predictor
- **Proof:** https://github.com/HWalker13/NFL-GAME-PREDICTOR (verify the exact repo URL with me)
- **Stack:** Python, pandas, scikit-learn. Built as a spec-driven pipeline with Claude Code doing the implementation. Be honest about that in the copy; the judgment and the methodology are mine.
- **Results:**
  - 64.3% accuracy on 544 held-out games vs. a 54.4% home-team baseline, using 67 point-in-time features including custom Elo and EPA.
  - Season-based walk-forward cross-validation plus a 4-part automated leakage audit. A planted-leak negative control was caught by timestamp checks but **missed** by label shuffling, which proved that one test isn't enough.
  - Pre-registered the 2025 holdout with SHA-256-locked code: 61.6% vs. a 53.9% baseline.
  - **Rejected** a 65.3% gradient-boosting model because it missed the pre-set significance bar (McNemar p = 0.0525).
  - Benchmarked against Vegas (69.7%) and reported **no betting edge**.
  - The frozen model is running live through the 2026 season with write-once predictions, closing-line-value tracking and weekly graded scorecards.
- **Hard part to emphasize:** scientific honesty. I rejected a better-looking model, and I report that Vegas beats me. This is my best interview story, so make it the centerpiece of the page.

### 3. swapLLM + swaptrace (two PyPI packages, one story)
- **Proof:** https://pypi.org/project/swapllm · https://github.com/HWalker13/swapllm · https://pypi.org/project/swaptrace · https://github.com/HWalker13/swaptrace
- **Stack:** Python, Pydantic, pytest, dataclasses, JSONL, GitHub Actions
- **The story arc:** "I built a router, found a real gap in it, then reverse-engineered my own tool to fix it."
- **swapLLM:** unifies Groq, OpenAI and Anthropic behind one `Router.complete()` call, with automatic fallback on rate limits, timeouts and server errors. It has a typed exception hierarchy that separates retryable failures from fatal ones, and optional Pydantic response validation. There's an 89-test mocked pytest suite (zero live API calls), and I did a TestPyPI dry run before release.
- **swaptrace:** I found that swapLLM's fallback cascade threw away all per-attempt data when a call succeeded. So I reimplemented the retry loop with verified behavioral parity and full attempt-level tracing. Overhead is 7.75µs/call (under 0.01% of real LLM latency), measured with a GC-disabled methodology (5 trials × 1,000 iterations). It has 73 tests, zero runtime dependencies, and a CLI for comparing traces across providers.

### 4. Kache
- **Proof:** https://github.com/HWalker13/kache
- **Stack:** Python (standard library only), raw TCP sockets, Docker Compose, AWS EC2
- **What I built:** a Redis-like key-value cache from raw TCP sockets with zero dependencies. It has 6 protocol commands and a multi-threaded server, plus:
  - Dual-path TTL eviction: lazy expiration on read plus a background sweep thread.
  - AOF persistence with absolute-timestamp TTLs, so data recovers correctly after a crash.
  - Primary/replica replication with an in-memory write queue that buffers commands during a disconnect and replays them in order on reconnect (at-least-once delivery).
- **Results:** 17,000+ ops/sec at sub-2ms p50 latency with 20 concurrent clients. After a simulated network partition, full replica sync recovered in under 2 seconds with zero writes lost across 50 buffered commands.
- **Hard part to emphasize:** correctness under failure, meaning crash recovery and partitions.

### Links
- GitHub: https://github.com/HWalker13
- LinkedIn: https://www.linkedin.com/in/holden-anderson123
- Email: `<!-- TODO(Holden): email -->`
- Resume: `/resume.pdf`. I'll drop the file into `public/`.

## Writing voice

Write all copy in a plain, specific, first-person voice: short sentences, concrete nouns, every number next to its context. Write like an engineer explaining their work to another engineer over coffee.

Banned words and phrases: "passionate," "leveraging," "cutting-edge," "seamless," "robust solution," "I'm excited to," "dive into," "journey."

Mark every paragraph you draft with `<!-- DRAFT: Holden to edit -->` so I can rewrite it in my own words before launch.

## How to work

1. **Plan first.** Before writing code, give me a short plan: file tree, content schema, and milestone order. Wait for my OK.
2. **Milestones, with a git commit after each:**
   1. Scaffold Astro + TS, design tokens, fonts, base layout
   2. **Turntable component, alone on the page.** Stop and let me play with it (`npm run dev`) before moving on.
   3. Home page: hero, tracklist, about, footer
   4. Content collection + project pages for all 4 projects
   5. Polish: dark mode, mobile pass, reduced motion, meta tags/OG image, favicon (a tiny record)
3. After each milestone, run `npm run build` and fix any errors or warnings.
4. Before calling it done, give me a checklist covering every external link (for me to click and verify), every `TODO(Holden)` and `DRAFT` marker, and a Lighthouse run (target 95+ on Performance and Accessibility).
5. Explain any non-obvious decision in a sentence or two, because I'll need to defend this site in interviews.
