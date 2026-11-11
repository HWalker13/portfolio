---
title: NFL Game Predictor
track: 2
side: A
# DRAFT: Holden to edit
tagline: 'Predicts NFL winners. It beats the home-team baseline, loses to Vegas, and the write-up says so.'
date: '2026'
stack:
  - Python
  - pandas
  - scikit-learn
  - Claude Code (implementation)
headlineStats:
  - value: '64.3%'
    context: 'accuracy on 544 held-out games, vs. a 54.4% home-team baseline'
  - lead: 'Vegas hits'
    value: '69.7%'
    context: ', so I report no betting edge.'
proof:
  - kind: github
    label: GitHub
    url: https://github.com/HWalker13/NFL-GAME-PREDICTOR
video:
  webm: /videos/nfl.webm
  mp4: /videos/nfl.mp4
  poster: /videos/nfl-poster.webp
---

## The problem

<!-- DRAFT: Holden to edit -->
Sports-prediction models often look great because they quietly use information from the future. I wanted to know what an honest model can actually do: no leakage, a bar for success set before seeing results, and a fair comparison with the betting market.

<!-- DRAFT: Holden to edit -->
I built it as a spec-driven pipeline. I wrote the specs and made the methodology calls; Claude Code wrote the implementation.

## What I built

<figure class="diagram">
<svg role="img" aria-labelledby="d-nfl-title" viewBox="0 0 340 352" xmlns="http://www.w3.org/2000/svg">
<title id="d-nfl-title">Pipeline: 67 point-in-time features, then season-based walk-forward validation with a 4-part leakage audit, then model selection against a pre-set significance bar, then a pre-registered 2025 holdout with SHA-256-locked code, then the frozen model running live through 2026.</title>
<defs><marker id="d-nfl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="d-arrow" d="M0 0 L10 5 L0 10 z"/></marker></defs>
<rect class="d-box" x="20" y="6" width="300" height="52" rx="10"/>
<text class="d-t" x="170" y="28" text-anchor="middle">67 point-in-time features</text>
<text class="d-s" x="170" y="46" text-anchor="middle">custom Elo and EPA, known before kickoff</text>
<path class="d-line" d="M170 58 L170 76" marker-end="url(#d-nfl-arrow)"/>
<rect class="d-box" x="20" y="78" width="300" height="52" rx="10"/>
<text class="d-t" x="170" y="100" text-anchor="middle">Walk-forward CV, by season</text>
<text class="d-s" x="170" y="118" text-anchor="middle">plus a 4-part automated leakage audit</text>
<path class="d-line" d="M170 130 L170 148" marker-end="url(#d-nfl-arrow)"/>
<rect class="d-hi" x="20" y="150" width="300" height="52" rx="10"/>
<text class="d-t" x="170" y="172" text-anchor="middle">Model selection</text>
<text class="d-s" x="170" y="190" text-anchor="middle">must clear a significance bar set in advance</text>
<path class="d-line" d="M170 202 L170 220" marker-end="url(#d-nfl-arrow)"/>
<rect class="d-box" x="20" y="222" width="300" height="52" rx="10"/>
<text class="d-t" x="170" y="244" text-anchor="middle">2025 holdout, pre-registered</text>
<text class="d-s" x="170" y="262" text-anchor="middle">code locked with a SHA-256 hash</text>
<path class="d-line" d="M170 274 L170 292" marker-end="url(#d-nfl-arrow)"/>
<rect class="d-box" x="20" y="294" width="300" height="52" rx="10"/>
<text class="d-t" x="170" y="316" text-anchor="middle">Frozen model, live through 2026</text>
<text class="d-s" x="170" y="334" text-anchor="middle">write-once picks · CLV · weekly scorecards</text>
</svg>
<figcaption>Each stage exists to stop me from fooling myself.</figcaption>
</figure>

<!-- DRAFT: Holden to edit -->
- **67 point-in-time features**, including a custom Elo rating and EPA. Every feature uses only what was known before kickoff.
- **Season-based walk-forward cross-validation**: train on past seasons, test on the next one, never the other way around.
- **A 4-part automated leakage audit** that runs on the pipeline.
- **A pre-registered 2025 holdout**, with the code locked by a SHA-256 hash before scoring.
- **A live run through the 2026 season**: write-once predictions, closing-line-value tracking and weekly graded scorecards.

## The hard part

<div class="hard-part">

<!-- DRAFT: Holden to edit -->
**I rejected the model with the better number.** A gradient-boosting model scored 65.3%, a point above the 64.3% model I kept. Before comparing them, I'd set a significance bar, and the gap didn't clear it: McNemar's test gave p = 0.0525. Taking it anyway would have meant moving the goalposts after seeing the result. That habit produces models that fall apart on new data.

<!-- DRAFT: Holden to edit -->
**One leakage test isn't enough, and I proved it.** I planted a deliberate leak as a negative control. The timestamp checks caught it. Label shuffling, a common leakage test, missed it. That's why the audit has four parts and not one.

<!-- DRAFT: Holden to edit -->
**I report that Vegas beats me.** The market hits 69.7%. My model hits 64.3%. There's no betting edge here, and the project says so rather than burying it. The goal was to measure honestly, and that includes measuring against the hardest benchmark available.

</div>

## Results

<!-- DRAFT: Holden to edit -->
| Test | Model | Comparison |
| --- | --- | --- |
| 544 held-out games | 64.3% | 54.4% home-team baseline |
| 2025 holdout, pre-registered | 61.6% | 53.9% baseline |
| Vegas benchmark | no edge | 69.7% Vegas |
| Rejected gradient boosting | 65.3% | p = 0.0525, missed the pre-set bar |

<!-- DRAFT: Holden to edit -->
The 2025 number is lower than the 64.3% from validation, which is what an honest out-of-sample test usually looks like. The frozen model is now making write-once predictions through the 2026 season, graded weekly.

<!--
TODO(Holden): HIDDEN until you write your own lessons. This whole section is one HTML comment, and
comments are stripped from the build, so none of it ships. To publish: delete this comment's first
four lines and its closing line, then replace the placeholder below with your own words.

## What I'd do differently

DRAFT: Holden to edit
I'd report a confidence interval next to every accuracy number, not only a significance test on the final comparison. A few hundred games is a small sample, and an interval makes that obvious at a glance.
-->
