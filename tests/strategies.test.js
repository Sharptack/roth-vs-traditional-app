import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';
import { STRATEGIES, conventionalOrderStrategy, fillBracketStrategy, rothConversionStrategy } from '../src/lib/strategies.js';

const Y = 2026;
function retiree({ age, pretax = 0, roth = 0, taxable = 0, basisShare = 1 }) {
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
    assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false },
  };
}

describe('withdrawal strategies (2026, HAND CALC)', () => {
  it('conventional order: taxable first, then Pre-tax, then Roth', () => {
    // $50,000 taxable (all basis, so no tax) + $100,000 Pre-tax, need $30,000.
    // Year 1: 30,000 from taxable. Year 2: the last 20,000 of taxable + 10,000 Pre-tax (under the
    // 16,100 standard deduction: no tax). Year 3: Pre-tax only, 31,613.64 (0.88 W + 2,180 = 30,000).
    const { rows } = runProjection(retiree({ age: 66, pretax: 100000, taxable: 50000 }), { need: 30000, endAge: 68, strategy: conventionalOrderStrategy });
    expect(rows[0].withdrawals.taxable).toBeCloseTo(30000, 6);
    expect(rows[0].withdrawals.pretax).toBe(0);
    expect(rows[1].withdrawals.taxable).toBeCloseTo(20000, 6);
    expect(rows[1].withdrawals.pretax).toBeCloseTo(10000, 4);
    expect(rows[1].totalTax).toBe(0);
    expect(rows[2].withdrawals.pretax).toBeCloseTo(27820 / 0.88, 4);
  });

  it('fill the 12% bracket: Pre-tax up to the top of 12% even beyond the need; the rest reinvested', () => {
    // top of 12%: taxable 50,400 -> withdrawal 50,400 + 16,100 = 66,500; tax 1,240 + 4,560 = 5,800
    // cash 60,700 against a need of 30,000 -> 30,700 reinvested; taxable untouched
    const r = runProjection(retiree({ age: 66, pretax: 1000000, taxable: 200000 }), { need: 30000, endAge: 66, strategy: fillBracketStrategy(0.12) }).rows[0];
    expect(r.withdrawals.pretax).toBeCloseTo(66500, 2);
    expect(r.withdrawals.taxable).toBeCloseTo(0, 6);
    expect(r.totalTax).toBeCloseTo(5800, 2);
    expect(r.surplus).toBeCloseTo(30700, 2);
    expect(r.bracketRoom).toBeCloseTo(0, 2); // filled to the top of 12%
  });

  it('Roth conversions to the top of 12%, tax paid from the taxable account', () => {
    // 66, born 1960 (RMDs at 75). $500,000 Pre-tax, $300,000 taxable (all basis), need 30,000.
    // Spending from taxable (no ordinary income); convert 66,500 (fills 12%), tax 5,800;
    // taxable withdrawal 30,000 + 5,800 = 35,800. End: Pre-tax 433,500, Roth 66,500, taxable 264,200.
    const r = runProjection(retiree({ age: 66, pretax: 500000, taxable: 300000 }), { need: 30000, endAge: 66, strategy: rothConversionStrategy(0.12) }).rows[0];
    expect(r.conversions).toBeCloseTo(66500, 2);
    expect(r.totalTax).toBeCloseTo(5800, 2);
    expect(r.withdrawals.taxable).toBeCloseTo(35800, 2);
    expect(r.afterTaxIncome).toBeCloseTo(30000, 4);
    expect(r.endBalances.pretax).toBeCloseTo(433500, 2);
    expect(r.endBalances.roth).toBeCloseTo(66500, 2);
    expect(r.endBalances.taxable).toBeCloseTo(264200, 2);
  });

  it('no conversions once RMDs start', () => {
    const r = runProjection(retiree({ age: 75, pretax: 500000, taxable: 300000 }), { need: 30000, endAge: 75, strategy: rothConversionStrategy(0.12) }).rows[0];
    expect(r.conversions).toBe(0);
    expect(r.rmd).toBeCloseTo(500000 / 24.6, 2);
  });

  it('every strategy keeps the engine\'s rules and meets the need when it can', () => {
    for (const s of STRATEGIES) {
      const { rows } = runProjection(retiree({ age: 70, pretax: 600000, roth: 100000, taxable: 150000, basisShare: 0.5 }), { need: 45000, endAge: 80, strategy: s.strategy });
      for (const r of rows) {
        expect(r.shortfall).toBe(0);
        expect(r.afterTaxIncome).toBeGreaterThanOrEqual(45000 - 0.01);
        expect(r.withdrawals.pretax + 1e-6).toBeGreaterThanOrEqual(r.rmd);
        expect(r.endBalances.pretax).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
});
