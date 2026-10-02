import { describe, it, expect } from 'vitest';
import { conversionResult } from '../src/lib/conversionCalculator.js';

const Y = 2026; // single: deduction 16,100; 10% to 12,400, 12% to 50,400, 22% to 105,700
const single = (income) => ({ filingStatus: 'single', year: Y, people: [], income });

describe('conversionResult (2026, HAND CALC)', () => {
  it('a $30,000 pension, converting $20,000: all of it in the 12% bracket', () => {
    // without: taxable 13,900 -> 1,240 + 12% x 1,500 = 1,420
    // with:    taxable 33,900 -> 1,240 + 12% x 21,500 (2,580) = 3,820;  cost 2,400 = 12.0%
    const c = conversionResult(single({ ordinaryIncome: 30000 }), 20000);
    expect(c.before.incomeTax).toBeCloseTo(1420, 6);
    expect(c.after.incomeTax).toBeCloseTo(3820, 6);
    expect(c.cost).toBeCloseTo(2400, 6);
    expect(c.rate).toBeCloseTo(0.12, 10);
    expect(c.parts).toEqual({ ordinaryTax: expect.closeTo(2400, 6), capitalGainsTax: 0, niit: 0 });
    expect(c.extraTaxableSocialSecurity).toBe(0);
  });

  it('what fills each bracket from there', () => {
    // to the top of 12%: 50,400 - 13,900 = 36,500, costing 5,800 - 1,420 = 4,380 (12%)
    // to the top of 22%: 105,700 - 13,900 = 91,800; tax 5,800 + 22% x 55,300 (12,166) = 17,966,
    //   costing 16,546 (18.02%)
    const c = conversionResult(single({ ordinaryIncome: 30000 }), 20000);
    expect(c.fills[0].rate).toBe(0.12);
    expect(c.fills[0].amount).toBeCloseTo(36500, 2);
    expect(c.fills[0].cost).toBeCloseTo(4380, 2);
    expect(c.fills[1].rate).toBe(0.22);
    expect(c.fills[1].amount).toBeCloseTo(91800, 2);
    expect(c.fills[1].cost).toBeCloseTo(16546, 2);
    expect(c.fills[1].costRate).toBeCloseTo(16546 / 91800, 6);
  });

  it('with Social Security in its phase-in, a conversion costs more than the bracket rate', () => {
    // SS 30,000 + 20,000 Pre-tax withdrawals: taxable SS 5,350, tax 925 (yearTax.test.js).
    // Convert 10,000: combined income 45,000 -> 4,500 + 0.85 x 11,000 (9,350) = 13,850 taxable SS
    // ordinary 43,850; taxable 27,750 -> 1,240 + 12% x 15,350 (1,842) = 3,082
    // cost 3,082 - 925 = 2,157 = 21.57% on $10,000, though every dollar sits in the 10-12% brackets
    const c = conversionResult(single({ ordinaryIncome: 20000, socialSecurity: 30000 }), 10000);
    expect(c.extraTaxableSocialSecurity).toBeCloseTo(8500, 6);
    expect(c.cost).toBeCloseTo(2157, 6);
    expect(c.rate).toBeCloseTo(0.2157, 10);
    expect(c.after.ordinaryBracketRate).toBe(0.12);
  });

  it('a conversion can push existing gains from 0% into 15%', () => {
    // pension 30,000 + gains 20,000: gains stack 13,900 -> 33,900, all at 0% (top 49,450).
    // Convert 20,000: ordinary taxable 33,900, gains stack 33,900 -> 53,900: 4,450 above 49,450
    //   at 15% = 667.50. Ordinary tax + 2,400. Cost 3,067.50 = 15.34%
    const c = conversionResult(single({ ordinaryIncome: 30000, preferentialIncome: 20000 }), 20000);
    expect(c.parts.capitalGainsTax).toBeCloseTo(667.5, 6);
    expect(c.parts.ordinaryTax).toBeCloseTo(2400, 6);
    expect(c.cost).toBeCloseTo(3067.5, 6);
  });

  it('the bar marks the conversion\'s own part of each bracket', () => {
    // 13,900 before -> 33,900 after: 10% full, none of it added; 12% holds 1,500 before and 21,500 after
    const c = conversionResult(single({ ordinaryIncome: 30000 }), 20000);
    expect(c.bar.segments.slice(0, 2).map((s) => [s.rate, s.filled, s.added])).toEqual([
      [0.1, 12400, 0],
      [0.12, 21500, 20000],
    ]);
  });

  it('nothing converted costs nothing', () => {
    const c = conversionResult(single({ ordinaryIncome: 30000 }), 0);
    expect(c.cost).toBe(0);
    expect(c.rate).toBe(0);
  });
});

describe('the conversion calculator in the household', () => {
  it('uses this year\'s household tax picture, and its tile shows the cost', async () => {
    const { PREVIEW_DEFAULT_VALUES, toHousehold } = await import('../src/lib/household.js');
    const { householdToYearTaxParams } = await import('../src/lib/taxCalculator.js');
    const { conversionTile } = await import('../src/lib/suiteTiles.js');
    // the default household: taxable 73,900, in the 22% bracket with 31,800 of room.
    // convert 50,000: 31,800 at 22% (6,996) + 18,200 at 24% (4,368) = 11,364 = 22.7%
    const h = toHousehold({ ...PREVIEW_DEFAULT_VALUES, convAmount: '50,000' }, 2026);
    const c = conversionResult(householdToYearTaxParams(h), h.calculators.conversion.amount);
    expect(c.cost).toBeCloseTo(11364, 6);
    expect(conversionTile(c)).toEqual({ headline: '$11,364 tax (22.7%)', detail: 'on converting $50,000 to Roth this year' });
    expect(c.fills[0].amount).toBeCloseTo(31800, 2);
  });
});
