/*
  npm run sync:nfl [-- --allow-dirty]

  Copies exports/site_data.json from the NFL Game Predictor repo to src/data/nfl/site_data.json,
  after validating it against the site's schema. Source path: $NFL_SITE_DATA, or the default in
  src/data/nfl/sync.ts. Exits 1 with a message on any problem, and writes nothing.
  Node runs this .ts file directly (type stripping, Node 22.18+).
*/
import { fileURLToPath } from 'node:url';
import { DEFAULT_SOURCE, SOURCE_ENV, syncNflData } from '../src/data/nfl/sync.ts';

const source = process.env[SOURCE_ENV] || DEFAULT_SOURCE;
const dest = fileURLToPath(new URL('../src/data/nfl/site_data.json', import.meta.url));

try {
  const d = syncNflData({ source, dest, allowDirty: process.argv.includes('--allow-dirty') });
  const L = d.live_2026;
  console.log(`Synced NFL site data ${d.schema_version} from ${source}`);
  console.log(`  generated_at  ${d.generated_at}`);
  console.log(`  source commit ${d.source_commit.hash}${d.source_commit.dirty ? ' (DIRTY)' : ''}`);
  console.log(`  live 2026     ${L.games_logged} games logged, ${L.games_decided} decided, as of ${L.as_of_utc}`);
  console.log(`  weeks         ${L.weeks.map((w) => `${w.week}:${w.status}`).join(' ')}`);
  console.log(`  CLV verdict   ${L.clv_verdict.verdict}${L.clv_verdict.final ? ' (final)' : ' (not final)'}`);
} catch (e) {
  console.error(`sync:nfl failed: ${(e as Error).message}`);
  process.exit(1);
}
