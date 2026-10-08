// The Docs section (round 2, "throughout"): one article per feature, explaining how the
// calculation works and how to use it. Pure. Each article is a markdown file in articles/
// (articles/<slug>.md), rendered like ARTICLE.md; this list sets their order and index text.
//
//   #/docs                      the index
//   #/docs/<article>            an article
//   #/docs/<article>/<heading>  an article at a heading (the heading's slug, route.js headingSlug)
import { ARTICLE_HASH, DOCS_HASH, headingSlug } from './route.js';

export { DOCS_HASH };

export const DOCS_ARTICLES = [
  {
    slug: 'inputs',
    title: 'The household inputs',
    blurb: 'Every input on the inputs page: what it means, which calculators read it, and how saving and sharing work.',
  },
  {
    slug: 'rates',
    title: 'Tax rates: marginal, effective and average',
    blurb: 'The three rates the calculators use, and what each one means.',
  },
];

// Articles that live elsewhere until the switchover (ARTICLE.md is the Roth vs. Pre-tax article).
export const OTHER_ARTICLES = [
  {
    href: ARTICLE_HASH,
    title: 'Roth vs. Pre-tax: how the current calculator works',
    blurb: 'The reasoning behind the Roth vs. Pre-tax comparison, in plain language.',
  },
];

const SLUG = /^[a-z0-9-]+$/;

// "#/docs/inputs/people" -> { article: 'inputs', section: 'people' }; the index -> { article: null,
// section: null }; null when the hash isn't in the Docs section. An unknown article comes back as
// is (the page says it can't be found).
export function docsLocation(hash) {
  if (hash === DOCS_HASH || hash === `${DOCS_HASH}/`) return { article: null, section: null };
  if (!hash.startsWith(`${DOCS_HASH}/`)) return null;
  const [article, section] = hash.slice(DOCS_HASH.length + 1).split('/');
  return {
    article: SLUG.test(article ?? '') ? article : null,
    section: SLUG.test(section ?? '') ? section : null,
  };
}

// The address of an article, or of one of its headings (by the heading's text).
export function docsHash(article, heading) {
  return heading ? `${DOCS_HASH}/${article}/${headingSlug(heading)}` : `${DOCS_HASH}/${article}`;
}

export const docsArticle = (slug) => DOCS_ARTICLES.find((a) => a.slug === slug) ?? null;
