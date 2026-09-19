import { describe, it, expect } from 'vitest';
import { futureValueAnnuity, futureValueLumpSum } from '../src/lib/growthCalculations.js';

describe('futureValueLumpSum', () => {
  it('$100 at 10% for 2 years = $121 (HAND CALC)', () => {
    expect(futureValueLumpSum(100, 0.1, 2)).toBeCloseTo(121, 8);
  });
  it('$1,000 at 7% for 10 years ≈ $1,967.15', () => {
    expect(futureValueLumpSum(1000, 0.07, 10)).toBeCloseTo(1967.15, 2);
  });
  it('0 years or 0% leaves the amount unchanged', () => {
    expect(futureValueLumpSum(500, 0.07, 0)).toBe(500);
    expect(futureValueLumpSum(500, 0, 30)).toBe(500);
  });
});

describe('futureValueAnnuity (end-of-year payments)', () => {
  it('$100/yr at 10% for 3 years = $331 (HAND CALC by explicit compounding)', () => {
    // 100 x 1.1^2 + 100 x 1.1 + 100 = 121 + 110 + 100
    expect(futureValueAnnuity(100, 0.1, 3)).toBeCloseTo(331, 8);
  });
  it('$1,000/yr at 7% for 10 years ≈ $13,816.45', () => {
    expect(futureValueAnnuity(1000, 0.07, 10)).toBeCloseTo(13816.45, 2);
  });
  it('a 0% return is just payment x years (no divide-by-zero)', () => {
    expect(futureValueAnnuity(2000, 0, 5)).toBe(10000);
  });
  it('0 years is 0', () => {
    expect(futureValueAnnuity(1000, 0.07, 0)).toBe(0);
  });
});
