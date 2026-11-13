/*
  Named NFL figures for project content. Markdown and frontmatter write `{{nfl.heldOut.model.pct}}`
  instead of "64.3%"; `fillTokens` swaps in the value at render time. An unknown name throws, so a
  typo fails the build instead of shipping "{{nfl.…}}".

  Tokens are resolved when the page renders, not when the content collection loads, so a re-synced
  data file can never be hidden behind Astro's content cache.

  src/content/projects.test.ts fails if NFL content contains a metric-looking number that isn't a token.
*/
import type { SiteData } from './schema';
import { fixed, pct, pValue, score3, signed } from './format';
import {
  assertBeatsHomeEverywhere,
  assertNegativeControlCaught,
  assertNoEdgeVerdict,
  assertSabotageContrastClaim,
  mcnemarP,
  minMcnemarP,
  modelRange,
  ncCondition,
  ncSabotages,
} from './derive';

export const NFL_REPO = 'https://github.com/HWalker13/NFL-GAME-PREDICTOR';

export function buildTokens(d: SiteData): Record<string, string> {
  // Claims the copy makes in words. Each throws if the data no longer supports it, which fails
  // the build (src/data/nfl/index.ts builds the tokens at import) instead of shipping a false line.
  assertBeatsHomeEverywhere(d);
  assertNoEdgeVerdict(d);
  assertNegativeControlCaught(d);
  assertSabotageContrastClaim(d);

  const H = d.held_out_2023_24;
  const Y = d.prereg_2025;
  const L = d.live_2026;
  const q = L.prediction_quality;
  const [lo, hi] = modelRange(H);
  const verdict = L.clv_verdict.verdict;

  return {
    // Held-out 2023–24 (walk-forward)
    'heldOut.n': String(H.n),
    'heldOut.model.pct': pct(H.models['LR-tuned'].accuracy),
    'heldOut.home.pct': pct(H.home_baseline.accuracy),
    'heldOut.vegas.pct': pct(H.vegas_favorite.accuracy),
    'heldOut.models.range': `${fixed(100 * lo, 1)}–${pct(hi)}`,
    'heldOut.mcnemar.minP': pValue(minMcnemarP(H)),
    'heldOut.model.logLoss': score3(H.models['LR-tuned'].log_loss),
    'heldOut.market.logLoss': score3(H.vegas_implied.log_loss),
    'heldOut.bets.n': String(H.retroactive_bets.bets),
    'heldOut.bets.units': signed(H.retroactive_bets.units, 2),
    /** Cents lost per dollar bet: ROI −0.1436 → "14.4". Only meaningful while ROI is negative. */
    'heldOut.bets.lossCents': fixed(Math.abs(100 * H.retroactive_bets.roi), 1),

    // Held-out 2025 season
    'y2025.n': String(Y.n),
    'y2025.model.pct': pct(Y.models['LR-tuned'].accuracy),
    'y2025.home.pct': pct(Y.home_baseline.accuracy),
    'y2025.vegas.pct': pct(Y.vegas_favorite.accuracy),
    'y2025.hgb.pct': pct(Y.models['HGB-tuned'].accuracy),
    'y2025.hgb.p': pValue(mcnemarP(Y, 'LR-tuned', 'HGB-tuned')),
    'y2025.hgb.logLoss': score3(Y.models['HGB-tuned'].log_loss),
    'y2025.model.logLoss': score3(Y.models['LR-tuned'].log_loss),

    // Live 2026
    'live.n': String(q.champion.accuracy.n),
    'live.model.pct': pct(q.champion.accuracy),
    'live.home.pct': pct(q.home_baseline.accuracy),
    'live.vegas.pct': pct(q.vegas_favorite.accuracy),
    'live.model.logLoss': score3(q.champion.log_loss.mean),
    'live.market.logLoss': score3(q.vegas_implied.log_loss.mean),
    'live.bets.n': String(L.official_bets.bets),
    'live.clv.verdictLower': verdict.charAt(0).toLowerCase() + verdict.slice(1),
    'live.clv.when': L.clv_verdict.final ? 'for the full season' : 'so far',

    // Leakage negative control (schema 1.1.0). "The argument" is the Phase 2 reconstruction:
    // closed='left' removed from every roll_left call. Every figure uses the CURRENT feature set
    // (check2.current_67), so the paragraph never switches feature sets.
    'nc.nFeatures': String(ncCondition(d, 'clean').check2.current_67.n_features),
    'nc.argument.columns': String(ncCondition(d, 'phase2_roll_left').n_columns_changed),
    'nc.argument.shuffled': pct(ncCondition(d, 'phase2_roll_left').check2.current_67.shuffled_mean),
    'nc.clean.shuffled': pct(ncCondition(d, 'clean').check2.current_67.shuffled_mean),
    'nc.evalSeason': String(d.negative_control.seasons.check2_eval),
    'nc.ewm.columns': String(ncCondition(d, 'ewm_only').n_columns_changed),
    'nc.sabotages': String(ncSabotages(d).length),
    // Asserted above: every sabotage > 70% and clean below, on the current 67-feature set.
    'nc.contrast.minSabotage': pct(Math.min(...ncSabotages(d).map((c) => c.check2.current_67.contrast_accuracy))),
    'nc.contrast.clean': pct(ncCondition(d, 'clean').check2.current_67.contrast_accuracy),
    // Links point at the commit the export was generated from (source_commit.hash), where the
    // JSON is the post-fix run; source_git_head is only shown as "control ran on commit X".
    'nc.controlCommit': d.negative_control.source_git_head.slice(0, 7),
    'nc.scriptUrl': `${NFL_REPO}/blob/${d.source_commit.hash}/audit/scripts/negative_control.py`,
    'nc.resultsUrl': `${NFL_REPO}/blob/${d.source_commit.hash}/${d.negative_control.source}`,
    'nc.amendmentUrl': `${NFL_REPO}/blob/${d.source_commit.hash}/docs/PHASE10_PREREG.md`,

    // Asserted above: model accuracy > always-pick-home accuracy in all three tests.
    'claim.beatsHomeAllTests': 'beating always picking the home team in all three',
  };
}

export const TOKEN = /\{\{nfl\.([\w.]+)\}\}/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
  Replace every {{nfl.name}}. Pass `html: true` when filling rendered HTML (values are escaped);
  leave it off for strings Astro will escape itself, such as frontmatter shown as {text}.
*/
export function fillTokens(text: string, tokens: Record<string, string>, { html = false } = {}): string {
  return text.replace(TOKEN, (_, name: string) => {
    const v = tokens[name];
    if (v === undefined) throw new Error(`Unknown NFL token {{nfl.${name}}}. Known: ${Object.keys(tokens).join(', ')}`);
    return html ? escapeHtml(v) : v;
  });
}
