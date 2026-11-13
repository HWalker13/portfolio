/*
  Pure views of the validated NFL data: the headline comparison, the per-week tracker and the
  live picks rows. Everything takes SiteData as an argument, so tests can feed it variants.
*/
import type { BetRecord, Evaluation, LiveGame, LiveWeek, NcCondition, Rate, SiteData } from './schema';

// ── Headline comparison ──────────────────────────────────────────────────

export type Strategy = 'home' | 'model' | 'vegas';
export const STRATEGY_LABEL: Record<Strategy, string> = {
  home: 'Always pick home',
  model: 'My model',
  vegas: 'Vegas favorite',
};

export interface HeadlineGroup {
  id: 'held-out-2023-24' | 'held-out-2025' | 'live-2026';
  label: string;
  n: number;
  rows: { strategy: Strategy; rate: Rate }[];
}

export function headlineGroups(d: SiteData): HeadlineGroup[] {
  const hist = (e: Evaluation) => [
    { strategy: 'home' as const, rate: e.home_baseline.accuracy },
    { strategy: 'model' as const, rate: e.models[e.selected_model].accuracy },
    { strategy: 'vegas' as const, rate: e.vegas_favorite.accuracy },
  ];
  const q = d.live_2026.prediction_quality;
  return [
    { id: 'held-out-2023-24', label: 'Held-out 2023–24', n: d.held_out_2023_24.n, rows: hist(d.held_out_2023_24) },
    // Site wording for 2025 is "held-out 2025 season", not the export's label (pending Holden's call).
    { id: 'held-out-2025', label: 'Held-out 2025 season', n: d.prereg_2025.n, rows: hist(d.prereg_2025) },
    {
      id: 'live-2026',
      label: 'Live 2026',
      n: q.champion.accuracy.n,
      rows: [
        { strategy: 'home', rate: q.home_baseline.accuracy },
        { strategy: 'model', rate: q.champion.accuracy },
        { strategy: 'vegas', rate: q.vegas_favorite.accuracy },
      ],
    },
  ];
}

/** Bar and interval positions as fractions of the 0–100% track. */
export const barGeometry = (r: Rate) => ({ value: r.value, lo: r.ci95[0], hi: r.ci95[1] });

/** Accuracy range across the four candidate models (the "statistical tie"). */
export function modelRange(e: Evaluation): [number, number] {
  const v = Object.values(e.models).map((m) => m.accuracy.value);
  return [Math.min(...v), Math.max(...v)];
}

export const minMcnemarP = (e: Evaluation): number => Math.min(...e.mcnemar.map((m) => m.p));

/** The McNemar p for one pair, in either order. Throws if the pair is missing. */
export function mcnemarP(e: Evaluation, a: string, b: string): number {
  const m = e.mcnemar.find((x) => (x.model_a === a && x.model_b === b) || (x.model_a === b && x.model_b === a));
  if (!m) throw new Error(`No McNemar result for ${a} vs ${b}`);
  return m.p;
}

// ── Claims the card makes in words ───────────────────────────────────────

/**
  The card says the model beat always picking home "in all three" tests. Returns the tests where
  it did NOT (point estimates: model accuracy strictly above home-baseline accuracy).
*/
export function testsNotBeatingHome(d: SiteData): string[] {
  return headlineGroups(d)
    .filter((g) => {
      const rate = (s: Strategy) => g.rows.find((r) => r.strategy === s)!.rate.value;
      return !(rate('model') > rate('home'));
    })
    .map((g) => g.label);
}

/** Throws (failing the build) if the "beat always picking home in all three" claim is false. */
export function assertBeatsHomeEverywhere(d: SiteData): void {
  const failed = testsNotBeatingHome(d);
  if (failed.length) {
    throw new Error(
      `NFL card claim is false: the model did not beat always picking home in ${failed.join(', ')}. ` +
        'Rewrite the card copy that uses {{nfl.claim.beatsHomeAllTests}} (src/content/projects/nfl-game-predictor.md).',
    );
  }
}

/** The exact verdict the card's "I claim none" sentence was written for. */
export const NO_EDGE_VERDICT = 'No evidence of an edge';

/**
  Throws (failing the build) if the live CLV verdict is no longer "No evidence of an edge".
  Deliberately no automatic rewording: the card's edge sentence needs a human rewrite.
*/
export function assertNoEdgeVerdict(d: SiteData): void {
  const v = d.live_2026.clv_verdict.verdict;
  if (v !== NO_EDGE_VERDICT) {
    throw new Error(
      `NFL CLV verdict is now "${v}", not "${NO_EDGE_VERDICT}". The card's edge sentence ("…shows no evidence of an edge… I claim none.") ` +
        'needs a manual rewrite in src/content/projects/nfl-game-predictor.md (and the liner notes\' "No edge" line), then update NO_EDGE_VERDICT in src/data/nfl/derive.ts.',
    );
  }
}

// ── Leakage negative control ─────────────────────────────────────────────

/** One negative-control condition by id. Throws if the export no longer has it. */
export function ncCondition(d: SiteData, id: string): NcCondition {
  const c = d.negative_control.conditions.find((x) => x.condition === id);
  if (!c) throw new Error(`NFL negative control has no "${id}" condition; the liner notes' leakage paragraph needs it.`);
  return c;
}

export const ncSabotages = (d: SiteData): NcCondition[] => d.negative_control.conditions.filter((c) => c.role === 'sabotage');

/**
  Throws (failing the build) unless the timestamp check (Check 1) passes the clean pipeline and
  fails every sabotage. The liner notes say the experiment proves exactly that.
*/
export function assertNegativeControlCaught(d: SiteData): void {
  const nc = d.negative_control;
  const clean = nc.conditions.find((c) => c.role === 'control');
  const missed = ncSabotages(d).filter((c) => c.check1.verdict !== 'FAIL').map((c) => c.condition);
  const problems: string[] = [];
  if (!clean || clean.check1.verdict !== 'PASS') problems.push(`the clean pipeline FAILS Check 1 (${clean?.check1.failing_oracle ?? 'no clean condition'})`);
  if (missed.length) problems.push(`Check 1 PASSES sabotage condition(s) ${missed.join(', ')}, so a leak went undetected`);
  if (problems.length) {
    throw new Error(
      `NFL negative control (control ran on ${nc.source_git_head.slice(0, 7)}): ${problems.join('; ')}. ` +
        'The liner notes claim the timestamp check catches every sabotage; fix Check 1 in the NFL repo and re-export, or rewrite that paragraph.',
    );
  }
}

/**
  The NFL repo's "stop and flag anything above ~70% accuracy" rule (its CLAUDE.md, from SPEC
  5.6/5.7). The liner notes say every sabotage crossed it and the clean pipeline didn't.
*/
export const SUSPICIOUS_ACCURACY = 0.7;

/** Throws (failing the build) if that sentence stops being true for the current 67-feature set. */
export function assertSabotageContrastClaim(d: SiteData): void {
  const clean = d.negative_control.conditions.find((c) => c.role === 'control');
  const low = ncSabotages(d).filter((c) => !(c.check2.current_67.contrast_accuracy > SUSPICIOUS_ACCURACY)).map((c) => c.condition);
  const cleanHigh = !clean || clean.check2.current_67.contrast_accuracy > SUSPICIOUS_ACCURACY;
  if (low.length || cleanHigh) {
    throw new Error(
      'NFL liner notes say every sabotaged pipeline scored above 70% on real labels and the clean one did not, ' +
        `but the data disagrees (${low.length ? `at or below 70%: ${low.join(', ')}` : ''}${cleanHigh ? ' clean is above 70%' : ''}). ` +
        'Rewrite the sentence using {{nfl.nc.contrast.*}} in src/content/projects/nfl-game-predictor.md.',
    );
  }
}

// ── Live 2026, week by week ──────────────────────────────────────────────

export interface WeekRow {
  week: LiveWeek;
  games: LiveGame[];
  picksRight: number;
  bets: { wins: number; losses: number; voids: number; pending: number; units: number };
}

export const liveGames = (d: SiteData): LiveGame[] =>
  d.games.filter((g): g is LiveGame => g.evaluation === 'live_2026');

export function weekRows(d: SiteData): WeekRow[] {
  const games = liveGames(d);
  return d.live_2026.weeks.map((week) => {
    const g = games.filter((x) => x.week === week.week);
    const bets = g.filter((x) => x.bet);
    const settled = bets.filter((x) => x.bet_units !== null);
    return {
      week,
      games: g,
      picksRight: g.filter((x) => x.pick_correct === true).length,
      bets: {
        wins: settled.filter((x) => x.result !== 'tie' && (x.bet_units ?? 0) > 0).length,
        losses: settled.filter((x) => (x.bet_units ?? 0) < 0).length,
        voids: settled.filter((x) => x.result === 'tie').length,
        pending: bets.length - settled.length,
        units: settled.reduce((s, x) => s + (x.bet_units ?? 0), 0),
      },
    };
  });
}

/** One plain status line per week. Missed and partial weeks say so in words. */
export function weekStatus(w: LiveWeek): { kind: LiveWeek['status']; label: string; detail: string } {
  switch (w.status) {
    case 'graded':
      return { kind: 'graded', label: 'Graded', detail: `all ${w.scheduled} games predicted and graded` };
    case 'partial':
      return { kind: 'partial', label: 'Partial', detail: `only ${w.predicted} of ${w.scheduled} games predicted` };
    case 'missed':
      return { kind: 'missed', label: 'Missed', detail: `no picks logged for its ${w.scheduled} games` };
    case 'pending':
      return {
        kind: 'pending',
        label: 'Pending',
        detail: w.predicted ? `${w.pending} of ${w.predicted} predicted games not graded yet` : `no picks logged yet`,
      };
  }
}

// ── Live picks table ─────────────────────────────────────────────────────

export interface PickRow {
  game: LiveGame;
  matchup: string;
  pickTeam: string;
  /** Model's chance that its picked team wins. */
  modelChance: number;
  /** Market's (vig-free) chance for that same team; null if no moneyline. */
  marketChance: number | null;
  bet: { team: string; odds: number; againstPick: boolean } | null;
  score: string | null;
  pickRight: 'yes' | 'no' | 'tie' | 'pending';
  betResult: { kind: 'won' | 'lost' | 'void' | 'pending'; units: number | null } | null;
}

export function pickRow(g: LiveGame): PickRow {
  const team = (s: 'home' | 'away') => (s === 'home' ? g.home : g.away);
  const forPick = (pHome: number) => (g.model_pick === 'home' ? pHome : 1 - pHome);
  const pending = g.result === 'pending';
  let betResult: PickRow['betResult'] = null;
  if (g.bet) {
    if (g.bet_units === null) betResult = { kind: 'pending', units: null };
    else if (g.result === 'tie') betResult = { kind: 'void', units: 0 };
    else betResult = { kind: g.bet_units > 0 ? 'won' : 'lost', units: g.bet_units };
  }
  return {
    game: g,
    matchup: `${g.away} @ ${g.home}`,
    pickTeam: team(g.model_pick),
    modelChance: forPick(g.model_home_prob),
    marketChance: g.vegas_implied_home_prob === null ? null : forPick(g.vegas_implied_home_prob),
    bet:
      g.bet && g.bet_side && g.bet_odds !== null
        ? { team: team(g.bet_side), odds: g.bet_odds, againstPick: g.bet_side !== g.model_pick }
        : null,
    score: pending || g.away_score === null || g.home_score === null ? null : `${g.away} ${g.away_score}, ${g.home} ${g.home_score}`,
    pickRight: pending ? 'pending' : g.result === 'tie' ? 'tie' : g.pick_correct ? 'yes' : 'no',
    betResult,
  };
}

// ── Paper betting ────────────────────────────────────────────────────────

export interface BetColumn {
  id: string;
  label: string;
  retroactive: boolean;
  record: BetRecord | Evaluation['retroactive_bets'];
  games: number;
}

export function betColumns(d: SiteData): BetColumn[] {
  return [
    { id: 'b2324', label: '2023–24, replayed', retroactive: true, record: d.held_out_2023_24.retroactive_bets, games: d.held_out_2023_24.n },
    { id: 'b2025', label: '2025, replayed', retroactive: true, record: d.prereg_2025.retroactive_bets, games: d.prereg_2025.n },
    { id: 'b2026', label: '2026, live', retroactive: false, record: d.live_2026.official_bets, games: d.live_2026.games_logged },
  ];
}
