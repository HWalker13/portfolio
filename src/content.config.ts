import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
  One Markdown file per project. Frontmatter feeds the tracklist index, the reel and the top of
  each liner-notes page; the Markdown body is the liner notes themselves.

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
    /** The tracklist index entry: 2–4 words after the dotted leader ("iOS app, live"). */
    tag: z
      .string()
      .max(24)
      .refine((s) => {
        const words = s.trim().split(/\s+/).length;
        return words >= 2 && words <= 4;
      }, 'tag must be 2–4 words'),
    /** Playful "track length" next to the reel title. Decorative, not a metric. */
    length: z.string().regex(/^\d{1,2}:[0-5]\d$/),
    /** The project's record label in the reel (ProjectLabel.astro): ink is the keyline and the name, accent/accent2 the color plate. ink on bg is in `npm run contrast`. */
    label: z.object({
      bg: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      ink: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accent2: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      /** The signature illustration in the label's top half (drawn in ProjectLabel.astro). */
      art: z.enum(['heart-bubbles', 'football-chart', 'track-switch', 'key-bolt']),
    }),
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
      Where the project's reel card goes when clicked (new tab): the one place it's live.
      `name` completes "Visit ___ (opens in a new tab)", the card's accessible name.
    */
    link: z.object({
      url: z.url(),
      name: z.string().min(3),
    }),
    /**
      Demo video for the reel (Stage 3). Paths under public/. Until a project has one, the reel
      shows a static card: the name and where it's live (the whole card links there). The poster frame is required, so a
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
