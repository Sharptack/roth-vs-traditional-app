import { describe, it, expect } from 'vitest';
import { linearScale, niceTicks } from '../src/lib/chartScale.js';

describe('linearScale', () => {
  it('maps a domain onto a range (HAND CALC: midpoint of [0,10] -> midpoint of [0,100])', () => {
    const scale = linearScale([0, 10], [0, 100]);
    expect(scale(0)).toBe(0);
    expect(scale(10)).toBe(100);
    expect(scale(5)).toBe(50);
  });

  it('handles a reversed range (SVG y grows downward: domain min -> larger pixel value)', () => {
    const scale = linearScale([0, 10], [200, 0]);
    expect(scale(0)).toBe(200);
    expect(scale(10)).toBe(0);
    expect(scale(5)).toBe(100);
  });

  it('does not divide by zero when the domain has no span', () => {
    const scale = linearScale([5, 5], [0, 100]);
    expect(Number.isFinite(scale(5))).toBe(true);
  });
});

describe('niceTicks', () => {
  it('HAND CALC: [0,100] over 5 steps -> step 20 -> 0,20,40,60,80,100', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('HAND CALC: [0,1] over 5 steps -> step 0.2 -> 0,0.2,0.4,0.6,0.8,1', () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('covers the requested domain (ticks bracket min and max)', () => {
    const ticks = niceTicks(3, 87, 5);
    expect(ticks[0]).toBeLessThanOrEqual(3);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(87);
  });

  it('returns a single tick when min equals max', () => {
    expect(niceTicks(4, 4, 5)).toEqual([4]);
  });

  it('handles negative domains (a rate gap that crosses zero)', () => {
    const ticks = niceTicks(-0.05, 0.15, 5);
    expect(ticks[0]).toBeLessThanOrEqual(-0.05);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(0.15);
    expect(ticks).toContain(0);
  });
});
