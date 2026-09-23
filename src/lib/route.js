// Tiny hash-based routing. The site is static (no server rules), so pages live behind
// the URL hash: "#/how-it-works" is the article, "#/scenarios" is the scenario
// charts, anything else is the calculator. Hash routes work from any URL or
// sub-path with no host configuration.
export const ARTICLE_HASH = '#/how-it-works';
export const SCENARIOS_HASH = '#/scenarios';
export const CALCULATOR_HASH = '#/';

export function routeFromHash(hash) {
  if (hash === ARTICLE_HASH) return 'article';
  if (hash === SCENARIOS_HASH) return 'scenarios';
  return 'calculator';
}
