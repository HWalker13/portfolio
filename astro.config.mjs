// @ts-check
import { defineConfig } from 'astro/config';
import stripHtmlComments from './integrations/strip-html-comments.mjs';

export default defineConfig({
  // Production URL (Vercel). Canonical, Open Graph and sitemap URLs are built from this.
  site: 'https://holden-anderson.vercel.app',
  output: 'static',
  // Working notes (DRAFT/TODO comments, hidden sections) stay in source but never ship.
  integrations: [stripHtmlComments()],
});
