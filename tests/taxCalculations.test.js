import { describe, it, expect } from 'vitest';
import {
  calculateTax,
  calculateTaxFromGross,
  getMarginalRate,
  getStandardDeduction,
} from '../src/lib/taxCalculations.js';
import { getYearData } from '../src/lib/yearLookup.js';

const Y = 2025;

describe('yearLookup', () => {
  const table = { 2023: 'a', 2025: 'b' };
  it('returns the exact year when present', () => {
    expect(getYearData(table, 2025)).toEqual({ year: 2025, data: 'b' });
  });
  it('falls back to the latest earlier year for a year not in the table', () => {
    expect(getYearData(table, 2024)).toEqual({ year: 2023, data: 'a' });
    expect(getYearData(table, 2031)).toEqual({ year: 2025, data: 'b' });
  });
  it('uses the earliest year for a year before all data', () => {
    expect(getYearData(table, 1999)).toEqual({ year: 2023, data: 'a' });
  });
  it('rejects a non-numeric year', () => {
    expect(() => getYearData(table, NaN)).toThrow();
  });
});

describe('getStandardDeduction (2025)', () => {
  it('is $15,750 single and $31,500 MFJ', () => {
    expect(getStandardDeduction('single', Y)).toBe(15750);
    expect(getStandardDeduction('mfj', Y)).toBe(31500);
  });
});

describe('calculateTax — progressive bracket math (hand-computed, 2025)', () => {
  it('is zero for zero or negative taxable income', () => {
    expect(calculateTax(0, 'single', Y)).toBe(0);
    expect(calculateTax(-500, 'single', Y)).toBe(0);
  });

  it('single, $10,000: entirely in the 10% bracket = $1,000', () => {
    expect(calculateTax(10000, 'single', Y)).toBeCloseTo(1000, 6);
  });

  it('single, exactly at the top of the 10% bracket ($11,925) = $1,192.50', () => {
    expect(calculateTax(11925, 'single', Y)).toBeCloseTo(1192.5, 6);
  });

  it('single, $60,000 (HAND CALC)', () => {
    // 10% x 11,925                  = 1,192.50
    // 12% x (48,475 - 11,925=36,550) = 4,386.00
    // 22% x (60,000 - 48,475=11,525) = 2,535.50
    //                          total = 8,114.00
    expect(calculateTax(60000, 'single', Y)).toBeCloseTo(8114.0, 6);
  });

  it('is NOT a flat rate applied to the whole amount', () => {
    const tax = calculateTax(60000, 'single', Y);
    expect(tax).not.toBeCloseTo(60000 * 0.22, 0); // top-bracket rate on everything
    expect(tax / 60000).toBeLessThan(0.22); // blended rate is below the marginal rate
  });

  it('MFJ, $120,000 (HAND CALC)', () => {
    // 10% x 23,850                    = 2,385
    // 12% x (96,950 - 23,850=73,100)  = 8,772
    // 22% x (120,000 - 96,950=23,050) = 5,071
    //                          total = 16,228
    expect(calculateTax(120000, 'mfj', Y)).toBeCloseTo(16228, 6);
  });

  it('single, $700,000 spans all seven brackets (HAND CALC)', () => {
    // 10% x 11,925                    =   1,192.50
    // 12% x 36,550                    =   4,386.00
    // 22% x (103,350-48,475=54,875)   =  12,072.50
    // 24% x (197,300-103,350=93,950)  =  22,548.00
    // 32% x (250,525-197,300=53,225)  =  17,032.00
    // 35% x (626,350-250,525=375,825) = 131,538.75
    // 37% x (700,000-626,350=73,650)  =  27,250.50
    //                          total = 216,020.25
    expect(calculateTax(700000, 'single', Y)).toBeCloseTo(216020.25, 6);
  });

  it('matches the IRS published figure at the 37% threshold ($188,769.75)', () => {
    expect(calculateTax(626350, 'single', Y)).toBeCloseTo(188769.75, 6);
  });

  it('is continuous and increasing across every bracket boundary', () => {
    for (const status of ['single', 'mfj']) {
      let previous = 0;
      for (let income = 0; income <= 900000; income += 250) {
        const tax = calculateTax(income, status, Y);
        expect(tax).toBeGreaterThanOrEqual(previous);
        previous = tax;
      }
    }
  });

  it('rejects an unknown filing status', () => {
    expect(() => calculateTax(50000, 'hoh', Y)).toThrow(/filing status/i);
  });
});

describe('getMarginalRate', () => {
  it('returns the rate of the bracket the NEXT dollar falls in (single)', () => {
    expect(getMarginalRate(0, 'single', Y)).toBe(0.1);
    expect(getMarginalRate(11924, 'single', Y)).toBe(0.1);
    expect(getMarginalRate(11925, 'single', Y)).toBe(0.12); // boundary -> next bracket
    expect(getMarginalRate(48474, 'single', Y)).toBe(0.12);
    expect(getMarginalRate(48475, 'single', Y)).toBe(0.22);
    expect(getMarginalRate(84250, 'single', Y)).toBe(0.22);
    expect(getMarginalRate(1000000, 'single', Y)).toBe(0.37);
  });
  it('uses MFJ brackets for MFJ', () => {
    expect(getMarginalRate(96949, 'mfj', Y)).toBe(0.12);
    expect(getMarginalRate(96950, 'mfj', Y)).toBe(0.22);
  });
  it('is 0 when income is below the standard deduction (negative taxable income)', () => {
    expect(getMarginalRate(-1, 'single', Y)).toBe(0);
  });
});

describe('calculateTaxFromGross', () => {
  it('single, $100,000 gross (HAND CALC)', () => {
    // taxable = 100,000 - 15,750 = 84,250
    // 1,192.50 + 4,386.00 + 22% x (84,250 - 48,475 = 35,775 -> 7,870.50) = 13,449.00
    const r = calculateTaxFromGross(100000, 'single', Y);
    expect(r.standardDeduction).toBe(15750);
    expect(r.taxableIncome).toBe(84250);
    expect(r.tax).toBeCloseTo(13449, 6);
    expect(r.marginalRate).toBe(0.22);
    expect(r.effectiveRate).toBeCloseTo(0.13449, 6);
  });
  it('income under the standard deduction owes nothing and has a 0% marginal rate', () => {
    const r = calculateTaxFromGross(10000, 'single', Y);
    expect(r.taxableIncome).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.marginalRate).toBe(0);
  });
  it('reports which year of data was used when the year is not in the table', () => {
    // 2031 is beyond the data -> newest year on file (2026)
    expect(calculateTaxFromGross(100000, 'single', 2031).dataYear).toBe(2026);
    // 2024 is before the data -> earliest year on file (2025)
    expect(calculateTaxFromGross(100000, 'single', 2024).dataYear).toBe(2025);
  });
});

// 2026 figures from the IRS inflation-adjustment release: standard deduction
// $16,100 / $32,200; single brackets top out at 12,400 / 50,400 / 105,700 /
// 201,775 / 256,225 / 640,600; MFJ at 24,800 / 100,800 / 211,400 / 403,550 /
// 512,450 / 768,700.
describe('2026 tax data (HAND CALC)', () => {
  const Y26 = 2026;

  it('standard deduction is $16,100 single and $32,200 MFJ', () => {
    expect(getStandardDeduction('single', Y26)).toBe(16100);
    expect(getStandardDeduction('mfj', Y26)).toBe(32200);
  });

  it('single, $60,000', () => {
    // 10% x 12,400                    = 1,240.00
    // 12% x (50,400 - 12,400=38,000)  = 4,560.00
    // 22% x (60,000 - 50,400=9,600)   = 2,112.00
    //                          total = 7,912.00
    expect(calculateTax(60000, 'single', Y26)).toBeCloseTo(7912, 6);
  });

  it('MFJ, $120,000', () => {
    // 10% x 24,800                     = 2,480
    // 12% x (100,800 - 24,800=76,000)  = 9,120
    // 22% x (120,000 - 100,800=19,200) = 4,224
    //                           total = 15,824
    expect(calculateTax(120000, 'mfj', Y26)).toBeCloseTo(15824, 6);
  });

  it('single, $700,000 spans all seven brackets', () => {
    // 10% x 12,400                       =   1,240.00
    // 12% x 38,000                       =   4,560.00
    // 22% x (105,700-50,400=55,300)      =  12,166.00
    // 24% x (201,775-105,700=96,075)     =  23,058.00
    // 32% x (256,225-201,775=54,450)     =  17,424.00
    // 35% x (640,600-256,225=384,375)    = 134,531.25
    // 37% x (700,000-640,600=59,400)     =  21,978.00
    //                             total = 214,957.25
    expect(calculateTax(700000, 'single', Y26)).toBeCloseTo(214957.25, 6);
  });

  it('marginal rate changes at the 2026 boundaries', () => {
    expect(getMarginalRate(12399, 'single', Y26)).toBe(0.1);
    expect(getMarginalRate(12400, 'single', Y26)).toBe(0.12);
    expect(getMarginalRate(50399, 'single', Y26)).toBe(0.12);
    expect(getMarginalRate(50400, 'single', Y26)).toBe(0.22);
    expect(getMarginalRate(100799, 'mfj', Y26)).toBe(0.12);
    expect(getMarginalRate(100800, 'mfj', Y26)).toBe(0.22);
  });

  it('single, $100,000 gross', () => {
    // taxable = 100,000 - 16,100 = 83,900
    // 1,240 + 4,560 + 22% x (83,900 - 50,400 = 33,500 -> 7,370) = 13,170
    const r = calculateTaxFromGross(100000, 'single', Y26);
    expect(r.dataYear).toBe(2026);
    expect(r.taxableIncome).toBe(83900);
    expect(r.tax).toBeCloseTo(13170, 6);
    expect(r.marginalRate).toBe(0.22);
  });

  it('keeps 2025 results unchanged when 2025 is requested', () => {
    expect(calculateTax(60000, 'single', 2025)).toBeCloseTo(8114, 6);
  });
});
