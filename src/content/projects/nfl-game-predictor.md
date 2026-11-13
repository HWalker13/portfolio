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
# Numbers are {{nfl.*}} tokens, filled from src/data/nfl/site_data.json (see src/data/nfl/tokens.ts).
headlineStats:
  - value: '{{nfl.heldOut.model.pct}}'
    context: 'on held-out 2023–24 games, {{nfl.y2025.model.pct}} on 2025, {{nfl.live.model.pct}} live in 2026, {{nfl.claim.beatsHomeAllTests}}.'
  - lead: 'Replayed on 2023–24 at the real odds, my betting rule loses'
    value: '{{nfl.heldOut.bets.lossCents}} cents'
    context: 'per dollar bet. The live 2026 test that counts, closing-line value, shows {{nfl.live.clv.verdictLower}} {{nfl.live.clv.when}}. I claim none.'
results: /projects/nfl-game-predictor/results/
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
<title id="d-nfl-title">Pipeline: 67 point-in-time features, then season-based walk-forward validation with a 4-part leakage audit, then model selection where a challenger must be significantly better, then the held-out 2025 season scored once with SHA-256-locked code, then the frozen model running live through 2026.</title>
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
<text class="d-s" x="170" y="190" text-anchor="middle">a challenger must be significantly better</text>
<path class="d-line" d="M170 202 L170 220" marker-end="url(#d-nfl-arrow)"/>
<rect class="d-box" x="20" y="222" width="300" height="52" rx="10"/>
<text class="d-t" x="170" y="244" text-anchor="middle">Held-out 2025 season</text>
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
- **A held-out 2025 season**, scored once, with the code locked by a SHA-256 hash before scoring.
- **A live run through the 2026 season**: write-once predictions, closing-line-value tracking and weekly graded scorecards.

## The hard part

<div class="hard-part">

<!-- DRAFT: Holden to edit -->
**I kept the model with the worse number.** On the held-out 2025 season, a gradient-boosting model picked {{nfl.y2025.hgb.pct}} of games right; mine picked {{nfl.y2025.model.pct}}. The test's rule said a challenger replaces the current model only if it's significantly better, on accuracy or on log loss. On accuracy, the gap missed the bar (McNemar p = {{nfl.y2025.hgb.p}}). On log loss, its probabilities were slightly worse ({{nfl.y2025.hgb.logLoss}} vs. {{nfl.y2025.model.logLoss}}). Swapping anyway would have meant moving the goalposts after seeing the result. That habit produces models that fall apart on new data.

<!-- DRAFT: Holden to edit -->
**One leakage test isn't enough, and I proved it.** As a negative control, I broke one argument on purpose: the `closed='left'` in my rolling-window function, which keeps a game's own result out of its own features. That one argument feeds {{nfl.nc.argument.columns}} model columns. The timestamp check caught the leak. Label shuffling didn't: with the leak in, it scored {{nfl.nc.argument.shuffled}} on shuffled labels, about the same as the clean pipeline's {{nfl.nc.clean.shuffled}}, and passed (all figures here are for the current {{nfl.nc.nFeatures}}-column model, scored on {{nfl.nc.evalSeason}} games). That's by design, not a flaw in the test. Shuffling the labels breaks the link between features and outcomes that a leak depends on, so the leak has nothing to show. Label shuffling guards against a different bug: a pipeline that still scores well when there's nothing real to learn, which means the evaluation itself is leaking the answers. That's why the audit has four parts and not one.

<!-- DRAFT: Holden to edit -->
**Rebuilding that experiment found a gap in my own check.** When I re-ran it on the current pipeline, a leak in the {{nfl.nc.ewm.columns}} recency-weighted (EWM) columns I'd added later got past the timestamp check, because the check had no independent oracle for them. I added one and recorded the change as an <a href="{{nfl.nc.amendmentUrl}}">amendment to the live test's rules</a>. The experiment now asserts that the timestamp check catches all {{nfl.nc.sabotages}} sabotages. Every sabotaged pipeline also scored at least {{nfl.nc.contrast.minSabotage}} on the real labels, against {{nfl.nc.contrast.clean}} for the clean one: the kind of suspiciously high accuracy my spec tells me to stop and investigate. <a href="{{nfl.nc.scriptUrl}}">The script</a> and <a href="{{nfl.nc.resultsUrl}}">its results</a> are in the repo; the control ran on commit <code>{{nfl.nc.controlCommit}}</code>.

<!-- DRAFT: Holden to edit -->
**I report that Vegas beats me.** On the held-out 2023–24 games, the Vegas favorite won {{nfl.heldOut.vegas.pct}} to my {{nfl.heldOut.model.pct}}, and the market's probabilities scored better too (log loss {{nfl.heldOut.market.logLoss}} vs. {{nfl.heldOut.model.logLoss}}). How often the favorite wins isn't a test of betting edge, though; the price is. So I replayed my betting rule on those seasons at the real odds: it lost {{nfl.heldOut.bets.units}} units over {{nfl.heldOut.bets.n}} bets. The live 2026 test counts only closing-line value as evidence, and it shows {{nfl.live.clv.verdictLower}} {{nfl.live.clv.when}}. No edge, and the project says so.

</div>

## Results

<!-- DRAFT: Holden to edit -->
| Test | My model | Always pick home | Vegas favorite |
| --- | --- | --- | --- |
| Held-out 2023–24 ({{nfl.heldOut.n}} games) | {{nfl.heldOut.model.pct}} | {{nfl.heldOut.home.pct}} | {{nfl.heldOut.vegas.pct}} |
| Held-out 2025 season ({{nfl.y2025.n}} games) | {{nfl.y2025.model.pct}} | {{nfl.y2025.home.pct}} | {{nfl.y2025.vegas.pct}} |
| Live 2026 so far ({{nfl.live.n}} games) | {{nfl.live.model.pct}} | {{nfl.live.home.pct}} | {{nfl.live.vegas.pct}} |

<!-- DRAFT: Holden to edit -->
Each later test scored lower than 2023–24, which is what an honest out-of-sample test usually looks like. The frozen model is making write-once predictions through the 2026 season, graded weekly.

[The full record: confidence intervals, every live week (missed ones included), the paper bets and every live pick.](/projects/nfl-game-predictor/results/)

<!--
TODO(Holden): HIDDEN until you write your own lessons. This whole section is one HTML comment, and
comments are stripped from the build, so none of it ships. To publish: delete this comment's first
four lines and its closing line, then replace the placeholder below with your own words.

## What I'd do differently

DRAFT: Holden to edit
I'd report a confidence interval next to every accuracy number, not only a significance test on the final comparison. A few hundred games is a small sample, and an interval makes that obvious at a glance.
-->
