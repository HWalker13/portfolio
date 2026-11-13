/*
  The NFL Game Predictor's results, validated once at build time.

  Import this only from .astro frontmatter or other build-time modules, never from a client
  <script>: the JSON is ~600 KB and the page should ship only the HTML it renders.
  A schema mismatch throws here, which fails `astro build`.
*/
import raw from './site_data.json';
import { parseSiteData } from './schema';
import { buildTokens, fillTokens } from './tokens';

export const nfl = parseSiteData(raw);

/** Every named figure content can use, as {{nfl.name}}. */
export const nflTokens = buildTokens(nfl);
/** Fill {{nfl.*}} tokens in a string from the current data. Throws on an unknown name. */
export const fillNfl = (text: string): string => fillTokens(text, nflTokens);
/** Same, for rendered HTML (inserted values are escaped). */
export const fillNflHtml = (html: string): string => fillTokens(html, nflTokens, { html: true });

interface ProjectCopy {
  tagline: string;
  headlineStats: { lead?: string; value: string; context: string }[];
}
/** A project's frontmatter copy with {{nfl.*}} tokens filled. A no-op for projects without tokens. */
export function fillProjectCopy<T extends ProjectCopy>(d: T): T {
  return {
    ...d,
    tagline: fillNfl(d.tagline),
    headlineStats: d.headlineStats.map((s) => ({
      ...s,
      lead: s.lead === undefined ? undefined : fillNfl(s.lead),
      value: fillNfl(s.value),
      context: fillNfl(s.context),
    })),
  };
}
