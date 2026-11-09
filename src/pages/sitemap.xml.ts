import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/** A tiny sitemap, built from the same collection as the pages. No extra integration needed. */
export const GET: APIRoute = async ({ site }) => {
  const projects = await getCollection('projects');
  const paths = ['/', ...projects.map((p) => `/projects/${p.id}/`)];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
