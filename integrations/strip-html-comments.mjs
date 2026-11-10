/*
  Removes HTML comments from every built page (each .html file under dist/) after `astro build`.

  Why: source files carry working notes as comments (`DRAFT: Holden to edit`, `TODO(Holden)`,
  and whole sections hidden until they're written). Those should stay in the source but never
  ship, because anyone can read them with View Source.

  Only runs on build output; the dev server and the source files keep their comments.
  Leaves <script>, <style>, <pre> and <textarea> contents alone: a "<!--" inside them
  isn't an HTML comment, and stripping it could break the code or text.
*/
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW_BLOCKS = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<pre\b[\s\S]*?<\/pre>|<textarea\b[\s\S]*?<\/textarea>)/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

/** Strip comments outside raw-text blocks. Returns the new HTML and how many comments were removed. */
export function stripHtmlComments(html) {
  let removed = 0;
  const out = html
    .split(RAW_BLOCKS)
    .map((part, i) => {
      if (i % 2 === 1) return part; // a captured raw block: keep as is
      return part.replace(COMMENT, () => {
        removed++;
        return '';
      });
    })
    .join('');
  return { html: out, removed };
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

export default function stripHtmlCommentsIntegration() {
  return {
    name: 'strip-html-comments',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        let files = 0;
        let total = 0;
        for await (const file of htmlFiles(fileURLToPath(dir))) {
          const { html, removed } = stripHtmlComments(await readFile(file, 'utf8'));
          if (removed) await writeFile(file, html);
          files++;
          total += removed;
        }
        logger.info(`removed ${total} HTML comment(s) from ${files} page(s)`);
      },
    },
  };
}
