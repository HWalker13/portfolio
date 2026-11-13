/*
  Copies the NFL Game Predictor's exported site_data.json into this repo, after checking it.
  The CLI is scripts/sync-nfl-data.ts (`npm run sync:nfl`); the logic lives here so it can be tested.

  The copy is checked in on purpose: Vercel builds this repo alone and can't see the NFL repo.
  The bytes are copied unchanged, so `git diff` on the copy shows exactly what the export changed.
*/
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSiteData, type SiteData } from './schema.ts';

export const DEFAULT_SOURCE = '/Users/holdenanderson/Personal Projects/NFL-GAME-PREDICTOR/exports/site_data.json';
export const SOURCE_ENV = 'NFL_SITE_DATA';

export interface SyncOptions {
  source: string;
  dest: string;
  /** Accept an export built from uncommitted code or data (source_commit.dirty). Off by default. */
  allowDirty?: boolean;
}

export function syncNflData({ source, dest, allowDirty = false }: SyncOptions): SiteData {
  if (!existsSync(source)) {
    throw new Error(`NFL export not found at ${source}\nRun the exporter in the NFL repo, or point ${SOURCE_ENV} at the file.`);
  }
  const text = readFileSync(source, 'utf8');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`NFL export at ${source} is not valid JSON: ${(e as Error).message}`);
  }

  // Check the version first, so a 2.x file gets a clear message instead of a list of field errors.
  const version = (raw as { schema_version?: unknown } | null)?.schema_version;
  if (typeof version !== 'string' || !/^1\.\d+\.\d+$/.test(version)) {
    throw new Error(`NFL export has schema_version ${JSON.stringify(version)}; this site only reads 1.x. Update src/data/nfl/schema.ts first.`);
  }

  const data = parseSiteData(raw);
  if (data.source_commit.dirty && !allowDirty) {
    throw new Error(
      `NFL export was built from uncommitted changes (${data.source_commit.dirty_paths.join(', ') || 'paths not listed'}).\n` +
        'Commit them in the NFL repo and re-export, or pass --allow-dirty.',
    );
  }

  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
  return data;
}
