import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTICLE_SECTIONS, HOME_HASH, PAGES, SCENARIOS_HASH, articleHash, canonicalHash, headingSlug, pageFromHash, routeFromHash } from '../src/lib/route.js';
import { headingSlugs } from '../src/lib/markdown.js';

describe('routing', () => {
  it('the calculators are the site: home, the inputs page and each calculator', () => {
    for (const h of ['', '#', HOME_HASH, '#/nope', ...Object.values(PAGES)]) expect(routeFromHash(h), h).toBe('app');
    expect(pageFromHash(HOME_HASH)).toBe('home');
    expect(pageFromHash('#/roth')).toBe('roth');
    expect(pageFromHash('#/inputs')).toBe('inputs');
    expect(pageFromHash('#/nope')).toBe('home');
  });

  it('the Docs and the Visualization page', () => {
    expect(routeFromHash('#/docs')).toBe('docs');
    expect(routeFromHash('#/docs/roth/why-maxing-out-changes-the-math')).toBe('docs');
    expect(routeFromHash(SCENARIOS_HASH)).toBe('scenarios');
    expect(routeFromHash('#/scenarios/extra')).toBe('app');
  });

  it('older links open where they belong now', () => {
    // the preview's addresses, before the switchover
    expect(canonicalHash('#/next')).toBe('#/');
    expect(canonicalHash('#next')).toBe('#/');
    expect(canonicalHash('#/next/tax')).toBe('#/tax');
    expect(canonicalHash('#/next/inputs')).toBe('#/inputs');
    // the old calculator's article, at its headings too
    expect(canonicalHash('#/how-it-works')).toBe('#/docs/roth');
    expect(canonicalHash('#/how-it-works/why-maxing-out-changes-the-math')).toBe('#/docs/roth/why-maxing-out-changes-the-math');
    // current addresses stay as they are
    for (const h of ['#/', '#/roth', '#/docs/rates', '#/scenarios', '']) expect(canonicalHash(h)).toBe(h);
  });

  it('links into the Roth article point at headings it really has', () => {
    expect(headingSlug('Why maxing out changes the math')).toBe('why-maxing-out-changes-the-math');
    expect(headingSlug("What this calculator doesn't capture")).toBe('what-this-calculator-doesnt-capture');
    expect(articleHash('limit')).toBe('#/docs/roth/why-maxing-out-changes-the-math');
    const slugs = headingSlugs(readFileSync(join(import.meta.dirname, '..', 'articles', 'roth.md'), 'utf8'));
    for (const heading of Object.values(ARTICLE_SECTIONS)) expect(slugs).toContain(headingSlug(heading));
  });
});
