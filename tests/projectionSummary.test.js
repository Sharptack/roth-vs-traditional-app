import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';
import { summarizeProjection, sustainableSpending } from '../src/lib/projectionSummary.js';

const Y = 2026;
function retiree({ age, pretax = 0, roth = 0, taxable = 0, basisShare = 0, returnRate = 0 }) {
  return {
    version: 1, year: Y, filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - age, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a2', owner: 'p1', type: 'roth', balance: roth },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: taxable, basisShare },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate, inflationRate: 0, ageDeductions: false },
  };
}

describe('summarizeProjection (HAND CALC)', () => {
  it('the three-year toy case', () => {
    // each year: withdrawal 31,613.64, tax 1,613.64, after-tax 30,000 (see projection.test.js)
    // ending Pre-tax 550,394.75 (10% return) -> after heirs' 24%: 418,300.01
    const rows = runProjection(retiree({ age: 66, pretax: 500000, returnRate: 0.1 }), { need: 30000, endAge: 68 }).rows;
    const s = summarizeProjection(rows);
    expect(s.totalTax).toBeCloseTo(3 * 1613.6364, 2);
    expect(s.retirementAfterTaxIncome).toBeCloseTo(90000, 3);
    expect(s.endingBalance.pretax).toBeCloseTo(550394.75, 2);
    expect(s.endingAfterTax).toBeCloseTo(550394.75 * 0.76, 2);
    expect(s.averageEffectiveRate).toBeCloseTo(1613.6364 / 31613.6364, 8);
    expect(s.moneyLastsTo).toBe(68);
    expect(s.runsOut).toBe(false);
    expect(s.firstRetirementYear).toBe(Y);
  });

  it('when the money runs out: the last age with no shortfall', () => {
    // $50,000, need 30,000, return 0: short in the second year (age 67) -> lasts to 66
    const s = summarizeProjection(runProjection(retiree({ age: 66, pretax: 50000 }), { need: 30000, endAge: 68 }).rows);
    expect(s.runsOut).toBe(true);
    expect(s.moneyLastsTo).toBe(66);
  });

  it('Roth and taxable count in full for heirs (step-up in basis)', () => {
    const rows = runProjection(retiree({ age: 66, roth: 100000, taxable: 100000, basisShare: 0.2 }), { need: 0, endAge: 66 }).rows;
    expect(summarizeProjection(rows).endingAfterTax).toBeCloseTo(200000, 6);
  });
});

describe('sustainableSpending (HAND CALC)', () => {
  it('$500,000 Pre-tax over three years at 0%: 166,666.67 a year withdrawn, 137,932.67 after tax', () => {
    // W = 500,000 / 3 = 166,666.67; taxable 150,566.67:
    //   1,240 + 4,560 + 22% x 55,300 (12,166) + 24% x 44,866.67 (10,768) = 28,734 -> 137,932.67
    const s = sustainableSpending(retiree({ age: 66, pretax: 500000 }), { endAge: 68 });
    expect(s).toBeGreaterThan(137932.67 - 1.01);
    expect(s).toBeLessThanOrEqual(137932.67 + 0.01);
  });
});

describe('projectionView and its tile', () => {
  it('funded status agrees with whether the money lasts at the actual need', async () => {
    const { PREVIEW_DEFAULT_VALUES, toHousehold } = await import('../src/lib/household.js');
    const { projectionView } = await import('../src/lib/projectionSummary.js');
    const { projectionTile } = await import('../src/lib/suiteTiles.js');
    for (const [values, need] of [
      [{}, 60000],
      [{}, 200000],
      [{ projEndAge: '100', projHeirTaxRate: '0.32' }, 80000],
    ]) {
      const h = toHousehold({ ...PREVIEW_DEFAULT_VALUES, ...values }, Y);
      const v = projectionView(h, need);
      expect(v.funded).toBeCloseTo(v.sustainable / need, 12);
      expect(v.summary.runsOut).toBe(v.sustainable < need);
      expect(v.rows[v.rows.length - 1].ages[0]).toBe(Number(values.projEndAge ?? 95));
      expect(v.summary.heirTaxRate).toBe(Number(values.projHeirTaxRate ?? 0.24));
      const tile = projectionTile(v);
      expect(tile.headline).toMatch(v.summary.runsOut ? /^Runs out at (age \d+|\d{4} \(.+\))$/ : /^\d+% funded$/);
    }
  });
});

describe('whenLabel: when a year falls, in words', () => {
  it('one person: their age; a couple: the year and the ages of those living', async () => {
    const { whenLabel } = await import('../src/lib/projectionSummary.js');
    expect(whenLabel({ year: 2061, ages: [95] })).toBe('age 95');
    expect(whenLabel({ year: 2061, ages: [95, 85], alive: [true, true] })).toBe('2061 (you 95, your spouse 85)');
    expect(whenLabel({ year: 2071, ages: [105, 95], alive: [false, true] })).toBe('2071 (your spouse 95)');
    expect(whenLabel({ year: 2071, ages: [95, 105], alive: [true, false] })).toBe('2071 (you 95)');
  });
});
