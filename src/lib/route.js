// Tiny hash-based routing. The site is static (no server rules), so pages live behind the URL
// hash, which works from any URL or sub-path with no host configuration.
//
//   #/                 the homepage: the household in brief and a tile per calculator
//   #/inputs           the inputs page
//   #/roth, #/tax, #/projection, #/conversion, #/pension   the calculators
//   #/docs[/<article>[/<heading>]]   the Docs section (lib/docs.js)
//   #/scenarios        the Visualization page
//
// Older addresses still open (canonicalHash): the preview's "#/next/..." pages (round 2 until the
// switchover), and the old calculator's article, "#/how-it-works[/<heading>]", now the Roth article
// in the Docs.
export const HOME_HASH = '#/';
export const SCENARIOS_HASH = '#/scenarios';
export const DOCS_HASH = '#/docs';

export const PAGES = {
  inputs: '#/inputs',
  roth: '#/roth',
  tax: '#/tax',
  projection: '#/projection',
  conversion: '#/conversion',
  pension: '#/pension',
};

// The Roth article's sections the Roth page links to, by their heading in articles/roth.md (a test
// checks each one is still a heading there).
export const ROTH_ARTICLE = 'roth';
export const ARTICLE_SECTIONS = {
  rates: 'Tax saved now, effective rate later',
  estimate: 'How the calculator estimates your retirement tax rate',
  socialSecurity: 'The Social Security phase-in',
  withoutSocialSecurity: 'Years without Social Security',
  limit: 'Why maxing out changes the math',
  existing: 'Why your Existing Accounts matter',
};

// "Why maxing out changes the math" -> "why-maxing-out-changes-the-math": the id an article page
// gives each heading.
export function headingSlug(text) {
  return text
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// A link to one of the Roth article's sections: "#/docs/roth/<slug of the heading>".
export function articleHash(section) {
  return `${DOCS_HASH}/${ROTH_ARTICLE}/${headingSlug(ARTICLE_SECTIONS[section])}`;
}

// The address an older link should open at, or the same hash when it's current.
//   #/next, #next          -> #/
//   #/next/<page>          -> #/<page>
//   #/how-it-works[/<h>]   -> #/docs/roth[/<h>]
export function canonicalHash(hash) {
  if (hash === '#/next' || hash === '#next' || hash === '#/next/') return HOME_HASH;
  if (hash.startsWith('#/next/')) return `#/${hash.slice('#/next/'.length)}`;
  if (hash === '#/how-it-works' || hash === '#/how-it-works/') return `${DOCS_HASH}/${ROTH_ARTICLE}`;
  if (hash.startsWith('#/how-it-works/')) return `${DOCS_HASH}/${ROTH_ARTICLE}/${hash.slice('#/how-it-works/'.length)}`;
  return hash;
}

// 'docs', 'scenarios', or 'app' (the calculators: the homepage, the inputs page, a calculator).
export function routeFromHash(hash) {
  if (hash === DOCS_HASH || hash.startsWith(`${DOCS_HASH}/`)) return 'docs';
  if (hash === SCENARIOS_HASH) return 'scenarios';
  return 'app';
}

// Which app page: 'inputs', a calculator id, or 'home' (anything else).
export function pageFromHash(hash) {
  const found = Object.entries(PAGES).find(([, h]) => h === hash);
  return found ? found[0] : 'home';
}
