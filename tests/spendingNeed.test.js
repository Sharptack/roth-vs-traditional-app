// The spending need (phase 3 step a, decided 2026-10-09): top-down or the budget, one function.
// Hand math in the comments, worked out before running.
import { describe, expect, it } from 'vitest';
import { BUDGET_MISSING_MESSAGE, budgetNeed, everyoneRetired, spendingMethod, spendingNeed } from '../src/lib/spendingNeed.js';
import { DEFAULT_HOUSEHOLD_VALUES as D, newPerson } from '../src/lib/householdValues.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { projectionView } from '../src/lib/projectionSummary.js';

const YEAR = 2026;
const withSpending = (spending, more = {}) => ({ ...D, ...more, spending: { ...D.spending, ...spending } });
const run = (values) => {
  const household = toHouseholdV2(values, YEAR);
  const result = compareRothVsTraditional({ ...householdToCompareInputs(household), skipBlend: true });
  return { household, result, spending: spendingNeed(household, result) };
};
// 75, retired at 65, receiving $2,500 a month of Social Security, $800,000 Pre-tax.
const retiredValues = (spending) =>
  withSpending(spending, {
    people: [newPerson('p1', { age: '75', retirementAge: '65' })],
    incomes: [D.incomes[0], { ...D.incomes[1], ssMode: 'receiving', amount: '2500' }],
    contributions: [],
    accounts: [{ ...D.accounts[0], balance: '800000' }],
  });

describe('budgetNeed', () => {
  it('today\'s budget minus the costs that end, times the lifestyle factor', () => {
    // 70,000 − 6,000 − 4,000 = 60,000; × 0.9 = 54,000
    expect(budgetNeed({ baselineExpenses: 70000, debtPaymentsEnding: 6000, otherExpensesEnding: 4000, retirementLifestyle: 0.9 })).toEqual({
      raw: 60000,
      beforeLifestyle: 60000,
      target: 54000,
    });
  });
  it('already retired: the budget as is (the costs have ended; no lifestyle change)', () => {
    // 60,000, whatever the 6,000 of costs and the 80% lifestyle say
    expect(budgetNeed({ baselineExpenses: 60000, debtPaymentsEnding: 6000, retirementLifestyle: 0.8 }, { retired: true }).target).toBe(60000);
  });
  it('costs above the budget: $0, with the shortfall in raw', () => {
    // 5,000 − 6,000 = −1,000 → 0
    expect(budgetNeed({ baselineExpenses: 5000, debtPaymentsEnding: 6000 })).toEqual({ raw: -1000, beforeLifestyle: 0, target: 0 });
  });
  it('no budget entered: null', () => {
    expect(budgetNeed({ baselineExpenses: null })).toBeNull();
    expect(budgetNeed({ baselineExpenses: NaN })).toBeNull();
  });
});

describe('spendingNeed', () => {
  it('the default household: top-down, the Roth comparison\'s number unchanged', () => {
    const { result, spending } = run(D);
    expect(result.retirementNeed.method).toBe('income');
    expect(spending).toEqual({ method: 'income', need: result.retirementNeed.target, topDown: result.retirementNeed.target, budget: null, error: null });
  });

  it('the budget method: the Roth comparison uses the budget; the top-down figure stays alongside', () => {
    const topDown = run(D).result.retirementNeed.target;
    const { result, spending } = run(withSpending({ method: 'budget', baseline: '70000' }));
    // 70,000 − 6,000 of debt payments that end = 64,000; lifestyle 100%
    expect(result.retirementNeed.target).toBe(64000);
    expect(result.retirementNeed.method).toBe('budget');
    expect(result.retirementNeed.topDown).toBeCloseTo(topDown, 6);
    expect(spending).toEqual({ method: 'budget', need: 64000, topDown: result.retirementNeed.topDown, budget: 64000, error: null });
  });

  it('a budget entered under the income method: shown, not used', () => {
    const { result, spending } = run(withSpending({ baseline: '70000' }));
    expect(spending.method).toBe('income');
    expect(spending.need).toBe(result.retirementNeed.target);
    expect(spending.budget).toBe(64000);
  });

  it('the budget method with no budget: the Roth comparison says what to enter', () => {
    const { result, spending } = run(withSpending({ method: 'budget' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(BUDGET_MISSING_MESSAGE);
    expect(spending).toMatchObject({ method: 'budget', need: null, error: BUDGET_MISSING_MESSAGE });
  });

  it('everyone retired: the budget, whatever the method; none entered = an error', () => {
    const household = toHouseholdV2(retiredValues({ baseline: '60000' }), YEAR);
    expect(everyoneRetired(household)).toBe(true);
    expect(spendingMethod(household)).toBe('budget');
    // No take-home pay: the Roth comparison has no top-down figure. 60,000 as is.
    const invalid = { valid: false, errors: ['nothing to compare'] };
    expect(spendingNeed(household, invalid)).toEqual({ method: 'budget', need: 60000, topDown: null, budget: 60000, error: null });
    const blank = toHouseholdV2(retiredValues({}), YEAR);
    expect(spendingNeed(blank, invalid)).toMatchObject({ need: null, error: BUDGET_MISSING_MESSAGE });
  });

  it('the income method with an invalid Roth comparison: its first error is the reason', () => {
    const household = toHouseholdV2(D, YEAR);
    expect(spendingNeed(household, { valid: false, errors: ['Enter your age.', 'x'] })).toMatchObject({ need: null, error: 'Enter your age.' });
  });

  it('a household already retired gets its projection from the budget', () => {
    const household = toHouseholdV2(retiredValues({ baseline: '60000' }), YEAR);
    const view = projectionView(household, 60000);
    expect(view.need).toBe(60000);
    // The first year: $30,000 of Social Security, the rest from the Pre-tax account (with its tax).
    expect(view.rows[0].withdrawals.total).toBeGreaterThan(30000);
    expect(view.rows[0].shortfall).toBe(0);
  });
});
