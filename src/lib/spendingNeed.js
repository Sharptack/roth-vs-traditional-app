// The spending need (roadmap phase 3, decided 2026-10-09): the after-tax spending a year in
// retirement, in today's dollars, that every calculator reads (the projection, the conversion
// lifetime view, the Roth comparison's retirement income number). Pure.
//
// Two methods estimate what the household spends today, after tax:
//   'income' (top-down): take-home pay minus savings (worked out in compare.js, which has the tax)
//   'budget' (bottom-up): household.spending.baselineExpenses, one number for now
// Retirement spending follows from either the same way: today's spending, minus the costs that
// end by retirement, times the lifestyle factor, floored at $0. For a household already retired
// it is the budget as is (the costs have ended; the lifestyle factor compares retirement with work).
// household.spending.method picks the method ('income' by default); with everyone retired there
// is no take-home pay, so it is the budget.

export const BUDGET_MISSING_MESSAGE = 'Enter the baseline expenses per year (in Spending): the retirement spending is based on the budget.';

// A retirement age at or below the age now = already retired (decided 2026-10-09).
export const everyoneRetired = (household) => household.people.every((p) => household.year - p.birthYear >= p.retirementAge);

export function spendingMethod(household) {
  if (everyoneRetired(household)) return 'budget';
  return household.spending.method === 'budget' ? 'budget' : 'income';
}

// The budget method's retirement spending -> { raw, beforeLifestyle, target }, or null with no
// budget entered. raw = baseline − costs that end (negative when they exceed it).
export function budgetNeed({ baselineExpenses, debtPaymentsEnding = 0, otherExpensesEnding = 0, retirementLifestyle = 1 }, { retired = false } = {}) {
  if (typeof baselineExpenses !== 'number' || !Number.isFinite(baselineExpenses)) return null;
  if (retired) return { raw: baselineExpenses, beforeLifestyle: baselineExpenses, target: baselineExpenses };
  const raw = baselineExpenses - debtPaymentsEnding - otherExpensesEnding;
  const beforeLifestyle = Math.max(0, raw);
  return { raw, beforeLifestyle, target: beforeLifestyle * retirementLifestyle };
}

// spendingNeed(household, rothResult) -> { method, need, topDown, budget, error }
//   rothResult: compareRothVsTraditional's result for this household (the top-down figure needs
//     its take-home pay); when it is invalid, the 'income' method has no need and its first error
//     is the reason.
//   need: the method's retirement spending (null when it can't be worked out; error says why)
//   topDown, budget: each method's figure where it can be worked out (null otherwise)
export function spendingNeed(household, rothResult) {
  const method = spendingMethod(household);
  const fromBudget = budgetNeed(household.spending, { retired: everyoneRetired(household) });
  const budget = fromBudget ? fromBudget.target : null;
  const topDown = rothResult?.valid ? (rothResult.retirementNeed.topDown ?? rothResult.retirementNeed.target) : null;
  if (method === 'budget') {
    return { method, need: budget, topDown, budget, error: budget === null ? BUDGET_MISSING_MESSAGE : null };
  }
  return { method, need: topDown, topDown, budget, error: topDown === null ? (rothResult?.errors?.[0] ?? null) : null };
}
