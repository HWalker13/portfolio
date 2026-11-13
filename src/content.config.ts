import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
  One Markdown file per project. Frontmatter feeds the tracklist and the top of each
  liner-notes page; the Markdown body is the liner notes themselves (added in M4).

  Copy may contain {{nfl.*}} tokens (src/data/nfl/tokens.ts). They are filled when the page
  renders, so numbers always come from the current NFL data file.

  `headlineStats[].context` is required on purpose: a number can't reach the page
  without its baseline or context next to it.
*/
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    track: z.number().int().min(1),
    side: z.enum(['A', 'B']),
    tagline: z.string().max(200),
    role: z.string().optional(),
    date: z.string().optional(),
    stack: z.array(z.string()).min(1),
    headlineStats: z
      .array(
        z.object({
          /** Optional words before the number, e.g. "Vegas hits" */
          lead: z.string().optional(),
          value: z.string(),
          /** Words after the number. Starts with punctuation to attach directly (", so …"). */
          context: z.string().min(10),
        }),
      )
      .min(1)
      .max(2),
    proof: z
      .array(
        z.object({
          kind: z.enum(['appstore', 'pypi', 'github']),
          label: z.string(),
          url: z.url(),
        }),
      )
      .min(1),
    /**
      Demo video for the reel (Stage 3). Paths under public/. Until a project has one, the reel
      shows a static card: the name, where it's live, and a button to it. The poster frame is required, so a
      video can never show up as a blank box.
    */
    /** A full results page beyond the liner notes (NFL only). Linked from the reel card. */
    results: z.string().startsWith('/').endsWith('/').optional(),
    video: z
      .object({
        webm: z.string().startsWith('/').optional(),
        mp4: z.string().startsWith('/'),
        poster: z.string().startsWith('/'),
        /** "phone" frames a portrait screen recording in a phone outline (Lovely). */
        frame: z.enum(['terminal', 'phone']).default('terminal'),
      })
      .optional(),
  }),
});

export const collections = { projects };
