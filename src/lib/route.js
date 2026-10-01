// Tiny hash-based routing. The site is static (no server rules), so pages live behind
// the URL hash: "#/how-it-works" is the article, "#/scenarios" is the scenario
// charts, anything else is the calculator. Hash routes work from any URL or
// sub-path with no host configuration.
export const ARTICLE_HASH = '#/how-it-works';
export const SCENARIOS_HASH = '#/scenarios';
export const CALCULATOR_HASH = '#/';
// TEMPORARY (2026-09-29): the old vs. new calculation test page; goes with result.old.
export const OLD_VS_NEW_HASH = '#/old-vs-new';
// The preview of the next version, built alongside the current calculator until switchover
// (CLAUDE.md, "Build alongside, then switch over"). Its own pages live under it: "#/next/...".
// Rename it here only.
export const NEXT_HASH = '#/next';

export function routeFromHash(hash) {
  if (hash === ARTICLE_HASH) return 'article';
  if (hash === SCENARIOS_HASH) return 'scenarios';
  if (hash === OLD_VS_NEW_HASH) return 'oldVsNew';
  if (hash === NEXT_HASH || hash.startsWith(`${NEXT_HASH}/`)) return 'next';
  return 'calculator';
}
