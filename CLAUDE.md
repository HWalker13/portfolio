# Holden Anderson — Portfolio Site

This file is the spec for this repo. Read all of it before writing code, and re-read the relevant section before each milestone.

## Why this site exists

I'm Holden Anderson, a CS student at CSU San Bernardino, graduating May 2027. I'm looking for new-grad backend, infrastructure or AI engineering roles starting June 2027.

Every claim on my resume is self-reported, and recruiters have no way to check it in 8 seconds. **This site's job is to turn those claims into evidence a stranger can check in under a minute**: live App Store link, PyPI packages, public repos, real numbers with context.

Three audiences, in priority order:
1. **Recruiters** skimming for 30 seconds. They must see who I am, what I build, and links to proof without scrolling far.
2. **Engineers/hiring managers** who click into a project. They want the hard problem, the decision I made, and the trade-off.
3. **Founders** I cold-message. They want to see that I ship.

Personality is the differentiator, but never at the cost of audience #1. If an effect slows down skimming, cut it.

## Stack (and why)

- **Astro + TypeScript.** The site is almost entirely static content, and Astro ships zero JS by default. The interactive pieces (the turntable, the eyes band, the project reel) are small vanilla-TS scripts; everything else is static HTML. I need to be able to explain this choice in an interview.
- **Plain CSS with custom properties** (no Tailwind). The design is very custom, so utility classes wouldn't save much, and tokens on `:root` make theming easy.
- **The turntable is vanilla TypeScript + SVG** inside an Astro component, loaded with `client:visible`. No React or animation libraries. It doesn't need them. The same goes for the eyes and the reel: their pure parts are split out and unit-tested (`src/scripts/eye-art.ts` holds the eye designs and collage layout as plain data, `eyes.ts` the pupil tracking, `reel.ts` the wheel geometry).
- **Generated art is checked in, with its generator.** `npm run textures` (grain, cork, flower wallpaper), `npm run poster-art` (the gig poster), `npm run icons` and `npm run og` each write static files to `public/`. Nothing is generated at build time.
- **Demo videos** (`npm run demos`, `scripts/make-demos.mjs`): VHS tapes in `scripts/demos/<name>/` record real commands against fresh clones of the project repos (never the repos themselves), then ffmpeg adds a title card, caption strips timed from the recording itself, and a highlight box on the payoff. Output: `public/videos/<name>.{webm,mp4}` plus a 960px WebP poster, each under 2 MB, wired in through the project's `video` frontmatter. Rules: real commands and real output only; captions restate what's on screen; mocked HTTP for LLM providers (never real keys); the NFL demo only replays the official record in scratch mode (never `--live`, never a data pull).
- **Keep the tree clean.** When a feature or asset is replaced, delete the old one, its generator, its npm script, its tokens, its contrast checks and its CLAUDE.md text in the same change. No "old", "v1", "backup" or commented-out copies; git history is the backup.
- **NFL results data** (`npm run sync:nfl`, `scripts/sync-nfl-data.ts` + `src/data/nfl/sync.ts`): copies `exports/site_data.json` from the NFL repo (path: `$NFL_SITE_DATA`, default `/Users/holdenanderson/Personal Projects/NFL-GAME-PREDICTOR/exports/site_data.json`) to `src/data/nfl/site_data.json`, which is checked in because Vercel can't see the other repo. It fails if the file is missing, isn't schema 1.x, fails the zod schema (`src/data/nfl/schema.ts`) or was exported from uncommitted code (`--allow-dirty` overrides). The build parses it again, so a mismatch fails the build. It's imported only at build time; no client script may import it.
  - TODO(Holden): the NFL demo video (`scripts/make-demos.mjs`, `scripts/demos/nfl/`) still has the problems AUDIT.md item 4 lists: the caption says "as logged before kickoff", which is server-corroborated for only 13 of the 14 week 7 games, and the clip has no header row, so "No" in the last column reads as "no bet" when it means "pick wrong". Re-record with the header row and the bet columns, and a caption that claims only what's proven.
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
- `--walnut` #6E4527 (wood tones, turntable plinth, corkboard frame)
- `--slate` #4F7A93 (muted denim blue: wallpaper, polaroid, eyeliner). Decorative only: it fails as text on cream (3.75:1) and chocolate (3.16:1). Text in this hue uses `--slate-ink` #3E6178 (the LinkedIn mark; 6.01:1 on paper).
- `--powder` #A9C4CC (pale powder blue surface; chocolate text on it is 7.97:1)

**Poster inks (the gig poster's art only, never site colors, never text):** a deep muted green sky (#2F4A36), greens for the hills (#3F6638, #5C8A3C, acid green #8CBF3F, olive), poster orange #E0702A and a darker orange, mustard, cream and chocolate, with hot pink #E8508A as a small accent (one planet, one flower). They live in `scripts/make-poster-art.mjs`; tokens.css only defines `--poster-orange`, the off-register print plate behind the poster's name and tag.

**Eyes band inks (the eyes only, decorative):** black ink #16110D, white #FFFDF6, cobalt #1F4FA8, sage #9DB48A, yellow #F2C230, blue and brown irises, on the red-orange band. They live in `src/scripts/eye-art.ts`.

**Screen-print rule:** each section uses 2–3 inks, like a screen-printed poster (hero and eyes band: red-orange with black ink, cobalt, sage and yellow; reel: chocolate, cream, orange/mustard/brown wave; Let's talk: the reel's chocolate with a muted orange/slate/cream wallpaper and cream type, plus dark cork and walnut; the poster has its own inks, above). Burnt orange is the anchor. New colors go through `npm run contrast` and are used as text only where they pass.

Add a dark theme under `@media (prefers-color-scheme: dark)` using deep brown (#1E140D) as the background and cream text, with the same accents. Every text/background pair must meet WCAG AA contrast. Check orange-on-cream in particular, and darken the orange for body-size link text if needed.

**Type:**
- Display/headings: **Fraunces** from Google Fonts, using the soft, heavy variable axes for a Cooper-Black-ish 70s feel.
- Body: a clean, highly readable sans (**DM Sans** or similar).
- Monospace for numbers/code: **JetBrains Mono** or similar.

- Wavy, melting 70s display lettering (`WavyTitle.astro`) is only for big moments: "Let's talk" and the poster title. Body copy and project titles stay in plain Fraunces.

**Motifs, used with restraint:** rounded corners, print grain, record-sleeve framing on the tracklist.

**Print grain rule:** a subtle risograph-style grain (one static, pre-rendered ~9 KB tile, `public/textures/grain.png`, made by `npm run textures`) goes on background color fields, stripes, the eyes band, the wallpaper and the cork. Never behind body text, stats, links or buttons: those sit on clean color so they stay crisp. Its opacity is the single token `--grain` (0 removes it everywhere).

**Original art only:** every illustration, pattern, texture and mark on the site is drawn for it (SVG/CSS or generated by a script in `scripts/`). No copied images, no likenesses of real people (including me), no real artists, logos or existing characters. Structure can be inspired by portfolios and 1970s posters; the art can't be copied from them.

**Setting: a 70s screen-printed poster you can scroll.**
- **Pause motion:** one small, quiet toggle in the hero's bottom corner (a real `<button>` with `aria-pressed`) stops the marquee and the eyes. Stored on `<html data-motion="paused">`, remembered in localStorage (wrapped in try/catch) and read before first paint. Hidden under `prefers-reduced-motion`, where nothing moves anyway. The turntable keeps its own Start/Stop.
- The hero is flat burnt orange (deep-brown text, 4.94:1; dark mode: rust #8F3A16 with cream text). A giant "HOLDEN ANDERSON" in heavy Fraunces scrolls slowly sideways behind the turntable as an aria-hidden marquee, in a lighter orange so text contrast only goes up where they overlap. Transform-only CSS animation, paused offscreen, off under `prefers-reduced-motion`. Grain only in the empty area around the turntable.
- Below the hero, a cream paper sleeve (the quick tracklist) lies across the stage's bottom edge.
- Supergraphic stripes: thick, curved bands in orange, mustard, chocolate and olive that bend around section corners (the tracklist ribbon), plus the thick orange/mustard/brown wave behind the project reel. Original CSS/SVG.
- The name in the hero uses stacked multicolor offset lettering like 70s album type, with a thin deep-brown keyline so the letter edges keep their contrast.
- On hover/focus, a small record slides partway out of a track's sleeve (just appears under `prefers-reduced-motion`).
- Light mode is the hero version and should feel as bold as 70s supergraphics. Dark mode is the late-night version of the same room: rust instead of orange, deep brown fields, dimmer wallpaper, and a warm low light on the corkboard.
- All hero text and links must pass `npm run contrast` (4.5:1).

**Music references:** the only music references on the site are the turntable's record labels and its Now Playing caption. Album titles, artist names and years as text are fine. No album artwork or imitations of covers, no likenesses or photos of musicians, no lyrics, and no real record-company labels, names or logos (no Apple Records apple, Motown/Tamla, Harvest, Capitol, Columbia, Jive, etc.).

**Do NOT do these** (they make the site look AI-generated or templated):
- A gradient blob hero, "Hi, I'm Holden 👋", or emoji anywhere
- Typing-effect headlines or "I'm a passionate developer who…" copy
- A grid of identical cards each with a row of 8 tech pills
- Parallax, scroll-jacking, or a custom cursor (the reel's wheel reads the scroll position; it never scrolls, snaps or slows the page)
- Stock icons for every skill

## Site structure

### Home (`/`), a single page

0. **Top nav** (on the orange hero, not sticky): name with a tiny-record monogram on the left; "Projects" and a "Let's talk" pill on the right.
1. **Hero:** name, a one-line description ("Backend & AI engineer. I like figuring out how things work, then shipping something people use."), the "Looking for…" line, and the **turntable** as the visual centerpiece. Primary links are always visible as pills: GitHub, LinkedIn, Resume (PDF), Email.
2. **Quick tracklist:** right after the hero, on the album sleeve. A compact numbered list of all four projects, split into **Side A** and **Side B** (number, name, one line, proof links), so a recruiter sees everything in 5 seconds. Each name jumps to that project's section in the reel. It must scan like a list, not a puzzle.
   - Side A: 1. Lovely, 2. NFL Game Predictor
   - Side B: 3. swapLLM + swaptrace, 4. Kache
3. **Eyes band:** a half-drop repeat of hand-inked 1960s pop-art eyes on a red-orange strip, like a printed textile (about 135–235px tall, by breakpoint). Built at build time by `grid()` in `src/scripts/eye-art.ts`.
   - **Pattern:** an even grid with uniform spacing; every other column dropped by half a cell. All eyes about the same size (±10%), each tilted within ±12° (fixed seed). Designs cycle in a fixed order, `(2·column + row) mod 5`, so no two identical designs touch sideways, up/down or diagonally. The pattern bleeds off all four edges (clipped by the band), with the same density at every width: about 2 rows on phones, 2.5 mid, 3 on desktop. The desktop grid is generated 1.4× wider than it shows and centered, so screens up to about 2,000px get more pattern, not bigger eyes. Whites never overlap; makeup may nearly touch.
   - **Style:** original drawings in the manner of 1960s pop-art textile prints. Line-weight hierarchy: the upper liner band is the heaviest line (thin at the inner corner, thick toward the outer, ending in a sharp tapered flick); then lashes and wedge spikes; then the lower lid and the crease; then hatching. Upper lashes (designs a–d) are tapered pen strokes growing from the liner, curving out and up, short at the inner corner and longer toward the outer, in close clumps like mascara. The lower lid is a thin line with an inner rim and a few sparse ticks near the outer corner. One thin crease line above the lid with fine hatching under the eyeshadow's edge. Grey hatching in the corners of the white.
   - **Iris:** about half the opening's width; its top hidden under the upper lid, its bottom meeting the lower lid. Radial pen hatching, dark limbal ring, pupil and catchlight.
   - **Five designs:** (a) cobalt lid, liner flick extended into a wing; (b) sage lid; (c) yellow lid swept toward the brow; (d) a yellow flower-shaped petal frame; (e) 1960s painted-on lashes: 7 filled black wedge spikes above and 6 below in a starburst, with a heavy liner around the whole eye. Palette: red-orange background, cobalt, sage, yellow, black ink, white; irises blue or brown.
   - **Tests** (`eyes.test.ts`): uniform grid spacing, exact half-drop offset, size and tilt limits, no identical neighbors, all five designs present, no empty rows or columns and bleed on every edge, no white overlap, iris size and placement, and the iris staying inside the opening at full travel.
   - **Motion:** each iris is its own layer clipped to the eye opening, so it slides under the lids as it follows the cursor (adjusted for the eye's tilt; small travel, so the big iris never leaves the opening). Eyes cropped off the band's sides are skipped. Touch devices: the eyes glance around on their own. Still under reduced motion and while motion is paused. Decorative (aria-hidden); one pointermove listener and one rAF loop for all irises, transform only. Each design is drawn once as SVG symbols and every eye is a few `<use>` references.
4. **Project reel:** one project per screen on chocolate, with the supergraphic wave behind. Left: giant name, one line, 2 stats with context, proof links, liner-notes link, and a "01 / 04" counter with real up/down buttons. Right (≥768px, motion OK): demo cards on a curved vertical wheel in a sticky column. The wheel follows normal page scroll and never takes over the scroll: the focused card is flat, sharp and playing; neighbors rotate away (rotateX with perspective), shrink, dim, blur, and get a faint chromatic-aberration edge; the focused card tilts slightly toward the pointer. Only the focused card plays. Under 768px or with reduced motion: no wheel; each section shows its own flat card (autoplaying muted while visible on phones; poster + Play button under reduced motion). Videos are muted, looped, playsinline, `preload="none"`, with a poster frame and a Play/Pause button; until a project has one (frontmatter `video`), its card is a finished static card: the name, where it's live ("Live on the App Store") and a button to that listing. No placeholder wording on the site.
5. **About:** one paragraph in my own words (the current one is 5 sentences; keep it short), plus the experience credits and the stack I actually use: Python, FastAPI, TypeScript, React Native (Expo), PostgreSQL, Redis, Docker, AWS (EC2/ECS), pytest.
6. **Let's talk:** the same lamp-lit room as the reel, not a new theme. Wallpaper: an original repeating 70s flower pattern in muted orange, dusty slate and dull cream on chocolate (deep brown in dark mode), low contrast, with grain. Big wavy "Let's talk" in cream with orange/mustard offsets sits straight on it, with "Open to new-grad roles starting June 2027." in cream below (cream passes 4.5:1 on every wallpaper ink; grain fades out behind the title band). Below: a dark, warm cork board in a dark walnut frame under a warm lamp glow, with at most 7 pinned items in muted pins, tape or a clothespin, each slightly rotated: the gig poster (below), the email note, the LinkedIn index card, the GitHub polaroid, the resume sheet, the "ADMIT ONE · Shoot Me a Message" ticket, and a small vinyl record showing the label of whatever is on the turntable (same `RecordLabels.astro` renderer; follows the turntable's `turntable:record` event). Every link item is a real `<a>` with an accessible name, visible focus, 44px+ target and passing contrast; on hover/focus it lifts and straightens while its pin stays put (no lift under reduced motion). Under 600px the board is a tidy 2-column grid with smaller rotations.
   - **The gig poster** (the board's centerpiece): an original 1970s-style illustrated space scene, inspired by the style of retro space/travel posters and copying none. A deep muted green sky with cream and mustard stars, soft sun-ray stripes and a few small orange planets; a large orange "brain planet" whose surface is stylized brain folds drawn like a gas giant's bands, with mustard and cream highlights; layered rolling clouds and hills in greens, cream and mustard with orange-and-cream flowers; a small cream-and-orange rocket launching out of the clouds toward the planet on a flame trail (brain = figuring things out, rocket = shipping); a thin ornate mustard border with decorative corners. Hot pink only as a small accent. Screen-print feel: grain and slight misregistration. The art is one static SVG (`public/textures/poster-space.svg`, from `npm run poster-art`); nothing live. Text is HTML on solid cream so every line passes contrast: a "NOW BOOKING" tag, "HOLDEN ANDERSON" in the wavy lettering on a curvy ribbon banner, and "STARTING JUNE 2027 · Backend · Infrastructure · AI engineering" on a cream band.
7. **Footer strip:** a small colophon: "© 2026 Holden Anderson. No cookies, no analytics." (no "built with" credit).

### NFL results (`/projects/nfl-game-predictor/results/`)

The full record behind the NFL liner notes, linked from the card ("Results", next to GitHub and Liner notes) and from the liner notes' Results section. Built entirely from `src/data/nfl/site_data.json`, with no client JS. Sections: the headline comparison (always pick home / my model / Vegas favorite with 95% CIs, for held-out 2023–24, the held-out 2025 season and live 2026, as inline SVG plus a hidden table), 2026 week by week (missed and partial weeks shown and labelled), paper betting (live official record next to the rule replayed on 2023–24 and 2025, and the CLV verdict), every live pick, definitions from the data, "Leakage checks, tested" (the negative control: one row per condition with columns affected, timestamp-check and label-shuffle verdicts, and real-label accuracy, all for the current 67-feature set), and provenance (export time, source commit, AUDIT.md at that commit).

### Project pages (`/projects/[slug]`), the "liner notes"

Use the same template for each project:
- Title, role/date, stack, and proof links at the top
- **The problem** (2–3 sentences)
- **What I built** (short; a simple diagram is welcome where it helps, as inline SVG)
- **The hard part / the decision**. This is the most important section.
- **Results** with numbers, always next to their baseline or context
- **What I'd do differently**. Stays hidden until I write it myself: each section is wrapped in one HTML comment in its `.md` file (comments are stripped from the build, so nothing ships). Publishing one means removing the wrapper and replacing the placeholder with my own words. Don't unhide or rewrite these for me.

Keep each page readable in about 2 minutes.

## The turntable (the personality feature)

This is the part that should feel like me. Build it as `src/components/Turntable.astro`, with its script in `src/scripts/turntable.ts`.

**Look:** a top-down or slight 3/4 view of a 70s turntable. Walnut wood-grain plinth, metal platter, black vinyl with visible grooves and a light sheen, a center label (see the queue below), a tonearm, and two small buttons under the plinth (Start/Stop and Switch record) with a "Now playing" caption beneath them. Build it in SVG, with CSS gradients for the sheen. No raster images are needed.

**The queue.** The turntable plays these records in order, looping. The page always starts on the first one.
1. Songs in the Key of Life, Stevie Wonder, 1976
2. The Dark Side of the Moon, Pink Floyd, 1973
3. The Low End Theory, A Tribe Called Quest, 1991
4. Midnight Marauders, A Tribe Called Quest, 1993
5. Mama's Gun, Erykah Badu, 2000
6. The Miseducation of Lauryn Hill, Lauryn Hill, 1998
7. Who Is Jill Scott?, Jill Scott, 2000 (full title: Who Is Jill Scott? Words and Sounds Vol. 1; the label uses the short form)
8. Abbey Road, The Beatles, 1969
9. Rubber Soul, The Beatles, 1965

**Labels.** No real album artwork anywhere. Each record gets an ORIGINAL 70s-style center label (color, simple shapes, type) printing the album title, the artist and "Side One", the way real vinyl labels do. Long titles may wrap to two lines; the text must stay legible when the record is stopped, and every label's ink/background pair must pass `npm run contrast`.
- Don't imitate any real cover or any real record-company label, name or logo.
- Avoid each cover's signature motif: no orange/brown concentric-circle disc for Songs in the Key of Life; no prism, beam or spectrum for The Dark Side of the Moon; no red/green/black figure for The Low End Theory; no face collage for Midnight Marauders; no faces or portraits for any album; no carved-desk look for Miseducation; no crosswalk for Abbey Road; no stretched or warped lettering for Rubber Soul.

**Behavior:**
- It **spins on its own** at 33⅓ RPM (one rotation every 1.8s) on load, with the tonearm resting on the record.
- **The visitor can grab the record and spin it** with mouse or touch, using Pointer Events. Track angular velocity from pointer movement around the center. On release, the record keeps that momentum and eases back toward 33⅓ RPM, as if the motor is pulling it back up to speed. Spinning backwards should work too, like a scratch.
- **Start/stop button:** stopping winds the platter down over about 1s and lifts the tonearm off the record. Starting does the reverse.
- **The needle plays the side.** The tonearm angle is driven by the record's accumulated rotation, not a timer. A side is about 30 rotations at 33⅓ RPM (~55s if left alone). Flicking forward advances the needle, scratching backwards moves it back out, and with the motor stopped the needle doesn't advance. These are pure, tested functions in `physics.ts`.
- **End of a side** (needle at the run-out groove): the motor winds down, the arm lifts and returns to rest, the record slides off, the next record slides on, the motor spins up, and the arm cues and lowers. About 3s total, transform-only animation.
- **Switch record button** next to Start/Stop, styled to match: runs the same swap to the next record. Presses during a swap are ignored. A real `<button>`, reached by keyboard right after Start/Stop.
- **Now playing caption** under the two buttons: "Now playing: [album] · [artist]", updated on each swap. It must pass the contrast check in both themes and fit at 320px.
- The sheen/highlight stays fixed while the grooves rotate, so the spin reads as real.
- **No audio.** Visual only.

**Engineering requirements:**
- Animate with `requestAnimationFrame`, and only change transforms (`rotate()` for the record and arm, `translateY()` for the record slide during a swap). No layout thrash.
- Pause the loop when the turntable is offscreen (IntersectionObserver) and when the tab is hidden (`visibilitychange`).
- `touch-action: none` only on the record itself, so page scrolling on mobile still works everywhere else.
- **`prefers-reduced-motion`:** no auto-spin, the record starts still, no auto-advance to the next record, and no slide animation: Switch record swaps instantly. Dragging still works.
- **Accessible:** Start/Stop is a real `<button>` with `aria-pressed`. The record is focusable with an `aria-label`, Left/Right arrows nudge it, and Space toggles the motor. Decorative SVG parts are `aria-hidden`. A visually hidden live region announces "Now playing: [album] by [artist]" only when the record changes, never during playback.
- Works on a 375px-wide phone, with the turntable scaling down.
- Isolate the physics (angle, velocity, friction, motor torque) in small pure functions so they're easy to read and tweak.

## Project content (source of truth)

These facts come from my resume and past work. **Use only these numbers and claims. Never invent metrics, users, ratings or features.** If you want a fact that isn't here, leave a `<!-- TODO(Holden): ... -->` comment instead of guessing.

### 1. Lovely, "Lovely: Relationship Growth" (iOS)
- **Role:** Co-Founder & Engineer, Lovely LLC, Nov 2025–present
- **Proof:** App Store: https://apps.apple.com/us/app/lovely-relationship-growth/id6758863491 (the codebase is private, so there's no repo link)
- **Stack:** FastAPI, React Native (Expo, New Architecture), Firebase/Firestore, RevenueCat, EAS Build
- **What I built:**
  - A provider-agnostic AI gateway in FastAPI that routes across GPT-4o-mini and Claude 3 Sonnet, with prompt orchestration and cross-session memory injection, so the app isn't locked into one LLM provider.
  - Protected user data with per-user encryption, rate limiting, and signed webhook verification (matches the resume; don't say "four layers"): Fernet field-level encryption with per-user key derivation, Firestore-backed sliding-window rate limiting, and HMAC-verified RevenueCat webhooks with replay protection.
  - A 305-line Firestore security ruleset with default-deny access, per-user isolation, append-only messages, and payload size caps, tested with 30+ pytest files.
  - Fixed cold-start crashes under React Native's New Architecture via lazy Firebase initialization and deferred notification handlers. This unblocked stable distribution to 40+ beta users and the production App Store release.
  - Built subscription billing and free trials with RevenueCat, gaining the app's first paying subscribers after launch.
- **Hard part to emphasize:** keeping the app provider-agnostic, and handling users' private relationship data safely.

### 2. NFL Game Predictor
- **Date:** 2026
- **Proof:** https://github.com/HWalker13/NFL-GAME-PREDICTOR
- **Stack:** Python, pandas, scikit-learn. Built as a spec-driven pipeline with Claude Code doing the implementation. Be honest about that in the copy; the judgment and the methodology are mine.
- **Numbers come from the data file, never from this spec.** Every NFL metric on the site is a `{{nfl.*}}` token (`src/data/nfl/tokens.ts`) or a template expression reading `src/data/nfl/site_data.json`; `src/content/projects.test.ts` fails on a hand-typed one. The only allowed literals are design facts with a cited source: 67 point-in-time features, the 4-part leakage audit, SHA-256-locked code, and the 95% CI level. Field docs: `exports/SCHEMA.md` in the NFL repo; framing corrections: `audit/AUDIT.md` there.
- **Results (what the numbers show):**
  - On held-out 2023–24 games, the model beats always picking home and trails the Vegas favorite. It was picked from four statistically tied models after those results were known, so its 2023–24 score is the optimistic end of a tie.
  - Season-based walk-forward cross-validation plus a 4-part automated leakage audit. **Negative control** (numbers from the export's `negative_control` block, `{{nfl.nc.*}}` tokens): removing one rolling *argument* (`closed='left'` on `roll_left`) leaked the current game into every model column built from it (count: `nc.argument.columns`); the timestamp check (Check 1) caught it, and label shuffling (Check 2) passed it, evaluated on 2022. Every figure in that paragraph uses the current 67-feature set (`check2.current_67`), never the Phase 2 42-feature set, and says so once. That is by design: shuffling breaks the feature-to-outcome link a leak depends on, so Check 2 guards against a different bug and can't detect feature leakage. Rebuilding the experiment found the later EWM features had no Check 1 oracle; Holden added one (NFL repo Amendment 5) and the experiment now asserts every sabotage is caught. Don't quote an old "~0.487" figure. Link the script and JSON at the export's `source_commit.hash`, never at `negative_control.source_git_head` (there the JSON is the pre-fix run); show `source_git_head` only as "control ran on commit X". The build fails if any sabotage passes Check 1, the clean pipeline fails it, or the "every sabotage above 70%, clean below" sentence stops being true.
  - The held-out 2025 season, scored once with SHA-256-locked code. Call it the "held-out 2025 season", not "pre-registered", until Holden confirms the wording (the run happened before his formal sign-off; the results page discloses that in one sentence). Don't say the replacement rule was written "before the run": git can't show it (the rule and the run landed in the same commit, `61d0c22`).
  - **Kept** LR-tuned over a gradient-boosting model that scored higher on 2025, because the replacement rule needs a significant win on accuracy (McNemar) or on log loss, and it had neither.
  - **No betting edge.** The evidence is the betting rule replayed on 2023–24 and 2025 at the real odds, plus the live 2026 closing-line-value (CLV) verdict, which is the only pre-registered test. Never cite the Vegas favorite's hit rate as the reason: how often the favorite wins isn't a test of edge.
  - The frozen model is running live through the 2026 season with write-once predictions, closing-line-value tracking and weekly graded scorecards. Never claim picks were logged "before kickoff" beyond what AUDIT.md §5 says is proven.
- **Hard part to emphasize:** scientific honesty. I rejected a better-looking model, and I report that Vegas beats me. This is my best interview story, so make it the centerpiece of the page.

### 3. swapLLM + swaptrace (two PyPI packages, one story)
- **Date:** 2026
- **Proof:** https://pypi.org/project/swapllm · https://github.com/HWalker13/swapllm · https://pypi.org/project/swaptrace · https://github.com/HWalker13/swaptrace
- **Stack:** Python, Pydantic, pytest, dataclasses, JSONL, GitHub Actions
- **The story arc:** "I built a router, found a real gap in it, then reverse-engineered my own tool to fix it."
- **swapLLM:** unifies Groq, OpenAI and Anthropic behind one `Router.complete()` call, with automatic fallback on rate limits, timeouts and server errors. It has a typed exception hierarchy that separates retryable failures from fatal ones, and optional Pydantic response validation. There's a 96-test mocked pytest suite (zero live API calls), and I did a TestPyPI dry run before release.
- **swaptrace:** I found that swapLLM's fallback cascade threw away all per-attempt data when a call succeeded. So I reimplemented the retry loop with verified behavioral parity and full attempt-level tracing. Overhead is 7.75µs/call (under 0.01% of real LLM latency), measured with a GC-disabled methodology (5 trials × 1,000 iterations). It has 73 tests, zero runtime dependencies, and a CLI for comparing traces across providers.
- **The bug swaptrace found (approved for the liner notes, Nov 2026):** swaptrace's attempt-level tracing revealed that swapLLM's SDK clients were silently retrying twice per provider (3 HTTP requests and 1.3 to 1.6 seconds before fallback), contradicting the README. Fixed in swapLLM 0.1.1 (`max_retries=0` on all three clients, plus tests that count HTTP requests).

### 4. Kache
- **Date:** 2026
- **Proof:** https://github.com/HWalker13/kache
- **Stack:** Python (standard library only), raw TCP sockets, Docker Compose, AWS EC2
- **What I built:** a Redis-like key-value cache from raw TCP sockets with zero dependencies. It has 6 protocol commands and a multi-threaded server, plus:
  - Dual-path TTL eviction: lazy expiration on read plus a background sweep thread.
  - AOF persistence with absolute-timestamp TTLs, so data recovers correctly after a crash.
  - Primary/replica replication with an in-memory write queue that buffers commands during a disconnect and replays them in order on reconnect (at-least-once delivery).
- **Results:** 17,000+ ops/sec at sub-2ms p50 latency with 20 concurrent clients. After a simulated network partition, full replica sync recovered in under 2 seconds with zero writes lost across 50 buffered commands.
- **Hard part to emphasize:** correctness under failure, meaning crash recovery and partitions.

### Experience (credits block only, no track or liner notes)
Listed exactly as on the resume, one line each:
- Co-Founder & Engineer, Lovely LLC, Nov 2025–Present
- Lead Engineer, Patch (P2P payments), Apr 2026–Sept 2026

### Links
- GitHub: https://github.com/HWalker13
- LinkedIn: https://www.linkedin.com/in/holden-anderson123
- Email: holdenwalkera@gmail.com
- Resume: `/Holden-Anderson-Resume.pdf` (in `public/`).

## Writing voice

Write all copy in a plain, specific, first-person voice: short sentences, concrete nouns, every number next to its context. Write like an engineer explaining their work to another engineer over coffee.

Banned words and phrases: "passionate," "leveraging," "cutting-edge," "seamless," "robust solution," "I'm excited to," "dive into," "journey."

Mark every paragraph you draft with `<!-- DRAFT: Holden to edit -->` so I can rewrite it in my own words before launch. HTML comments (DRAFT/TODO markers, hidden sections) are stripped from the build output by `integrations/strip-html-comments.mjs`, so they stay in the source but never ship.

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
