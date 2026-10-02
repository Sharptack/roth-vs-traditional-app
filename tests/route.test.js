import { describe, it, expect } from 'vitest';
import { ARTICLE_HASH, CALCULATOR_HASH, NEXT_HASH, NEXT_PAGES, SCENARIOS_HASH, articleHash, articleSectionFromHash, headingSlug, nextPageFromHash, routeFromHash } from '../src/lib/route.js';

describe('routeFromHash', () => {
  it('shows the article only for the how-it-works hash', () => {
    expect(routeFromHash(ARTICLE_HASH)).toBe('article');
    expect(routeFromHash('#/how-it-works')).toBe('article');
  });
  it('shows the scenario charts only for the scenarios hash', () => {
    expect(routeFromHash(SCENARIOS_HASH)).toBe('scenarios');
    expect(routeFromHash('#/scenarios')).toBe('scenarios');
  });
  it('opens the article at a heading for "#/how-it-works/<slug>"', () => {
    expect(headingSlug('Why maxing out changes the math')).toBe('why-maxing-out-changes-the-math');
    expect(headingSlug("What this calculator doesn't capture")).toBe('what-this-calculator-doesnt-capture');
    expect(articleHash('limit')).toBe('#/how-it-works/why-maxing-out-changes-the-math');
    expect(routeFromHash(articleHash('limit'))).toBe('article');
    expect(articleSectionFromHash(articleHash('limit'))).toBe('why-maxing-out-changes-the-math');
    expect(articleSectionFromHash(ARTICLE_HASH)).toBe(null);
    expect(articleSectionFromHash('#/how-it-works/')).toBe(null);
    expect(articleSectionFromHash('#/how-it-works/Not A Slug')).toBe(null);
    expect(routeFromHash('#/how-it-works/Not A Slug')).toBe('calculator');
    // the removed test page's address is just the calculator now
    expect(routeFromHash('#/old-vs-new')).toBe('calculator');
  });
  it('shows the preview for its hash and any page under it', () => {
    expect(routeFromHash(NEXT_HASH)).toBe('next');
    expect(routeFromHash('#/next')).toBe('next');
    expect(routeFromHash('#/next/tax')).toBe('next');
    expect(routeFromHash('#next')).toBe('next');
    expect(routeFromHash('#/nextish')).toBe('calculator');
  });
  it('picks the preview page: home, or a calculator', () => {
    expect(nextPageFromHash(NEXT_HASH)).toBe('home');
    expect(nextPageFromHash('#next')).toBe('home');
    expect(nextPageFromHash(NEXT_PAGES.roth)).toBe('roth');
    expect(nextPageFromHash('#/next/tax')).toBe('tax');
    expect(nextPageFromHash('#/next/nope')).toBe('home');
    expect(routeFromHash(NEXT_PAGES.tax)).toBe('next');
  });
  it('shows the calculator for the empty hash, the home hash, and anything unknown', () => {
    expect(routeFromHash('')).toBe('calculator');
    expect(routeFromHash(CALCULATOR_HASH)).toBe('calculator');
    expect(routeFromHash('#')).toBe('calculator');
    expect(routeFromHash('#/nope')).toBe('calculator');
    expect(routeFromHash('#/scenarios/extra')).toBe('calculator');
  });
});
