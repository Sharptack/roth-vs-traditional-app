import { describe, it, expect } from 'vitest';
import { conversionLifetime, conversionTotals } from '../src/lib/conversionLifetime.js';

const Y = 2026;
// A one-person retired household (as tests/projection.test.js): no Social Security, no age
// deductions, return 0, heirs taxed at 24%.
function retiree({ age, pretax = 0, roth = 0 }) {
  return {
    version: 1,
    year: Y,
    filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - age, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a2', owner: 'p1', type: 'roth', balance: roth },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: { projection: { endAge: 70, heirTaxRate: 0.24, strategy: 'proportional' } },
    assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false },
  };
}

describe('the conversion over a lifetime (HAND CALC)', () => {
  it('one year: more tax now, a larger legacy after the heirs\' tax', () => {
    // age 70, $200,000 Pre-tax, need $30,000, one year (tests/projection.test.js works both runs):
    //   without: withdraw 31,613.6364, tax 1,613.6364; Pre-tax left 168,386.3636
    //            after the heirs' 24%: 168,386.3636 x 0.76 = 127,973.6364
    //   with $20,000 converted (decided 2026-10-12: no taxable account, so its tax is held back from it):
    //            withdraw 31,613.6364 (spending only), tax 1,613.6364 + 12% x 20,000 = 4,013.6364;
    //            Pre-tax 148,386.3636, Roth 20,000 - 2,400 = 17,600; legacy 165,986.3636;
    //            after the heirs' tax 148,386.3636 x 0.76 + 17,600 = 130,373.6364
    //   difference: tax +2,400, legacy -2,400, after the heirs' tax +2,400
    //   (the $20,000 is taxed at 12% now instead of the heirs' 24%)
    const r = conversionLifetime(retiree({ age: 70, pretax: 200000 }), 30000, 20000);
    expect(r.without.totals.lifetimeTax).toBeCloseTo(1613.6364, 3);
    expect(r.with.totals.lifetimeTax).toBeCloseTo(4013.6364, 3);
    expect(r.without.totals.legacy).toBeCloseTo(168386.3636, 3);
    expect(r.with.totals.legacy).toBeCloseTo(165986.3636, 3);
    expect(r.without.totals.legacyAfterTax).toBeCloseTo(127973.6364, 3);
    expect(r.with.totals.legacyAfterTax).toBeCloseTo(130373.6364, 3);
    expect(r.difference.lifetimeTax).toBeCloseTo(2400, 3);
    expect(r.difference.legacyAfterTax).toBeCloseTo(2400, 3);
    // retirement income: everything withdrawn (no other income here; a conversion is not income)
    expect(r.without.totals.retirementIncome).toBeCloseTo(31613.6364, 3);
    expect(r.with.totals.retirementIncome).toBeCloseTo(31613.6364, 3);
    expect(r.years).toEqual([{ year: 2026, ages: [70], without: expect.closeTo(1613.6364, 3), with: expect.closeTo(4013.6364, 3) }]);
  });

  it('the totals add up the rows: income tax and IRMAA every year; income only in retirement years', () => {
    const row = (o) => ({ incomeTax: 0, irmaa: 0, working: [false], alive: [true], withdrawals: { total: 0 }, socialSecurity: 0, pension: 0, otherIncome: 0, wages: 0, endBalances: { pretax: 0, roth: 0, taxable: 0, total: 0 }, ...o });
    const t = conversionTotals(
      [
        row({ incomeTax: 9000, working: [true], wages: 100000, withdrawals: { total: 5000 } }), // working: no retirement income
        row({ incomeTax: 3000, irmaa: 1000, withdrawals: { total: 40000 }, socialSecurity: 20000, pension: 6000, otherIncome: 1000 }),
        row({ incomeTax: 2000, withdrawals: { total: 30000 }, socialSecurity: 20000, endBalances: { pretax: 100000, roth: 50000, taxable: 10000, total: 160000 } }),
      ],
      0.2,
    );
    expect(t).toEqual({ incomeTax: 14000, irmaa: 1000, lifetimeTax: 15000, legacy: 160000, legacyAfterTax: 140000, retirementIncome: 117000 });
  });
});
