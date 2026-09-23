import { describe, it, expect } from 'vitest';
import { ARTICLE_HASH, CALCULATOR_HASH, SCENARIOS_HASH, routeFromHash } from '../src/lib/route.js';

describe('routeFromHash', () => {
  it('shows the article only for the how-it-works hash', () => {
    expect(routeFromHash(ARTICLE_HASH)).toBe('article');
    expect(routeFromHash('#/how-it-works')).toBe('article');
  });
  it('shows the scenario charts only for the scenarios hash', () => {
    expect(routeFromHash(SCENARIOS_HASH)).toBe('scenarios');
    expect(routeFromHash('#/scenarios')).toBe('scenarios');
  });
  it('shows the calculator for the empty hash, the home hash, and anything unknown', () => {
    expect(routeFromHash('')).toBe('calculator');
    expect(routeFromHash(CALCULATOR_HASH)).toBe('calculator');
    expect(routeFromHash('#')).toBe('calculator');
    expect(routeFromHash('#/nope')).toBe('calculator');
    expect(routeFromHash('#/how-it-works/extra')).toBe('calculator');
    expect(routeFromHash('#/scenarios/extra')).toBe('calculator');
  });
});
