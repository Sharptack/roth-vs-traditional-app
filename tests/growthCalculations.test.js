import { describe, it, expect } from 'vitest';
import { futureValueAnnuity, futureValueContributions, futureValueLumpSum, growTaxable, taxedShareOfWithdrawal } from '../src/lib/growthCalculations.js';

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

describe('growTaxable — tax drag on a taxable account (HAND CALC)', () => {
  it('dividends taxed each year, the rest reinvested as basis', () => {
    // $100,000 all basis, 5% return, 2% dividends taxed at 15%:
    // year 1: dividends 2,000, tax 300 -> 100,000 x 1.05 - 300 = 104,700; basis 101,700
    // year 2: dividends 2,094, tax 314.10 -> 104,700 x 1.05 - 314.10 = 109,620.90; basis 103,479.90
    const r = growTaxable({ start: 100000, years: 2, returnRate: 0.05, dividendYield: 0.02, taxRate: 0.15 });
    expect(r.value).toBeCloseTo(109620.9, 6);
    expect(r.basis).toBeCloseTo(103479.9, 6);
  });

  it('with yearly payments at the end of each year', () => {
    // As above plus $1,000 a year. Year 1: 104,700 + 1,000 = 105,700; basis 102,700.
    // Year 2: dividends 2,114, tax 317.10 -> 105,700 x 1.05 - 317.10 + 1,000 = 111,667.90;
    //   basis 102,700 + 2,114 - 317.10 + 1,000 = 105,496.90
    const r = growTaxable({ start: 100000, payment: 1000, years: 2, returnRate: 0.05, dividendYield: 0.02, taxRate: 0.15 });
    expect(r.value).toBeCloseTo(111667.9, 6);
    expect(r.basis).toBeCloseTo(105496.9, 6);
  });

  it('payments for some years, then untouched growth', () => {
    // $1,000 at the end of year 1 only, 10% return, 4% dividends taxed at 25%:
    // year 1: 0 -> 1,000 (basis 1,000). year 2: dividends 40, tax 10 -> 1,100 - 10 = 1,090; basis 1,030
    const r = growTaxable({ payment: 1000, contributeYears: 1, years: 2, returnRate: 0.1, dividendYield: 0.04, taxRate: 0.25 });
    expect(r.value).toBeCloseTo(1090, 9);
    expect(r.basis).toBeCloseTo(1030, 9);
  });

  it('no dividends: exactly the closed forms', () => {
    const r = growTaxable({ start: 5000, basis: 2000, payment: 1000, contributeYears: 3, years: 5, returnRate: 0.07 });
    expect(r.value).toBe(futureValueLumpSum(5000, 0.07, 5) + futureValueContributions(1000, 0.07, 3, 5));
    expect(r.basis).toBe(2000 + 3000);
  });
});

describe('taxedShareOfWithdrawal (HAND CALC)', () => {
  it('the dividends are taxed whole, the sale on its gain share', () => {
    // 4% withdrawal, 1.3% dividends, gain share 50%: (1.3% + 2.7% x 50%) / 4% = 2.65 / 4 = 0.6625
    expect(taxedShareOfWithdrawal(0.5, 0.013, 0.04)).toBeCloseTo(0.6625, 12);
    expect(taxedShareOfWithdrawal(0.5, 0, 0.04)).toBe(0.5);
    expect(taxedShareOfWithdrawal(0, 0.04, 0.04)).toBe(1);
  });
});
