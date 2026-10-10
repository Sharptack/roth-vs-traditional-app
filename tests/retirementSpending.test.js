// Retirement spending (phase 3 step c): the page's figures and "Use in the plan". Hand math in the
// comments, worked out before running.
import { describe, expect, it } from 'vitest';
import { applySpendingChoice, budgetFor, retirementSpendingView, spendingChoice } from '../src/lib/retirementSpending.js';
import { legacyOption } from '../src/lib/projectionSummary.js';
import { budgetNeed } from '../src/lib/spendingNeed.js';

const Y = 2026;
// Retired at 66, Roth only, $1,000,000 at 5%, the plan to 68 (3 years): no tax, no Social Security.
function retiree({ legacy = { type: 'none' }, roth = 1000000, spending = {} } = {}) {
  return {
    version: 2, year: Y, filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - 66, retirementAge: 65, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [{ id: 'a1', owner: 'p1', type: 'roth', balance: roth }],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1, method: 'budget', baselineExpenses: 150000, ...spending },
    legacy: { amount: 0, share: 0, measure: 'balance', ...legacy },
    calculators: { projection: { endAge: 68, heirTaxRate: 0.24 } },
    assumptions: { returnRate: 0.05, inflationRate: 0, ageDeductions: false },
  };
}
const within = (s, expected) => {
  expect(s).toBeGreaterThan(expected - 1.01);
  expect(s).toBeLessThanOrEqual(expected + 0.01);
};

describe('retirementSpendingView (HAND CALC, the step b annuity case)', () => {
  // With a $500,000 goal: W = 198,670.73; no goal: 349,722.44 (projectionSummary.test.js).
  it('a $500,000 goal: $198,670.73 a year, $48,670.73 above a $150,000 need; the goal costs $151,051.71', () => {
    const v = retirementSpendingView(retiree({ legacy: { type: 'amount', amount: 500000 } }), 150000);
    within(v.sustainable, 198670.73);
    within(v.withoutGoal, 349722.44);
    expect(v.difference).toBeCloseTo(v.sustainable - 150000, 9);
    expect(v.legacy).toMatchObject({ type: 'amount', target: 500000, measure: 'balance' });
    expect(v.reachable).toBe(true);
    expect(v.endingValue).toBeGreaterThanOrEqual(500000);
    expect(v.endingValue).toBeLessThan(500002);
    expect(v.endLabel).toBe('age 68');
  });

  it('a share of today\'s portfolio: 50% of $1,000,000 is the same $500,000 goal', () => {
    const v = retirementSpendingView(retiree({ legacy: { type: 'share', share: 0.5 } }), 150000);
    expect(v.legacy.target).toBe(500000);
    within(v.sustainable, 198670.73);
  });

  it('no goal: everything spent', () => {
    const v = retirementSpendingView(retiree(), 150000);
    within(v.sustainable, 349722.44);
    expect(v.withoutGoal).toBe(v.sustainable);
    expect(v.legacy).toMatchObject({ type: 'none', target: 0 });
    expect(legacyOption(retiree())).toBeNull();
  });

  it('a goal out of reach: nothing to spend, and the page says so', () => {
    // at most 1,000,000 × 1.157625 = 1,157,625 by 68
    const v = retirementSpendingView(retiree({ legacy: { type: 'amount', amount: 1200000 } }), 150000);
    expect(v.sustainable).toBe(0);
    expect(v.reachable).toBe(false);
  });
});

describe('"Use in the plan": the budget worked back (decided 2026-10-10)', () => {
  it('still working: spending ÷ lifestyle + the costs that end, rounded down', () => {
    // 87,739.50 / 0.8 = 109,674.375; + 6,000 = 115,674.375 → 115,674
    // need from it: (115,674 − 6,000) × 0.8 = 87,739.20 (at or just under the figure)
    const working = { ...retiree({ spending: { retirementLifestyle: 0.8, debtPaymentsEnding: 6000 } }) };
    working.people = [{ ...working.people[0], retirementAge: 70 }];
    expect(budgetFor(working, 87739.5)).toBe(115674);
    expect(budgetNeed({ ...working.spending, baselineExpenses: 115674 }).target).toBeCloseTo(87739.2, 6);
  });

  it('already retired: the figure as is, rounded down', () => {
    expect(budgetFor(retiree({ spending: { retirementLifestyle: 0.8, debtPaymentsEnding: 6000 } }), 198670.73)).toBe(198670);
  });

  it('the choice and the values it writes; none when the plan already spends it', () => {
    const h = retiree({ legacy: { type: 'amount', amount: 500000 } });
    const view = retirementSpendingView(h, 150000);
    const choice = spendingChoice(h, view);
    expect(choice.baseline).toBe(Math.floor(view.sustainable));
    expect(choice.need).toBe(choice.baseline);
    const values = { spending: { method: 'income', baseline: '', debtPayments: '0' } };
    expect(applySpendingChoice(values, choice).spending).toEqual({ method: 'budget', baseline: String(choice.baseline), debtPayments: '0' });
    // rerun at the new budget: the plan now spends it (within $1), so no button
    expect(spendingChoice(h, { ...view, need: choice.need })).toBeNull();
    expect(spendingChoice(h, { ...view, sustainable: 0 })).toBeNull();
  });
});
