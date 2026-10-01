// The tax calculator (roadmap phase 2, the suite's second calculator): one federal tax year for
// the household, from the shared household inputs plus the calculator's own "This year's income".
// Pure; the page (src/next/TaxCalculatorPage.jsx) renders what these return.
import { calculateYearTax } from './yearTax.js';
import { yearTaxRows } from './yearTaxRows.js';
import { checkContributionLimit } from './contributionLimits.js';
import { getBrackets } from './taxCalculations.js';

// The calculator's own form fields (stored in the household under calculators.tax).
export const TAX_CALCULATOR_DEFAULT_VALUES = {
  taxOrdinaryIncome: '0', // Pre-tax withdrawals, pensions, Roth conversions
  taxInvestmentIncome: '0', // interest, non-qualified dividends, short-term gains
  taxPreferentialIncome: '0', // long-term gains, qualified dividends
  taxSocialSecurity: '0', // Social Security received this year
};

// The calculateYearTax parameters for this household's current year.
//  - people: each person's wages / 1099 income and age today (the 65+ deductions apply now).
//  - pretaxDeferrals: this year's Pre-tax Future Contributions, each person's capped at their own
//    IRS limit (only when the savings are currently Pre-tax).
//  - income: the calculator's own inputs.
export function householdToYearTaxParams(household) {
  const { year, people, futureContributions: fc, filingStatus } = household;
  const tax = household.calculators?.tax ?? {};
  const ageOf = (p) => year - p.birthYear;
  const pretaxDeferrals =
    fc.currentType === 'pretax'
      ? people.reduce((acc, p) => {
          const amount = fc.contributions.find((c) => c.owner === p.id)?.amount ?? 0;
          return acc + Math.min(Math.max(0, amount), checkContributionLimit(amount, fc.accountType, year, ageOf(p)).limit);
        }, 0)
      : 0;
  return {
    filingStatus,
    year,
    people: people.map((p) => ({ age: ageOf(p), wages: p.wages, selfEmploymentIncome: p.selfEmploymentIncome })),
    pretaxDeferrals,
    income: {
      ordinaryIncome: tax.ordinaryIncome ?? 0,
      investmentOrdinaryIncome: tax.investmentOrdinaryIncome ?? 0,
      preferentialIncome: tax.preferentialIncome ?? 0,
      socialSecurity: tax.socialSecurity ?? 0,
    },
  };
}

const SOURCE_LABELS = {
  wages: 'Wages (W-2)',
  selfEmploymentIncome: 'Self-employment income (1099)',
  ordinaryIncome: 'Pre-tax withdrawals, pensions, conversions',
  investmentOrdinaryIncome: 'Interest, non-qualified dividends, short-term gains',
  preferentialIncome: 'Long-term gains, qualified dividends',
  socialSecurity: 'Social Security benefits',
};

// Which source leads the page: wages while working, else 1099 income, else Pre-tax withdrawals.
export function headlineSource(lines) {
  if (lines.wages > 0) return 'wages';
  if (lines.selfEmploymentIncome > 0) return 'selfEmploymentIncome';
  return 'ordinaryIncome';
}

// Everything the page shows: the result, its rows, the headline and the other marginal rates.
//  marginal: { source, label, incomeTax, total }; others: the remaining sources, same shape.
//  (Payroll tax applies only to wages and 1099 income, so `total` differs only for those.)
export function taxCalculatorResult(params) {
  const r = calculateYearTax(params);
  const rows = yearTaxRows(params, r);
  const lead = headlineSource(r.lines);
  const asRate = (source) => ({ source, label: SOURCE_LABELS[source], ...r.marginalRates[source] });
  return {
    result: r,
    rows,
    marginal: asRate(lead),
    others: Object.keys(SOURCE_LABELS)
      .filter((s) => s !== lead)
      .map(asRate),
    bar: bracketFill(params, r),
  };
}

// The "fill up the bracket" bar: taxable income stacked through the ordinary brackets, from the
// bottom (the part sheltered by deductions) to the top of the bracket ABOVE the current one.
//  segments: [{ rate, from, to, filled }] in taxable-income dollars; `filled` = how much of that
//  bracket ordinary taxable income uses. `deduction` sits below them at 0%.
export function bracketFill(params, r) {
  const brackets = getBrackets(params.filingStatus, params.year);
  const shift = params.rateShift ?? 0;
  const top = r.lines.ordinaryTaxableIncome;
  const current = brackets.findIndex((b) => top < b.upTo);
  const lastShown = Math.min(brackets.length - 1, current + 1);
  const segments = [];
  let bottom = 0;
  for (let i = 0; i <= lastShown; i++) {
    const b = brackets[i];
    // The open-ended top bracket is drawn to 25% above where it starts (or past the income in it).
    const to = Number.isFinite(b.upTo) ? b.upTo : Math.max(bottom * 1.25, top * 1.05);
    segments.push({ rate: b.rate + shift, from: bottom, to, filled: Math.max(0, Math.min(top, to) - bottom) });
    bottom = b.upTo;
  }
  return {
    deduction: r.lines.standardDeduction,
    deductionUsed: Math.min(r.lines.standardDeduction, Math.max(0, r.lines.ordinaryGross)),
    segments,
    ordinaryTaxableIncome: top,
    currentRate: r.bracketRoom.ordinary.rate,
    room: r.bracketRoom.ordinary.room,
  };
}
