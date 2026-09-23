import { describe, it, expect } from 'vitest';
import { linearRegression } from '../src/lib/regression.js';

describe('linearRegression', () => {
  it('HAND CALC: a perfect line y = 2x through the origin -> slope 2, intercept 0, r2 1', () => {
    const r = linearRegression([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]);
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(0, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('HAND CALC: y = -x + 10 -> slope -1, intercept 10, r2 1 (a negative gap-to-advantage relationship)', () => {
    const r = linearRegression([
      { x: 0, y: 10 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
    ]);
    expect(r.slope).toBeCloseTo(-1, 10);
    expect(r.intercept).toBeCloseTo(10, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('HAND CALC: flat data (no relationship) -> slope 0, intercept = the mean, r2 0', () => {
    const r = linearRegression([
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ]);
    expect(r.slope).toBeCloseTo(0, 10);
    expect(r.intercept).toBeCloseTo(5, 10);
    expect(r.r2).toBe(0);
  });

  it('returns null for no points, and handles a single vertical-domain point without throwing', () => {
    expect(linearRegression([])).toBeNull();
    const single = linearRegression([{ x: 3, y: 7 }]);
    expect(single.intercept).toBeCloseTo(7, 10);
  });
});
