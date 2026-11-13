import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncNflData } from './sync';

const real = readFileSync(new URL('./site_data.json', import.meta.url), 'utf8');
let dir: string;
let source: string;
let dest: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nfl-sync-'));
  source = join(dir, 'site_data.json');
  dest = join(dir, 'out', 'site_data.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const writeWith = (mutate: (d: Record<string, unknown>) => void) => {
  const d = JSON.parse(real);
  mutate(d);
  writeFileSync(source, JSON.stringify(d));
};

describe('sync:nfl', () => {
  it('copies a valid export byte for byte', () => {
    writeFileSync(source, real);
    syncNflData({ source, dest });
    expect(readFileSync(dest, 'utf8')).toBe(real);
  });

  it('fails loudly when the file is missing', () => {
    expect(() => syncNflData({ source, dest })).toThrow(/not found/);
    expect(existsSync(dest)).toBe(false);
  });

  it('fails on invalid JSON', () => {
    writeFileSync(source, '{ nope');
    expect(() => syncNflData({ source, dest })).toThrow(/not valid JSON/);
  });

  it('fails on a schema_version that is not 1.x, before anything else', () => {
    writeWith((d) => (d.schema_version = '2.0.0'));
    expect(() => syncNflData({ source, dest })).toThrow(/only reads 1\.x/);
    writeWith((d) => delete d.schema_version);
    expect(() => syncNflData({ source, dest })).toThrow(/only reads 1\.x/);
    expect(existsSync(dest)).toBe(false);
  });

  it('fails on a schema mismatch and writes nothing', () => {
    writeWith((d) => delete (d.live_2026 as Record<string, unknown>).weeks);
    expect(() => syncNflData({ source, dest })).toThrow(/failed validation/);
    expect(existsSync(dest)).toBe(false);
  });

  it('refuses a dirty export unless allowed', () => {
    writeWith((d) => ((d.source_commit as Record<string, unknown>).dirty = true));
    expect(() => syncNflData({ source, dest })).toThrow(/uncommitted/);
    expect(() => syncNflData({ source, dest, allowDirty: true })).not.toThrow();
  });
});
