import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
  One Markdown file per project. Frontmatter feeds the tracklist and the top of each
  liner-notes page; the Markdown body is the liner notes themselves (added in M4).

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
          value: z.string(),
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
  }),
});

export const collections = { projects };
