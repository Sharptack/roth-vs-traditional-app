// The Docs section (#/docs): an index of the articles, and each article rendered from its markdown
// file in articles/ (lib/docs.js lists them). Loaded on demand, like the article page.
import { useEffect } from 'react';
import { DOCS_ARTICLES, DOCS_HASH, OTHER_ARTICLES, docsArticle, docsHash, docsLocation } from '../lib/docs.js';
import { markdownToHtml } from '../lib/markdown.js';
import { NEXT_HASH } from '../lib/route.js';

// Every articles/*.md file, as text, by slug ("articles/inputs.md" -> "inputs").
const FILES = import.meta.glob('../../articles/*.md', { query: '?raw', import: 'default', eager: true });
const MARKDOWN = Object.fromEntries(Object.entries(FILES).map(([path, text]) => [path.split('/').pop().replace(/\.md$/, ''), text]));
const HTML = Object.fromEntries(Object.entries(MARKDOWN).map(([slug, text]) => [slug, markdownToHtml(text)]));

function useTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function DocsIndex() {
  useTitle('Docs — Roth vs. Pre-Tax Calculator');
  return (
    <>
      <a className="back-link" href={NEXT_HASH}>
        &larr; Back to the calculators
      </a>
      <div className="article">
        <h1>Docs</h1>
        <p>How each calculator works and how to use it, one article per feature.</p>
        <ul className="docs-index">
          {DOCS_ARTICLES.map((a) => (
            <li key={a.slug}>
              <a href={docsHash(a.slug)}>{a.title}</a>
              <span className="dim"> {a.blurb}</span>
            </li>
          ))}
          {OTHER_ARTICLES.map((a) => (
            <li key={a.href}>
              <a href={a.href}>{a.title}</a>
              <span className="dim"> {a.blurb}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function DocsArticle({ slug }) {
  const article = docsArticle(slug);
  useTitle(`${article?.title ?? 'Not found'} — Docs`);
  const back = (
    <a className="back-link" href={DOCS_HASH}>
      &larr; All docs
    </a>
  );
  if (!article || !HTML[slug]) {
    return (
      <>
        {back}
        <div className="article">
          <h1>Not found</h1>
          <p>There is no article at this address.</p>
        </div>
      </>
    );
  }
  return (
    <>
      {back}
      <div className="article" dangerouslySetInnerHTML={{ __html: HTML[slug] }} />
      {back}
    </>
  );
}

// hash: the page's address ("#/docs", "#/docs/<article>", "#/docs/<article>/<heading>"; App.jsx
// scrolls to the heading).
export default function DocsPage({ hash }) {
  const where = docsLocation(hash) ?? { article: null };
  return <article className="article-page docs-page">{where.article ? <DocsArticle slug={where.article} /> : <DocsIndex />}</article>;
}
