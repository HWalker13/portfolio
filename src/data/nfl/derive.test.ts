import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSiteData } from './schema';
import {
  NO_EDGE_VERDICT,
  assertBeatsHomeEverywhere,
  assertNoEdgeVerdict,
  betColumns,
  headlineGroups,
  liveGames,
  pickRow,
  testsNotBeatingHome,
  weekRows,
  weekStatus,
} from './derive';
import type { SiteData } from './schema';
import { buildTokens, fillTokens } from './tokens';
import { ciPct, fixed, odds, pct, pValue, seasons, signed } from './format';

const d = parseSiteData(JSON.parse(readFileSync(new URL('./site_data.json', import.meta.url), 'utf8')));

describe('format', () => {
  it('uses a real minus sign and en dashes', () => {
    expect(fixed(-54.1539, 2)).toBe('−54.15');
    expect(signed(10.984, 2)).toBe('+10.98');
    expect(fixed(-0.0001, 2)).toBe('0.00');
    expect(pct(0.6434)).toBe('64.3%');
    expect(ciPct([0.6023, 0.6825])).toBe('60.2–68.3%');
    expect(odds(-155)).toBe('−155');
    expect(odds(130)).toBe('+130');
    expect(pValue(0.0525)).toBe('0.0525');
    expect(seasons([2023, 2024])).toBe('2023–24');
  });
});

describe('headline groups', () => {
  it('shows three evaluations, each with home, model and Vegas, in that order', () => {
    const g = headlineGroups(d);
    expect(g.map((x) => x.id)).toEqual(['held-out-2023-24', 'held-out-2025', 'live-2026']);
    for (const x of g) expect(x.rows.map((r) => r.strategy)).toEqual(['home', 'model', 'vegas']);
    for (const x of g) for (const r of x.rows) expect(r.rate.n).toBe(x.n);
  });
  it('never uses the word pre-registered for 2025', () => {
    expect(headlineGroups(d)[1].label).not.toMatch(/regist/i);
  });
});

describe('live weeks', () => {
  const rows = weekRows(d);

  it('has one row per week from the first official week, missed weeks included', () => {
    const L = d.live_2026;
    expect(rows.map((r) => r.week.week)).toEqual(L.weeks.map((w) => w.week));
    expect(rows[0].week.week).toBe(L.first_official_week);
    expect(rows.some((r) => r.week.status === 'missed')).toBe(true);
  });

  it('labels missed and partial weeks in words', () => {
    for (const r of rows) {
      const s = weekStatus(r.week);
      if (r.week.status === 'missed') expect(s.detail).toMatch(/no picks logged/);
      if (r.week.status === 'partial') expect(s.detail).toMatch(new RegExp(`only ${r.week.predicted} of ${r.week.scheduled}`));
    }
  });

  it('per-week totals add up to the official record', () => {
    const B = d.live_2026.official_bets;
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
    expect(sum((r) => r.bets.wins)).toBe(B.wins);
    expect(sum((r) => r.bets.losses)).toBe(B.losses);
    expect(sum((r) => r.bets.voids)).toBe(B.voids);
    expect(sum((r) => r.bets.units)).toBeCloseTo(B.units, 2);
    expect(sum((r) => r.picksRight)).toBe(d.live_2026.prediction_quality.champion.accuracy.k);
    expect(sum((r) => r.games.length)).toBe(d.live_2026.games_logged);
  });
});

describe('pick rows', () => {
  const rows = liveGames(d).map(pickRow);

  it('gives both chances for the same (picked) team', () => {
    for (const r of rows) {
      expect(r.modelChance).toBeGreaterThanOrEqual(0.5);
      const g = r.game;
      expect(r.pickTeam).toBe(g.model_pick === 'home' ? g.home : g.away);
      if (g.vegas_implied_home_prob !== null) {
        const expected = g.model_pick === 'home' ? g.vegas_implied_home_prob : 1 - g.vegas_implied_home_prob;
        expect(r.marketChance).toBeCloseTo(expected, 6);
      }
    }
  });

  it('keeps "pick right" separate from the bet result', () => {
    const split = rows.find((r) => r.pickRight === 'yes' && r.betResult?.kind === 'lost');
    expect(split, 'expected at least one right pick with a losing bet').toBeDefined();
    expect(rows.some((r) => r.bet?.againstPick)).toBe(true);
  });

  it('shows pending games as pending, with no score', () => {
    const pending = rows.filter((r) => r.game.result === 'pending');
    expect(pending.length).toBe(d.live_2026.games_pending);
    for (const r of pending) {
      expect(r.pickRight).toBe('pending');
      expect(r.score).toBeNull();
    }
  });
});

describe('bet columns', () => {
  it('labels the historical columns as replayed (retroactive) and the live one as not', () => {
    expect(betColumns(d).map((c) => c.retroactive)).toEqual([true, true, false]);
  });
});

describe('tokens', () => {
  const t = buildTokens(d);
  it('formats the headline figures from the data', () => {
    expect(t['heldOut.model.pct']).toBe(pct(d.held_out_2023_24.models['LR-tuned'].accuracy));
    expect(t['live.clv.when']).toBe(d.live_2026.clv_verdict.final ? 'for the full season' : 'so far');
  });
  it('throws on an unknown token instead of rendering it', () => {
    expect(() => fillTokens('x {{nfl.nope}} y', t)).toThrow(/Unknown NFL token/);
  });
  it('escapes only when filling HTML', () => {
    const fake = { a: '<b>' };
    expect(fillTokens('{{nfl.a}}', fake)).toBe('<b>');
    expect(fillTokens('{{nfl.a}}', fake, { html: true })).toBe('&lt;b&gt;');
  });
});

describe('claims the card makes in words', () => {
  const clone = (): SiteData => structuredClone(d);

  it('the model beats always picking home in all three tests, in the current data', () => {
    for (const g of headlineGroups(d)) {
      const rate = (s: string) => g.rows.find((r) => r.strategy === s)!.rate.value;
      expect(rate('model'), g.label).toBeGreaterThan(rate('home'));
    }
    expect(testsNotBeatingHome(d)).toEqual([]);
    expect(() => assertBeatsHomeEverywhere(d)).not.toThrow();
  });

  it('fails the build (token step) if any test stops beating home', () => {
    const x = clone();
    x.live_2026.prediction_quality.home_baseline.accuracy.value = 0.99;
    expect(testsNotBeatingHome(x)).toEqual(['Live 2026']);
    expect(() => buildTokens(x)).toThrow(/did not beat always picking home in Live 2026/);
  });

  it('treats a tie with home as not beating it', () => {
    const x = clone();
    x.prereg_2025.home_baseline.accuracy.value = x.prereg_2025.models['LR-tuned'].accuracy.value;
    expect(testsNotBeatingHome(x)).toEqual(['Held-out 2025 season']);
  });

  it('the CLV verdict is the exact phrase the card was written for', () => {
    expect(d.live_2026.clv_verdict.verdict).toBe(NO_EDGE_VERDICT);
    expect(() => assertNoEdgeVerdict(d)).not.toThrow();
  });

  it('fails the build (token step) if the verdict changes, asking for a manual rewrite', () => {
    const x = clone();
    x.live_2026.clv_verdict.verdict = 'Evidence of an edge';
    expect(() => buildTokens(x)).toThrow(/needs a manual rewrite/);
  });
});

describe('negative control (schema 1.1.0)', () => {
  const clone = (): SiteData => structuredClone(d);
  const cond = (x: SiteData, id: string) => x.negative_control.conditions.find((c) => c.condition === id)!;
  const t = buildTokens(d);

  it('in the current data, Check 1 passes clean and fails every sabotage', () => {
    expect(cond(d, 'clean').check1.verdict).toBe('PASS');
    const sab = d.negative_control.conditions.filter((c) => c.role === 'sabotage');
    expect(sab.length).toBeGreaterThan(0);
    for (const c of sab) expect(c.check1.verdict, c.condition).toBe('FAIL');
  });

  it('fails the build if a sabotage passes Check 1', () => {
    const x = clone();
    cond(x, 'ewm_only').check1 = { verdict: 'PASS', failing_oracle: null };
    expect(() => buildTokens(x)).toThrow(/PASSES sabotage condition\(s\) ewm_only/);
  });

  it('fails the build if the clean pipeline fails Check 1', () => {
    const x = clone();
    cond(x, 'clean').check1 = { verdict: 'FAIL', failing_oracle: 'prior-only oracle on {m}_sd' };
    expect(() => buildTokens(x)).toThrow(/clean pipeline FAILS Check 1/);
  });

  it('fails the build if the "every sabotage above 70%, clean below" sentence stops being true', () => {
    const x = clone();
    cond(x, 'phase2_roll_left').check2.current_67.contrast_accuracy = 0.69;
    expect(() => buildTokens(x)).toThrow(/at or below 70%: phase2_roll_left/);
    const y = clone();
    cond(y, 'clean').check2.current_67.contrast_accuracy = 0.71;
    expect(() => buildTokens(y)).toThrow(/clean is above 70%/);
  });

  it('takes the leakage paragraph numbers from the block', () => {
    expect(t['nc.argument.columns']).toBe(String(cond(d, 'phase2_roll_left').n_columns_changed));
    expect(t['nc.argument.shuffled']).toBe(pct(cond(d, 'phase2_roll_left').check2.current_67.shuffled_mean));
    expect(t['nc.clean.shuffled']).toBe(pct(cond(d, 'clean').check2.current_67.shuffled_mean));
    expect(t['nc.nFeatures']).toBe(String(cond(d, 'clean').check2.current_67.n_features));
    expect(t['nc.evalSeason']).toBe(String(d.negative_control.seasons.check2_eval));
    expect(t['nc.ewm.columns']).toBe(String(cond(d, 'ewm_only').n_columns_changed));
  });

  it('never mixes feature sets: every negative-control figure comes from the 67-feature set', () => {
    const src = readFileSync(new URL('./tokens.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/phase2_42/);
  });

  it('links the script and JSON at the export commit, not at the control run commit', () => {
    for (const k of ['nc.scriptUrl', 'nc.resultsUrl']) {
      expect(t[k]).toContain(`/blob/${d.source_commit.hash}/`);
      expect(t[k]).not.toContain(d.negative_control.source_git_head);
    }
    expect(t['nc.controlCommit']).toBe(d.negative_control.source_git_head.slice(0, 7));
  });
});
