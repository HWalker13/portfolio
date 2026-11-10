import { describe, expect, it } from 'vitest';
import { stripHtmlComments } from './strip-html-comments.mjs';

describe('stripHtmlComments', () => {
  it('removes single- and multi-line comments, including a whole hidden section', () => {
    const html = `<p>a</p><!-- DRAFT: Holden to edit --><p>b</p><!--\nTODO(Holden): hidden\n## What I'd do differently\nDRAFT: Holden to edit\nplaceholder\n--><nav>n</nav>`;
    const { html: out, removed } = stripHtmlComments(html);
    expect(out).toBe('<p>a</p><p>b</p><nav>n</nav>');
    expect(removed).toBe(2);
  });

  it('leaves <script>, <style>, <pre> and <textarea> contents untouched', () => {
    const html = `<script>const s = "<!-- not a comment -->";</script><style>/* <!-- x --> */</style><pre><!-- shown as code --></pre><textarea><!-- typed --></textarea><!-- gone -->`;
    const { html: out, removed } = stripHtmlComments(html);
    expect(out).toBe(html.replace('<!-- gone -->', ''));
    expect(removed).toBe(1);
  });

  it('keeps the doctype and JSON-LD', () => {
    const html = `<!doctype html><script type="application/ld+json">{"name":"x"}</script>`;
    expect(stripHtmlComments(html).html).toBe(html);
  });
});
