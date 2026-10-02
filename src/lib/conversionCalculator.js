// The Roth conversion calculator (single year; the plan's "small calculators after phase 2").
// The tax calculator plus a "convert $X" input: the conversion's tax cost is the year's tax WITH it
// minus the tax WITHOUT it (calculateYearTax both times), so everything a conversion drags along
// is counted: more Social Security becoming taxable, gains pushed into a higher capital-gains
// bracket, NIIT, the senior deduction phasing out. Pure. Multi-year conversion plans are a
// withdrawal strategy on the projection page (strategies.js), not this.
import { calculateYearTax, calculateYearTaxTotals } from './yearTax.js';
import { bracketFill } from './taxCalculator.js';
import { getBrackets } from './taxCalculations.js';

// The calculator's own form field (stored in the household under calculators.conversion).
export const CONVERSION_DEFAULT_VALUES = {
  convAmount: '50000', // Pre-tax dollars converted to Roth this year
};

const withConversion = (params, amount) => ({
  ...params,
  income: { ...params.income, ordinaryIncome: (params.income?.ordinaryIncome ?? 0) + amount },
});

// params: this year's calculateYearTax parameters without the conversion (householdToYearTaxParams).
// -> { amount, before, after, cost, rate,
//      parts: { ordinaryTax, capitalGainsTax, niit }      the cost, by kind of tax
//      extraTaxableSocialSecurity, deductionLost,          what the conversion dragged along
//      fills: [{ rate, amount, cost, costRate }]           the conversion that fills each bracket
//      bar }                                               the fill-up-the-bracket bar, after
//   bar.segments[].filled is the whole fill after the conversion; .added is the conversion's part.
export function conversionResult(params, amount) {
  const size = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const before = calculateYearTax(params);
  const after = calculateYearTax(withConversion(params, size));
  const cost = after.incomeTax - before.incomeTax;

  // The conversion that brings ordinary taxable income to the top of each bracket from the
  // current one up (bisection: a conversion can pull Social Security into tax with it, or cost
  // some of the senior deduction, so taxable income rises faster than the conversion).
  const ordinaryAt = (x) => calculateYearTaxTotals(withConversion(params, x)).lines.ordinaryTaxableIncome;
  const start = before.lines.ordinaryTaxableIncome;
  const fills = [];
  for (const b of getBrackets(params.filingStatus, params.year)) {
    if (!Number.isFinite(b.upTo) || b.upTo <= start) continue;
    let lo = 0;
    let hi = b.upTo - start + 1; // never needs more than the gap itself
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (ordinaryAt(mid) < b.upTo) lo = mid;
      else hi = mid;
    }
    const fillCost = calculateYearTaxTotals(withConversion(params, hi)).incomeTax - before.incomeTax;
    fills.push({ rate: b.rate + (params.rateShift ?? 0), amount: hi, cost: fillCost, costRate: hi > 0 ? fillCost / hi : 0 });
    if (fills.length === 3) break;
  }

  const bar = bracketFill(withConversion(params, size), after);
  bar.segments = bar.segments.map((s) => {
    const filledBefore = Math.max(0, Math.min(start, s.to) - s.from);
    return { ...s, added: Math.max(0, s.filled - filledBefore) };
  });

  return {
    amount: size,
    before,
    after,
    cost,
    rate: size > 0 ? cost / size : 0,
    parts: {
      ordinaryTax: after.ordinaryTax - before.ordinaryTax,
      capitalGainsTax: after.capitalGainsTax - before.capitalGainsTax,
      niit: after.niit - before.niit,
    },
    extraTaxableSocialSecurity: after.lines.taxableSocialSecurity - before.lines.taxableSocialSecurity,
    deductionLost: before.lines.standardDeduction - after.lines.standardDeduction,
    fills,
    bar,
  };
}
