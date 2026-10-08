// The Docs section (round 2, "throughout"): one article per feature, explaining how the
// calculation works and how to use it. Pure. Each article is a markdown file in articles/
// (articles/<slug>.md); this list sets their order and index text.
//
//   #/docs                      the index
//   #/docs/<article>            an article
//   #/docs/<article>/<heading>  an article at a heading (the heading's slug, route.js headingSlug)
import { DOCS_HASH, SCENARIOS_HASH, headingSlug } from './route.js';

export { DOCS_HASH };

export const DOCS_ARTICLES = [
  {
    slug: 'inputs',
    title: 'The household inputs',
    blurb: 'Every input on the inputs page: what it means, which calculators read it, and how saving and sharing work.',
  },
  {
    slug: 'roth',
    title: 'Roth vs. Pre-tax: how to think about it, and how the calculator does',
    blurb: 'The reasoning behind the Roth vs. Pre-tax comparison, in plain language.',
  },
  {
    slug: 'tax',
    title: 'The tax calculator',
    blurb: 'This year’s tax line by line, the three rates, and the two buckets: what each shows and how it is worked out.',
  },
  {
    slug: 'pension',
    title: 'The pension calculator',
    blurb: 'Lump sum or monthly: the expected return on life expectancy, survivor benefits, and how long you live.',
  },
  {
    slug: 'rates',
    title: 'Tax rates: marginal, average and effective marginal',
    blurb: 'The marginal rate, the average tax rate and the effective marginal rate (EMTR): what each one means.',
  },
];

// Pages the Docs index links to that aren't articles.
export const OTHER_ARTICLES = [
  {
    href: SCENARIOS_HASH,
    title: 'Visualization: the rate gap across scenarios',
    blurb: 'Charts of the two rates and who comes out ahead, across ranges of income, savings, balances and ages.',
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
