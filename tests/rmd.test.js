import { describe, it, expect } from 'vitest';
import { requiredMinimumDistribution, rmdStartAge, uniformLifetimeDivisor } from '../src/lib/rmd.js';

describe('RMDs (HAND CALC, 26 CFR 1.401(a)(9)-9(c))', () => {
  it('start age by birth year (SECURE 2.0)', () => {
    expect(rmdStartAge(1960)).toBe(75);
    expect(rmdStartAge(1975)).toBe(75);
    expect(rmdStartAge(1959)).toBe(73);
    expect(rmdStartAge(1951)).toBe(73);
    expect(rmdStartAge(1950)).toBe(72);
  });

  it('the plan\'s example: $500,000, turning 75, born 1960 -> 500,000 / 24.6 = 20,325.20', () => {
    const r = requiredMinimumDistribution({ priorYearEndBalance: 500000, age: 75, birthYear: 1960 });
    expect(r.divisor).toBe(24.6);
    expect(r.required).toBeCloseTo(20325.2, 2);
  });

  it('nothing before the start age', () => {
    expect(requiredMinimumDistribution({ priorYearEndBalance: 500000, age: 74, birthYear: 1960 })).toEqual({
      required: 0,
      divisor: null,
      startAge: 75,
    });
  });

  it('born 1955, at 73: 500,000 / 26.5 = 18,867.92; at 90: / 12.2 = 40,983.61', () => {
    expect(requiredMinimumDistribution({ priorYearEndBalance: 500000, age: 73, birthYear: 1955 }).required).toBeCloseTo(18867.92, 2);
    expect(requiredMinimumDistribution({ priorYearEndBalance: 500000, age: 90, birthYear: 1955 }).required).toBeCloseTo(40983.61, 2);
  });

  it('divisors from the table, 120 and over = 2.0', () => {
    expect(uniformLifetimeDivisor(72)).toBe(27.4);
    expect(uniformLifetimeDivisor(95)).toBe(8.9);
    expect(uniformLifetimeDivisor(119)).toBe(2.3);
    expect(uniformLifetimeDivisor(125)).toBe(2.0);
    // the table falls every year
    for (let a = 73; a <= 120; a++) expect(uniformLifetimeDivisor(a)).toBeLessThan(uniformLifetimeDivisor(a - 1));
  });
});
