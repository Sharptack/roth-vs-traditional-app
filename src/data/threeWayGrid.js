// The three-scenario Visualization page's grid (decided 2026-10-16, roadmap "Three-scenario
// visualization"): every combination of a starting age, a pay and an existing Pre-tax balance is one
// sample household, run as all Roth, all Pre-tax, and all Pre-tax with conversions in the lower years.
//
// What every sample household shares: single, W-2 pay, 10% of pay saved to a 401(k), the existing
// balance all Pre-tax (one account), retiring at 65, planning to 95, no debt payments, and the app's
// default assumptions (7% return, 2.5% inflation, IRMAA, surplus saved in retirement, ...).

export const THREE_WAY_AGES = [25, 35, 45, 55];
export const THREE_WAY_INCOMES = [50000, 75000, 100000, 150000, 200000, 300000];
export const THREE_WAY_BALANCES = [0, 100000, 250000, 500000, 1000000, 2000000];

export const THREE_WAY_SAMPLE = {
  savingsRate: 0.1,
  retirementAge: 65,
  planToAge: 95,
};

// Every grid point, ages slowest, so the first age's map fills first.
export const THREE_WAY_POINTS = THREE_WAY_AGES.flatMap((age) =>
  THREE_WAY_BALANCES.flatMap((balance) => THREE_WAY_INCOMES.map((income) => ({ age, income, balance }))),
);
