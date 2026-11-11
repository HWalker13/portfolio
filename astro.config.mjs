// @ts-check
import { defineConfig } from 'astro/config';
import stripHtmlComments from './integrations/strip-html-comments.mjs';

export default defineConfig({
  // Production URL (Vercel). Canonical, Open Graph and sitemap URLs are built from this.
  site: 'https://holden-anderson.vercel.app',
  output: 'static',
  // Working notes (DRAFT/TODO comments, hidden sections) stay in source but never ship.
  integrations: [stripHtmlComments()],
  /*
    Inline all CSS into each page. Lighthouse (mobile) measured the two external stylesheets
    as ~1.2s of render blocking before the hero text could paint. The whole site's CSS is
    ~12 KB gzipped, so one fewer round trip beats a separately cached file.
  */
  build: { inlineStylesheets: 'always' },
});
