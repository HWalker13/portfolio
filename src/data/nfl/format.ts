/*
  Number formatting for the NFL pages, in one place, so every figure on the site is rounded and
  signed the same way. Negative numbers use a real minus sign (U+2212), ranges an en dash.
*/
import type { Rate } from './schema';

const MINUS = '−';

/** Fixed decimals with a real minus sign. */
export const fixed = (x: number, dp: number): string => {
  const s = Math.abs(x).toFixed(dp);
  return x < 0 && Number(s) !== 0 ? MINUS + s : s;
};
/** Fixed decimals with an explicit + for positives ("+10.98", "−54.15"). */
export const signed = (x: number, dp: number): string => (x > 0 ? '+' : '') + fixed(x, dp);

/** 0.6434 → "64.3%". */
export const pct = (x: number | Rate, dp = 1): string => `${fixed(100 * (typeof x === 'number' ? x : x.value), dp)}%`;
/** 0.2112 → "+21.1%". */
export const signedPct = (x: number, dp = 1): string => `${signed(100 * x, dp)}%`;
/** A 95% interval as "60.2–68.3%". */
/* With `plus` (ROI, which crosses zero) it reads "−18.1% to +60.3%": a dash between signed numbers reads badly. */
export const ciPct = ([lo, hi]: readonly [number, number], dp = 1, plus = false): string =>
  plus ? `${signedPct(lo, dp)} to ${signedPct(hi, dp)}` : `${fixed(100 * lo, dp)}–${pct(hi, dp)}`;
/** "350 of 544". */
export const kOfN = (r: Rate): string => `${r.k} of ${r.n}`;
/** Log loss / Brier: three decimals. */
export const score3 = (x: number): string => fixed(x, 3);
/** A p-value: four decimals, trailing zeros dropped (0.0525, 0.0963, 0.7038). */
export const pValue = (p: number): string => String(Number(p.toFixed(4)));
/** American odds: "+130" or "−155". */
export const odds = (x: number): string => signed(x, 0);
/** "2023–24" for [2023, 2024]; "2025" for [2025]. */
export const seasons = (s: readonly number[]): string =>
  s.length === 1 ? String(s[0]) : `${s[0]}–${String(s[s.length - 1]).slice(2)}`;

/** "Nov 12, 2026" from an ISO timestamp (UTC date). */
export const day = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** "Nov 12, 2026, 21:09 UTC". */
export const dayTime = (iso: string): string => `${day(iso)}, ${iso.slice(11, 16)} UTC`;
