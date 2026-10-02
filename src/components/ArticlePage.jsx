import { useEffect } from 'react';
import { Marked } from 'marked';
// ARTICLE.md is the single source of truth: the page renders that file, so editing
// the article updates the site (there is no second copy to keep in sync).
import articleMarkdown from '../../ARTICLE.md?raw';
import { CALCULATOR_HASH, headingSlug } from '../lib/route.js';

// Every heading gets an id (its slug), so the calculator can link straight to a section.
const marked = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${headingSlug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

// The article is our own trusted content from the repo, not user input.
const articleHtml = marked.parse(articleMarkdown, { gfm: true, async: false });

function BackLink() {
  return (
    <a className="back-link" href={CALCULATOR_HASH}>
      &larr; Back to the calculator
    </a>
  );
}

export default function ArticlePage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'How this works — Roth vs. Pre-Tax Calculator';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <article className="article-page">
      <BackLink />
      <div className="article" dangerouslySetInnerHTML={{ __html: articleHtml }} />
      <BackLink />
    </article>
  );
}
