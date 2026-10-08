import { describe, it, expect } from 'vitest';
import { pensionIncomeAt, pensionIncomeInYear } from '../src/lib/pensionIncome.js';

describe('pensionIncomeAt (HAND CALC, today\'s dollars)', () => {
  it('a pension starting in five years, no COLA, 2.5% inflation', () => {
    // 2,000 a month from 65, owner 60 now: 24,000 a year when it starts.
    // 1.025^5 = 1.131408212890625 -> at 65: 24,000 / 1.131408 = 21,212.50
    // at 67: two more years at no COLA -> 21,212.50 / 1.025^2 (1.050625) = 20,190.36
    const pension = { monthly: 2000, startAge: 65, cola: 0 };
    expect(pensionIncomeAt(pension, { ageNow: 60, age: 64, inflation: 0.025 })).toBe(0);
    expect(pensionIncomeAt(pension, { ageNow: 60, age: 65, inflation: 0.025 })).toBeCloseTo(21212.5, 1);
    expect(pensionIncomeAt(pension, { ageNow: 60, age: 67, inflation: 0.025 })).toBeCloseTo(20190.36, 1);
  });

  it('already being paid: what is paid now, then the COLA net of inflation', () => {
    // 1,500 a month now at 70 (started at 62): 18,000 this year.
    // a 2.5% COLA matches 2.5% inflation, so it stays 18,000 in today's dollars
    expect(pensionIncomeAt({ monthly: 1500, startAge: 62, cola: 0.025 }, { ageNow: 70, age: 70, inflation: 0.025 })).toBeCloseTo(18000, 8);
    expect(pensionIncomeAt({ monthly: 1500, startAge: 62, cola: 0.025 }, { ageNow: 70, age: 80, inflation: 0.025 })).toBeCloseTo(18000, 8);
    // a 1% COLA with no inflation: 18,000 x 1.01^3 = 18,545.418 at 73
    expect(pensionIncomeAt({ monthly: 1500, startAge: 62, cola: 0.01 }, { ageNow: 70, age: 73, inflation: 0 })).toBeCloseTo(18545.418, 3);
  });

  it('nothing without a monthly amount', () => {
    expect(pensionIncomeAt({ monthly: 0, startAge: 60 }, { ageNow: 65, age: 65 })).toBe(0);
  });
});

describe('pensionIncomeInYear', () => {
  it('adds each owner\'s pension at their own age', () => {
    // you 60 with 2,000 from 65 (no inflation: 24,000 from year 5); spouse 64 with 1,000 from 65
    // (12,000 from year 1). Year 0: 0; year 1: 12,000; year 5: 36,000.
    const household = {
      year: 2026,
      people: [{ id: 'p1', birthYear: 1966 }, { id: 'p2', birthYear: 1962 }],
      pensions: [
        { owner: 'p1', monthly: 2000, startAge: 65, cola: 0 },
        { owner: 'p2', monthly: 1000, startAge: 65, cola: 0 },
      ],
      assumptions: { inflationRate: 0 },
    };
    expect(pensionIncomeInYear(household, 0)).toBe(0);
    expect(pensionIncomeInYear(household, 1)).toBe(12000);
    expect(pensionIncomeInYear(household, 5)).toBe(36000);
    expect(pensionIncomeInYear({ ...household, pensions: undefined }, 5)).toBe(0);
  });
});
