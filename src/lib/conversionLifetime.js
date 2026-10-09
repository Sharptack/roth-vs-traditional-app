// The Roth conversion calculator's lifetime view (decided 2026-10-09). Pure. The household projected
// year by year to the end age twice, with this year's conversion (runProjection's convertNow) and
// without it, everything else alike (the spending need, the withdrawal strategy, the end age). The three
// figures the decision turns on, as Michael set them:
//   lifetime tax        federal income tax plus Medicare IRMAA surcharges, every year (payroll tax is
//                       the same both ways, so it is left out)
//   legacy              the portfolio at the end, and after the heirs' tax on Pre-tax money
//   retirement income   everything withdrawn and received in the years anyone is retired: withdrawals,
//                       Social Security, pensions, other income and any earnings (not conversions,
//                       which stay invested)
import { runProjection } from './projection.js';
import { strategyById } from './strategies.js';

const DEFAULT_HEIR_TAX_RATE = 0.24;

const anyRetired = (r) => r.working.some((w, i) => r.alive[i] && !w);

// One run's totals. heirTaxRate: the heirs' rate on inherited Pre-tax money.
export function conversionTotals(rows, heirTaxRate = DEFAULT_HEIR_TAX_RATE) {
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
  const end = rows[rows.length - 1].endBalances;
  return {
    incomeTax: sum((r) => r.incomeTax),
    irmaa: sum((r) => r.irmaa),
    lifetimeTax: sum((r) => r.incomeTax + r.irmaa),
    legacy: end.total,
    legacyAfterTax: end.pretax * (1 - heirTaxRate) + end.roth + end.taxable,
    retirementIncome: sum((r) => (anyRetired(r) ? r.withdrawals.total + r.socialSecurity + r.pension + (r.otherIncome ?? 0) + r.wages : 0)),
  };
}

// household: the version 2 household; need: the after-tax spending need in retirement (the retirement
// income number); amount: the conversion this year.
// -> { amount, without, with: { rows, runOutYear, totals }, difference: totals with − without,
//      years: [{ year, ages, without, with }] (each year's income tax plus IRMAA) }
export function conversionLifetime(household, need, amount) {
  const own = household.calculators?.projection ?? {};
  const heirTaxRate = own.heirTaxRate ?? DEFAULT_HEIR_TAX_RATE;
  const options = { need, endAge: own.endAge, strategy: strategyById(own.strategy) };
  const run = (convertNow) => {
    const p = runProjection(household, { ...options, convertNow });
    return { ...p, totals: conversionTotals(p.rows, heirTaxRate) };
  };
  const without = run(0);
  const withIt = run(amount);
  const difference = Object.fromEntries(Object.keys(without.totals).map((k) => [k, withIt.totals[k] - without.totals[k]]));
  return {
    amount,
    heirTaxRate,
    without,
    with: withIt,
    difference,
    years: without.rows.map((r, i) => ({
      year: r.year,
      ages: r.ages,
      without: r.incomeTax + r.irmaa,
      with: withIt.rows[i].incomeTax + withIt.rows[i].irmaa,
    })),
  };
}
