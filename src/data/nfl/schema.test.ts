import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSiteData } from './schema';

const text = readFileSync(new URL('./site_data.json', import.meta.url), 'utf8');
const fresh = () => JSON.parse(text);

describe('NFL site_data schema', () => {
  it('accepts the checked-in export', () => {
    const d = parseSiteData(fresh());
    expect(d.schema_version).toMatch(/^1\./);
    expect(d.live_2026.weeks.length).toBeGreaterThan(0);
  });

  it('rejects a 2.x schema_version', () => {
    const raw = fresh();
    raw.schema_version = '2.0.0';
    expect(() => parseSiteData(raw)).toThrow(/schema_version/);
  });

  it('rejects a missing field the site renders, naming its path', () => {
    const raw = fresh();
    delete raw.live_2026.clv_verdict.verdict;
    expect(() => parseSiteData(raw)).toThrow(/live_2026\.clv_verdict\.verdict/);
  });

  it('rejects a rate whose value is not k/n', () => {
    const raw = fresh();
    raw.held_out_2023_24.models['LR-tuned'].accuracy.value = 0.7;
    expect(() => parseSiteData(raw)).toThrow(/k\/n/);
  });

  it('rejects a bet record whose W-L-V string disagrees with its counts', () => {
    const raw = fresh();
    raw.live_2026.official_bets.wins += 1;
    expect(() => parseSiteData(raw)).toThrow(/record/);
  });

  it('rejects a gap in the live weeks, so a missed week cannot silently disappear', () => {
    const raw = fresh();
    const missed = raw.live_2026.weeks.findIndex((w: { status: string }) => w.status === 'missed');
    expect(missed).toBeGreaterThan(-1);
    raw.live_2026.weeks.splice(missed, 1);
    expect(() => parseSiteData(raw)).toThrow(/not contiguous/);
  });

  it('rejects live games that do not match the week counts', () => {
    const raw = fresh();
    const i = raw.games.findIndex((g: { evaluation: string }) => g.evaluation === 'live_2026');
    raw.games.splice(i, 1);
    expect(() => parseSiteData(raw)).toThrow(/games_logged/);
  });

  it('rejects bet_units on a game without a bet', () => {
    const raw = fresh();
    const g = raw.games.find((x: { bet: boolean }) => !x.bet);
    g.bet_units = 1;
    expect(() => parseSiteData(raw)).toThrow(/bet_units without a bet/);
  });
});

describe('negative_control block (1.1.0)', () => {
  it('is required: the liner notes are built from it', () => {
    const raw = fresh();
    delete raw.negative_control;
    expect(() => parseSiteData(raw)).toThrow(/negative_control/);
  });
  it('rejects a column count that disagrees with the column list', () => {
    const raw = fresh();
    raw.negative_control.conditions[1].n_columns_changed += 1;
    expect(() => parseSiteData(raw)).toThrow(/n_columns_changed/);
  });
  it('rejects a control built from a 2023+ season', () => {
    const raw = fresh();
    raw.negative_control.seasons.check2_eval = 2023;
    expect(() => parseSiteData(raw)).toThrow(/2023\+ season/);
  });
  it('rejects a dirty control run', () => {
    const raw = fresh();
    raw.negative_control.src_dirty = true;
    expect(() => parseSiteData(raw)).toThrow(/src_dirty/);
  });
});
