// Tiny hash-based routing. The site is static (no server rules), so pages live behind
// the URL hash: "#/how-it-works" is the article ("#/how-it-works/<heading>" opens it at
// that heading), "#/scenarios" is the scenario charts, anything else is the calculator.
// Hash routes work from any URL or sub-path with no host configuration.
export const ARTICLE_HASH = '#/how-it-works';
export const SCENARIOS_HASH = '#/scenarios';
export const CALCULATOR_HASH = '#/';
// The preview of the next version, built alongside the current calculator until switchover
// (CLAUDE.md, "Build alongside, then switch over"). Its own pages live under it: "#/next/...".
// Rename it here only.
export const NEXT_HASH = '#/next';
// The preview's pages: its homepage (the household in brief and a tile per calculator), the inputs
// page, and one page per calculator. Unknown sub-pages show the homepage.
export const NEXT_PAGES = {
  inputs: `${NEXT_HASH}/inputs`,
  roth: `${NEXT_HASH}/roth`, tax: `${NEXT_HASH}/tax`, projection: `${NEXT_HASH}/projection`,
  conversion: `${NEXT_HASH}/conversion`,
  pension: `${NEXT_HASH}/pension`,
};

// The article sections the calculator links to, by their heading in ARTICLE.md (a test checks
// each one is still a heading there). A link to one is "#/how-it-works/<slug of the heading>".
export const ARTICLE_SECTIONS = {
  rates: 'Tax saved now, effective rate later',
  estimate: 'How the calculator estimates your retirement tax rate',
  socialSecurity: 'The Social Security phase-in',
  withoutSocialSecurity: 'Years without Social Security',
  limit: 'Why maxing out changes the math',
  existing: 'Why your Existing Accounts matter',
};

// "Why maxing out changes the math" -> "why-maxing-out-changes-the-math": the id the article
// page gives each heading.
export function headingSlug(text) {
  return text
    .toLowerCase()
    .replace(/[\u2019'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function articleHash(section) {
  return `${ARTICLE_HASH}/${headingSlug(ARTICLE_SECTIONS[section])}`;
}

// The heading id a "#/how-it-works/<slug>" link points at, or null.
export function articleSectionFromHash(hash) {
  const prefix = `${ARTICLE_HASH}/`;
  const slug = hash.startsWith(prefix) ? hash.slice(prefix.length) : '';
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

export function nextPageFromHash(hash) {
  const found = Object.entries(NEXT_PAGES).find(([, h]) => h === hash);
  return found ? found[0] : 'home';
}

export function routeFromHash(hash) {
  if (hash === ARTICLE_HASH || articleSectionFromHash(hash)) return 'article';
  if (hash === SCENARIOS_HASH) return 'scenarios';
  // "#next" (no slash) is accepted too, since it is easy to type that way.
  if (hash === NEXT_HASH || hash === '#next' || hash.startsWith(`${NEXT_HASH}/`)) return 'next';
  return 'calculator';
}
