// The projection's lifetime summary and sustainable spending (roadmap phase 5). Pure; reads the
// rows runProjection returns, so the page, the lifetime comparison (phase 6) and a future
// aggregate page all use the same figures.
import { runProjection } from './projection.js';

export const DEFAULT_HEIR_TAX_RATE = 0.24;

// summarizeProjection(rows, { heirTaxRate, endAge }) -> the lifetime summary, in today's dollars:
//   totalTax / totalIncomeTax       every year's tax (income + payroll / income tax only)
//   retirementAfterTaxIncome        after-tax income in the years anyone is retired (incl. surplus)
//   endingBalance                   by account type at the end age, and the total
//   endingAfterTax                  Pre-tax at the heirs' rate, Roth and taxable in full: heirs get a
//                                   step-up in basis on taxable accounts (IRC §1014), so the gains
//                                   aren't taxed to them (the plan doc said "taxable on its gains")
//   averageEffectiveRate            lifetime income tax ÷ lifetime gross income
//   highestTaxYear                  { year, amount } by income tax
//   moneyLastsTo                    person 1's age in the last year with no shortfall (or the end age)
//   firstRetirementYear             the first year anyone is retired (null if never)
export function summarizeProjection(rows, { heirTaxRate = DEFAULT_HEIR_TAX_RATE } = {}) {
  const sum = (pick, list = rows) => list.reduce((s, r) => s + pick(r), 0);
  const retired = rows.filter((r) => r.working.some((w) => !w));
  const last = rows[rows.length - 1];
  const highest = rows.reduce((best, r) => (r.incomeTax > best.amount ? { year: r.year, amount: r.incomeTax } : best), {
    year: null,
    amount: -Infinity,
  });
  const firstShort = rows.find((r) => r.shortfall > 0);
  const end = last.endBalances;
  return {
    totalTax: sum((r) => r.totalTax),
    totalIncomeTax: sum((r) => r.incomeTax),
    retirementAfterTaxIncome: sum((r) => r.afterTaxIncome, retired),
    endingBalance: end,
    endingAfterTax: end.pretax * (1 - heirTaxRate) + end.roth + end.taxable,
    averageEffectiveRate: sum((r) => r.grossIncome) > 0 ? sum((r) => r.incomeTax) / sum((r) => r.grossIncome) : 0,
    highestTaxYear: highest,
    moneyLastsTo: firstShort ? firstShort.ages[0] - 1 : last.ages[0],
    runsOut: Boolean(firstShort),
    firstRetirementYear: retired.length > 0 ? retired[0].year : null,
    heirTaxRate,
  };
}

// The highest steady after-tax spending (today's dollars) the plan supports through the end age
// with no shortfall. Bisection on the need: a higher need can only run out sooner. Each step is a
// whole projection, so it stops at $1 of precision.
export function sustainableSpending(household, options = {}) {
  const lasts = (need) => runProjection(household, { ...options, need }).rows.every((r) => r.shortfall === 0);
  let lo = 0;
  let hi = 50000;
  while (lasts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e9) return hi;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (lasts(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Everything the projection page and its tile show, from the household and the spending need
// (the Roth calculator's retirement income number). The calculator's own inputs live under
// household.calculators.projection: { endAge, heirTaxRate }.
//   funded: sustainable spending ÷ the need (1 = exactly funded; above 1 = overfunded).
export function projectionView(household, need) {
  const own = household.calculators?.projection ?? {};
  const options = { endAge: own.endAge };
  const { rows, runOutYear, endAge } = runProjection(household, { ...options, need });
  const summary = summarizeProjection(rows, { heirTaxRate: own.heirTaxRate });
  const sustainable = sustainableSpending(household, options);
  return { rows, runOutYear, endAge, summary, need, sustainable, funded: need > 0 ? sustainable / need : null };
}
