/*
  Zod schema for the parts of the NFL Game Predictor's `site_data.json` (schema 1.x) that this
  site renders. Field docs live in the NFL repo: exports/SCHEMA.md.

  The file is parsed once at build time (src/data/nfl/index.ts) and again by the sync script
  before it copies anything. A mismatch throws, so the build fails instead of rendering blanks.
  Unknown keys are dropped by zod, so the export can grow without breaking the site; a field the
  site uses that disappears or changes type is an error.

  Kept free of Astro-only imports except `astro/zod`, so `node scripts/sync-nfl-data.ts` can
  import it directly.
*/
import { z } from 'astro/zod';

const SCHEMA_MAJOR = 1;
const prob = z.number().min(0).max(1);
const count = z.number().int().min(0);
const isoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'expected UTC ISO-8601 with a Z suffix');
const sha = z.string().regex(/^[0-9a-f]{40}$/, 'expected a full 40-character git hash');

/** A rate always carries k and n, and its 95% interval brackets the value. */
export const rate = z
  .object({ k: count, n: z.number().int().min(1), value: prob, ci95: z.tuple([prob, prob]) })
  .refine((r) => r.k <= r.n, 'k > n')
  .refine((r) => Math.abs(r.value - r.k / r.n) < 5e-4, 'value is not k/n')
  .refine((r) => r.ci95[0] <= r.value && r.value <= r.ci95[1], 'ci95 does not bracket value');

/** A mean with a t-interval. The interval is [null, null] when n < 2. */
const mean = z.object({
  mean: z.number(),
  ci95: z.tuple([z.number().nullable(), z.number().nullable()]),
});

const modelScores = z.object({ accuracy: rate, log_loss: z.number(), brier: z.number() });
const MODEL_NAMES = ['LR-tuned', 'LR-untuned', 'RandomForest', 'HGB-tuned'] as const;

const clv = z.object({
  n: count,
  n_excluded: count,
  mean: z.number().nullable(),
  ci95: z.tuple([z.number().nullable(), z.number().nullable()]),
  p_one_sided: z.number().min(0).max(1).nullable(),
});

const betRecord = z
  .object({
    bets: count,
    wins: count,
    losses: count,
    voids: count,
    pending: count,
    record: z.string(),
    units: z.number(),
    roi: z.number(),
    roi_ci95: z.tuple([z.number(), z.number()]),
    home_bets: count,
    away_bets: count.optional(),
    bets_against_model_pick: count.optional(),
    retroactive: z.boolean().optional(),
    clv: clv.optional(),
  })
  .refine((b) => b.record === `${b.wins}-${b.losses}-${b.voids}`, 'record does not match wins/losses/voids')
  .refine((b) => b.wins + b.losses + b.voids + b.pending === b.bets, 'bet outcomes do not add up to bets');

const mcnemarPair = z.object({
  model_a: z.enum(MODEL_NAMES),
  model_b: z.enum(MODEL_NAMES),
  only_a_right: count,
  only_b_right: count,
  p: z.number().min(0).max(1),
});

const evaluation = z
  .object({
    label: z.string(),
    seasons: z.array(z.number().int()).min(1),
    n: z.number().int().min(1),
    ties_excluded: count,
    line_timing: z.string(),
    models: z.object({
      'LR-tuned': modelScores,
      'LR-untuned': modelScores,
      RandomForest: modelScores,
      'HGB-tuned': modelScores,
    }),
    home_baseline: z.object({ accuracy: rate }),
    vegas_favorite: z.object({ accuracy: rate, unresolved_excluded: count }),
    vegas_implied: z.object({ accuracy: rate, log_loss: z.number(), brier: z.number() }),
    selected_model: z.literal('LR-tuned'),
    selection_note: z.string().min(1),
    mcnemar: z.array(mcnemarPair).length(6),
    retroactive_bets: betRecord.refine((b) => b.retroactive === true, 'historical bets must be marked retroactive'),
    retroactive_bets_note: z.string().min(1),
  })
  .refine((e) => Object.values(e.models).every((m) => m.accuracy.n === e.n), 'a model was scored on a different n');

const week = z.object({
  week: z.number().int().min(1),
  status: z.enum(['graded', 'partial', 'missed', 'pending']),
  scheduled: count,
  predicted: count,
  graded: count,
  decided: count,
  ties: count,
  pending: count,
  first_kickoff_utc: isoUtc,
  prediction_commit: sha.nullable(),
  prediction_committed_at: isoUtc.nullable(),
});

const quality = z.object({ n: count, accuracy: rate, log_loss: mean, brier: mean });

const live = z.object({
  label: z.string(),
  as_of_utc: isoUtc,
  first_official_week: z.number().int().min(1),
  games_logged: count,
  games_graded: count,
  games_decided: count,
  games_pending: count,
  ties: count,
  line_timing: z.string(),
  prediction_quality: z.object({
    champion: quality,
    home_baseline: z.object({ n: count, accuracy: rate }),
    vegas_favorite: z.object({ n: count, accuracy: rate }),
    vegas_implied: z.object({ n: count, log_loss: mean, brier: mean }),
  }),
  official_bets: betRecord.refine((b) => b.clv !== undefined, 'official bets need a clv block'),
  clv_verdict: z.object({
    verdict: z.string().min(1),
    statement: z.string().min(1),
    final: z.boolean(),
    n: count,
    n_excluded: count,
    mean: z.number().nullable(),
    ci95: z.tuple([z.number().nullable(), z.number().nullable()]),
    p_one_sided: z.number().min(0).max(1).nullable(),
    rule: z.string().min(1),
    clv_window_rule: z.string().min(1),
  }),
  weeks: z.array(week).min(1),
  provenance_note: z.string().min(1),
});

const side = z.enum(['home', 'away']);
const gameBase = {
  season: z.number().int(),
  week: z.number().int().min(1),
  game_id: z.string().min(1),
  away: z.string().min(2),
  home: z.string().min(2),
  kickoff_utc: isoUtc,
  model_home_prob: prob,
  vegas_implied_home_prob: prob.nullable(),
  model_pick: side,
  bet: z.boolean(),
  bet_side: side.nullable(),
  bet_odds: z.number().nullable(),
  result: z.enum(['home', 'away', 'tie', 'pending']),
  home_score: z.number().int().nullable(),
  away_score: z.number().int().nullable(),
  pick_correct: z.boolean().nullable(),
  bet_units: z.number().nullable(),
};
const historicalGame = z.object({ evaluation: z.enum(['held_out_2023_24', 'prereg_2025']), ...gameBase });
const liveGame = z.object({
  evaluation: z.literal('live_2026'),
  ...gameBase,
  bet_status: z.literal('official').nullable(),
  prediction_commit: sha,
  prediction_committed_at: isoUtc,
});
const game = z
  .discriminatedUnion('evaluation', [historicalGame, liveGame])
  .refine((g) => g.bet === (g.bet_side !== null) && g.bet === (g.bet_odds !== null), 'bet, bet_side and bet_odds disagree')
  .refine((g) => g.bet || g.bet_units === null, 'bet_units without a bet');

// Leakage-check negative control (schema 1.1.0+). Copied by the exporter from the NFL repo's
// audit/out/negative_control.json; the build-time claims about it are asserted in derive.ts.
const check2Set = z.object({
  n_features: z.number().int().min(1),
  shuffled_mean: prob,
  contrast_accuracy: prob,
  verdict: z.string().min(1),
});
const ncCondition = z
  .object({
    condition: z.string().min(1),
    role: z.enum(['control', 'sabotage']),
    description: z.string().min(1),
    columns_changed: z.array(z.string()),
    n_columns_changed: count,
    check1: z.object({ verdict: z.enum(['PASS', 'FAIL']), failing_oracle: z.string().nullable() }),
    check2: z.object({ current_67: check2Set, phase2_42: check2Set }),
  })
  .refine((c) => c.n_columns_changed === c.columns_changed.length, 'n_columns_changed is not the length of columns_changed')
  .refine((c) => (c.check1.verdict === 'PASS') === (c.check1.failing_oracle === null), 'check1 verdict and failing_oracle disagree')
  .refine((c) => (c.role === 'control') === (c.condition === 'clean'), 'only the clean condition may be the control');

const negativeControl = z
  .object({
    label: z.string().min(1),
    source: z.string().min(1),
    source_git_head: sha,
    src_dirty: z.literal(false),
    seasons: z.object({
      features_built_from: z.tuple([z.number().int(), z.number().int()]),
      check1_rows: z.string(),
      check2_train: z.string(),
      check2_eval: z.number().int(),
      not_reproduced: z.string(),
    }),
    conditions: z.array(ncCondition).min(2),
    note: z.string().min(1),
  })
  .refine((n) => n.conditions.filter((c) => c.role === 'control').length === 1, 'need exactly one control condition')
  .refine((n) => new Set(n.conditions.map((c) => c.condition)).size === n.conditions.length, 'duplicate condition ids')
  // The control is built from seasons before the 2023-24 test seasons; anything later is a leak of its own.
  .refine((n) => n.seasons.features_built_from[1] < 2023 && n.seasons.check2_eval < 2023, 'negative control uses a 2023+ season');

const DEFINITION_KEYS = [
  'accuracy',
  'log_loss',
  'brier',
  'home_baseline',
  'vegas_favorite',
  'vegas_implied',
  'units',
  'roi',
  'clv',
  'bet_rule',
  'ci95',
  'mcnemar_p',
  'retroactive',
  'pre_registered',
  'prediction_committed_at',
] as const;

export const siteDataSchema = z
  .object({
    schema_version: z
      .string()
      .regex(new RegExp(`^${SCHEMA_MAJOR}\\.\\d+\\.\\d+$`), `schema_version must be ${SCHEMA_MAJOR}.x.y`),
    generated_at: isoUtc,
    source_commit: z.object({ hash: sha, dirty: z.boolean(), dirty_paths: z.array(z.string()) }),
    definitions: z.object(Object.fromEntries(DEFINITION_KEYS.map((k) => [k, z.string().min(1)])) as Record<(typeof DEFINITION_KEYS)[number], z.ZodString>),
    held_out_2023_24: evaluation,
    prereg_2025: evaluation,
    live_2026: live,
    /** Added in 1.1.0. Required: the liner notes' leakage paragraph is built from it. */
    negative_control: negativeControl,
    games: z.array(game).min(1),
  })
  .superRefine((d, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const L = d.live_2026;

    // Weeks run without gaps from the first official week, so a missed week can't vanish.
    L.weeks.forEach((w, i) => {
      if (w.week !== L.first_official_week + i) fail(`live_2026.weeks is not contiguous at index ${i} (week ${w.week})`);
    });

    const liveGames = d.games.filter((g) => g.evaluation === 'live_2026');
    if (liveGames.length !== L.games_logged) fail(`${liveGames.length} live games, but games_logged = ${L.games_logged}`);
    for (const w of L.weeks) {
      const n = liveGames.filter((g) => g.week === w.week).length;
      if (n !== w.predicted) fail(`week ${w.week}: ${n} games in the file, but predicted = ${w.predicted}`);
    }
    if (liveGames.some((g) => g.week < L.first_official_week)) fail('a live game is from before first_official_week');

    for (const [key, block] of [
      ['held_out_2023_24', d.held_out_2023_24],
      ['prereg_2025', d.prereg_2025],
    ] as const) {
      const n = d.games.filter((g) => g.evaluation === key).length;
      if (n !== block.n) fail(`${n} ${key} games, but n = ${block.n}`);
    }
  });

export type SiteData = z.infer<typeof siteDataSchema>;
export type Rate = z.infer<typeof rate>;
export type Evaluation = SiteData['held_out_2023_24'];
export type LiveWeek = SiteData['live_2026']['weeks'][number];
export type Game = SiteData['games'][number];
export type LiveGame = Extract<Game, { evaluation: 'live_2026' }>;
export type BetRecord = SiteData['live_2026']['official_bets'];
export type NegativeControl = SiteData['negative_control'];
export type NcCondition = NegativeControl['conditions'][number];

/** Parse, or throw an error that lists every problem with its JSON path. */
export function parseSiteData(raw: unknown): SiteData {
  const result = siteDataSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`NFL site_data.json failed validation:\n${lines.join('\n')}`);
  }
  return result.data;
}
