// Tiny hash-based routing. The site is static (no server rules), so pages live behind
// the URL hash: "#/how-it-works" is the article, anything else is the calculator.
// Hash routes work from any URL or sub-path with no host configuration.
export const ARTICLE_HASH = '#/how-it-works';
export const CALCULATOR_HASH = '#/';

export function routeFromHash(hash) {
  return hash === ARTICLE_HASH ? 'article' : 'calculator';
}
