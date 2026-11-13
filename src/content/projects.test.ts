/*
  Guard: every metric on the NFL pages comes from the data file (src/data/nfl/site_data.json).

  NFL project content and the results page's templates may not contain a hand-typed number.
  Figures are written as {{nfl.name}} tokens (src/data/nfl/tokens.ts) or Astro expressions.
  What's left after removing tokens, expressions, HTML comments, tags and the allowlist below
  must have no digits at all.
*/
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSiteData } from '../data/nfl/schema';
import { buildTokens, fillTokens, TOKEN } from '../data/nfl/tokens';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/**
  Numbers that are design facts, not results, and are not in the data file. Approved by Holden;
  each cites where it comes from in the NFL repo (github.com/HWalker13/NFL-GAME-PREDICTOR).
*/
const ALLOWLIST: RegExp[] = [
  // The model's feature count. src/live_models.py asserts len(cols) == 67 for features.feature_columns().
  /\b67 point-in-time features\b/g,
  // The leakage audit's four checks: src/leakage_checks.py, "Check 1" to "Check 4" (SPEC.md section 5.5).
  /\b4-part\b/g,
  // The 2025 run's code hashes: docs/PHASE8_PREREG.md, "Code frozen before approval (SHA-256)".
  /\bSHA-256(-locked)?\b/g,
  // The confidence level, not a result: exports/SCHEMA.md, "ci95 is a 95% Wilson interval" / "95% t-interval".
  /\b95% (CI|confidence intervals?)\b/g,
];
/** Years and season ranges ("2025", "2023–24") are labels, not metrics. */
const YEARS = /\b(19|20)\d{2}(–\d{2})?\b/g;

const stripCommon = (s: string) => {
  let out = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(TOKEN, ' ');
  for (const re of ALLOWLIST) out = out.replace(re, ' ');
  return out.replace(YEARS, ' ');
};

/** Lines that still contain a digit, for a readable failure message. */
const offending = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\d/.test(l));

/**
  Markdown: drop structure that isn't copy (the track number, links and asset paths in frontmatter,
  Markdown link targets), then tags (SVG coordinates).
*/
function markdownText(src: string): string {
  const s = src
    .replace(/^track:\s*\d+\s*$/m, ' ')
    .replace(/^\s*(url|webm|mp4|poster|results):.*$/gm, ' ')
    .replace(/\]\([^)]*\)/g, ']');
  return stripCommon(s).replace(/<[^>]*>/g, ' ');
}

/** Astro template: drop the frontmatter script, <style>, {expressions} (brace-balanced) and tags. */
function astroText(src: string): string {
  let s = src.replace(/^---[\s\S]*?\n---/, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ');
  let out = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  s = out.replace(/<[^>]*>/g, ' ');
  return stripCommon(s);
}

const NFL_MD = 'src/content/projects/nfl-game-predictor.md';
const astroFiles = ['src/pages/projects/nfl-game-predictor', 'src/components/nfl'].flatMap((dir) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir))
        .filter((f) => f.endsWith('.astro'))
        .map((f) => `${dir}/${f}`)
    : [],
);

describe('NFL numbers come from the data file', () => {
  it('the NFL project content has no hand-typed metric', () => {
    expect(offending(markdownText(read(NFL_MD)))).toEqual([]);
  });

  it('the test itself catches a hand-typed number', () => {
    expect(offending(markdownText('It scored 64.3% on {{nfl.heldOut.n}} games.'))).toEqual(['It scored 64.3% on   games.']);
    expect(offending(markdownText('p = 0.0525'))).toHaveLength(1);
    expect(offending(astroText('---\nconst x = 1;\n---\n<p>We hit {pct(x)} in 2025, and 58 games.</p>'))).toHaveLength(1);
  });

  it.each(astroFiles)('%s has no hand-typed metric', (file) => {
    expect(offending(astroText(read(file)))).toEqual([]);
  });

  it('every token in the NFL content resolves', () => {
    const d = parseSiteData(JSON.parse(read('src/data/nfl/site_data.json')));
    expect(() => fillTokens(read(NFL_MD), buildTokens(d))).not.toThrow();
  });

  it('does not call the 2025 test pre-registered (pending Holden’s wording)', () => {
    const visible = read(NFL_MD).replace(/<!--[\s\S]*?-->/g, '');
    expect(visible).not.toMatch(/pre-?regist/i);
  });
});
