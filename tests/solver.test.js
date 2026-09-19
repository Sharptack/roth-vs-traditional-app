import { describe, it, expect } from 'vitest';
import { solveMonotonicIncreasing } from '../src/lib/solver.js';

describe('solveMonotonicIncreasing', () => {
  it('finds x for a linear function: f(x) = 2x, target 10 -> 5', () => {
    const { x, bracketed } = solveMonotonicIncreasing((v) => 2 * v, 10);
    expect(bracketed).toBe(true);
    expect(x).toBeCloseTo(5, 8);
  });

  it('finds x well above the initial upper bound: f(x) = x, target 1,000,000', () => {
    expect(solveMonotonicIncreasing((v) => v, 1e6).x).toBeCloseTo(1e6, 4);
  });

  it('handles a kinked piecewise-linear function (HAND CALC)', () => {
    // f = x up to 100, then slope 0.5:  f(x) = 100 + 0.5 (x - 100)
    // target 150 -> 0.5 (x - 100) = 50 -> x = 200
    const f = (v) => (v <= 100 ? v : 100 + 0.5 * (v - 100));
    expect(solveMonotonicIncreasing(f, 150).x).toBeCloseTo(200, 8);
  });

  it('returns lo when the target is already met at lo', () => {
    expect(solveMonotonicIncreasing((v) => v + 50, 10).x).toBe(0);
  });

  it('reports bracketed = false when the target is unreachable', () => {
    const { bracketed } = solveMonotonicIncreasing(() => 5, 10, { maxHi: 1e6 });
    expect(bracketed).toBe(false);
  });
});
