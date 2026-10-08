// Markdown -> HTML for the Docs section's articles (articles/*.md). Every
// heading gets an id (its slug, route.js headingSlug), so a page can link straight to a section.
// The articles are our own trusted content from the repo, not user input.
import { Marked } from 'marked';
import { headingSlug } from './route.js';

const marked = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${headingSlug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

export function markdownToHtml(markdown) {
  return marked.parse(markdown, { gfm: true, async: false });
}

// The markdown's headings (any level) as slugs, for checking links into an article.
export function headingSlugs(markdown) {
  return [...markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => headingSlug(m[1]));
}
