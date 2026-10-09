// The tax calculator (roadmap phase 2, the suite's second calculator): one federal tax year for
// the household, from the shared household inputs plus the calculator's own "This year's income".
// Pure; the page (src/next/TaxCalculatorPage.jsx) renders what these return.
import { calculateYearTax, calculateYearTaxTotals, addIncome, marginalProbe } from './yearTax.js';
import { yearTaxRows } from './yearTaxRows.js';
import { checkContributionLimit } from './contributionLimits.js';
import { dependentsInYear } from './dependents.js';
import { irmaaFromThisYear } from './irmaa.js';
import { getBrackets } from './taxCalculations.js';
import { socialSecurityInYear } from './projection.js';
import { formatCurrency as $0 } from './format.js';

// The calculator's own form fields (stored in the household under calculators.tax).
export const TAX_CALCULATOR_DEFAULT_VALUES = {
  taxOrdinaryIncome: '0', // Pre-tax withdrawals, pensions, Roth conversions
  taxInvestmentIncome: '0', // interest, non-qualified dividends, short-term gains
  taxPreferentialIncome: '0', // long-term gains, qualified dividends
  taxSocialSecurity: '0', // Social Security received this year
};

// This year's qualified dividends from the household's taxable accounts (phase 2 step f, decided
// 2026-10-09): each account's balance x its own yield, else the assumption. The accounts are the only
// source of these dividends; an "Other: qualified dividends" income row is dividends from elsewhere.
// -> { dividends, balance } (balance: the taxable accounts' total). Version 1: none.
export function taxableAccountDividends(household) {
  const fallback = household.assumptions?.dividendYield ?? 0;
  return (household.accounts ?? [])
    .filter((a) => a.type === 'taxable')
    .reduce((acc, a) => ({ dividends: acc.dividends + a.balance * (a.dividendYield ?? fallback), balance: acc.balance + a.balance }), { dividends: 0, balance: 0 });
}

// The calculateYearTax parameters for this household's current year.
//  - people: each person's wages / 1099 income and age today (the 65+ deductions apply now).
//  - pretaxDeferrals: this year's Pre-tax Future Contributions, each person's capped at their own
//    IRS limit (only when the savings are currently Pre-tax).
//  - income: the calculator's own inputs. A version 2 household's Social Security is each person's
//    benefit once claimed (projection.js socialSecurityInYear); version 1 typed it in. Qualified
//    dividends include the taxable accounts' (taxableAccountDividends; accountDividends says how much).
export function householdToYearTaxParams(household) {
  const { year, people, futureContributions: fc, filingStatus } = household;
  const tax = household.calculators?.tax ?? {};
  const ageOf = (p) => year - p.birthYear;
  // Each person's own Roth/Pre-tax type and account type, when they have one (else the household's).
  const pretaxDeferrals = people.reduce((acc, p) => {
    const c = fc.contributions.find((x) => x.owner === p.id);
    if (!c || (c.currentType ?? fc.currentType) !== 'pretax') return acc;
    return acc + Math.min(Math.max(0, c.amount), checkContributionLimit(c.amount, c.accountType ?? fc.accountType, year, ageOf(p)).limit);
  }, 0);
  const { dividends: accountDividends } = taxableAccountDividends(household);
  return {
    filingStatus,
    year,
    people: people.map((p) => ({
      age: ageOf(p),
      wages: p.wages,
      selfEmploymentIncome: p.selfEmploymentIncome,
      ...((p.qbiShare ?? 1) < 1 && { qbiShare: p.qbiShare }), // 1099 income from a business that doesn't qualify for QBI
    })),
    pretaxDeferrals,
    qbi: Boolean(household.assumptions?.qualifiedBusinessIncome), // QBI on 1099 earnings (qbi.js)
    ...(household.deductions?.itemized > 0 && { itemizedDeductions: household.deductions.itemized }),
    ...creditCounts(household),
    ...(accountDividends > 0 && { accountDividends }),
    income: {
      ordinaryIncome: tax.ordinaryIncome ?? 0,
      investmentOrdinaryIncome: tax.investmentOrdinaryIncome ?? 0,
      preferentialIncome: (tax.preferentialIncome ?? 0) + accountDividends,
      socialSecurity: household.version === 2 ? socialSecurityInYear(household, 0) : (tax.socialSecurity ?? 0),
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

// The same sources as they read inside a sentence ("the next $100 of …").
const SOURCE_PHRASES = {
  wages: 'wages',
  selfEmploymentIncome: '1099 income',
  ordinaryIncome: 'Pre-tax withdrawals or pension',
  investmentOrdinaryIncome: 'interest or non-qualified dividends',
  preferentialIncome: 'long-term gains',
  socialSecurity: 'Social Security',
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
//  irmaa (options.irmaa): the Medicare premium surcharge this year's MAGI sets two years on
//  (lib/irmaa.js irmaaFromThisYear), else null.
export function taxCalculatorResult(params, { irmaa = false } = {}) {
  const r = calculateYearTax(params);
  const rows = yearTaxRows(params, r);
  const lead = headlineSource(r.lines);
  const asRate = (source) => ({ source, label: SOURCE_LABELS[source], phrase: SOURCE_PHRASES[source], ...r.marginalRates[source] });
  return {
    params, // for the rate buckets (rateProfile.js), which re-run the engine up the income scale
    result: r,
    rows,
    marginal: asRate(lead),
    steps: marginalSteps(params, lead),
    others: Object.keys(SOURCE_LABELS)
      .filter((s) => s !== lead)
      .map(asRate),
    bar: bracketFill(params, r),
    irmaa: irmaa
      ? irmaaFromThisYear({ magi: r.lines.magi, filingStatus: params.filingStatus, year: params.year, ages: (params.people ?? []).map((p) => p.age).filter(Number.isFinite) })
      : null,
  };
}

// The effective marginal rate worked out in a few lines (decided 2026-10-09): the next $100 (or
// $1,000, marginalProbe) of one source, what it sets off, the extra tax and the rate. Each row is
// the change between the year as it is and the year with the probe added; rows that don't change
// are left out (the first, the taxable-income and the result rows always show).
// -> { probe, rows: [{ key, label, value, kind }], extraTax, rate, payroll, rateWithPayroll }
//   kind: 'add' (income added), 'line' (a step in taxable income), 'total', 'tax', 'result'.
export function marginalSteps(params, source) {
  const probe = marginalProbe(params);
  const a = calculateYearTaxTotals(params);
  const b = calculateYearTaxTotals(addIncome(params, source, probe));
  const d = (f) => f(b) - f(a);
  const near0 = (x) => Math.abs(x) < 0.005;
  const rows = [{ key: 'probe', label: `The next ${$0(probe)} of ${SOURCE_PHRASES[source]}`, value: probe, kind: 'add' }];
  const line = (key, label, value) => !near0(value) && rows.push({ key, label, value, kind: 'line' });
  line('adjustments', 'Less the deductible half of the extra self-employment tax', -d((r) => r.lines.adjustments));
  line('socialSecurity', 'Social Security made taxable by it', d((r) => r.lines.taxableSocialSecurity));
  // Social Security itself is in the probe but only its taxable part counts.
  if (source === 'socialSecurity') rows[0].label += ' (only the taxable part counts)';
  line('deduction', 'Deductions lost (the senior deduction phases out)', -d((r) => r.lines.standardDeduction));
  line('qbi', 'QBI deduction (20% of the business income)', -d((r) => r.lines.qbiDeduction));
  const taxable = d((r) => r.lines.taxableIncome);
  rows.push({ key: 'taxable', label: 'Taxable income rises by', value: taxable, kind: 'total' });
  const tax = (key, label, value) => !near0(value) && rows.push({ key, label, value, kind: 'tax' });
  const ordinary = d((r) => r.ordinaryTax);
  const ordTaxable = d((r) => r.lines.ordinaryTaxableIncome);
  const rate = a.ordinaryBracketRate;
  // "at 22%" only when the whole change is taxed at the current bracket (it didn't cross one).
  const atRate = !near0(ordTaxable) && Math.abs(ordinary - ordTaxable * rate) < 0.01;
  tax('ordinaryTax', atRate ? `Tax on ${$0(ordTaxable)} at ${Math.round(rate * 1000) / 10}%` : 'Ordinary income tax', ordinary);
  tax('capitalGainsTax', source === 'preferentialIncome' ? 'Tax on long-term gains and qualified dividends' : 'Tax on gains and qualified dividends pushed into a higher rate', d((r) => r.capitalGainsTax));
  tax('niit', 'Net investment income tax (3.8%)', d((r) => r.niit));
  tax('credit', 'Child tax credit lost', -d((r) => r.lines.childTaxCredit));
  const extraTax = d((r) => r.incomeTax);
  rows.push({ key: 'extraTax', label: 'Extra federal income tax', value: extraTax, kind: 'result' });
  const payroll = d((r) => r.payrollTax);
  return { probe, rows, extraTax, rate: extraTax / probe, payroll, rateWithPayroll: (extraTax + payroll) / probe };
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

// This year's child tax credit counts, only when there are any (so a household without children
// gives the same parameters as before).
function creditCounts(household) {
  const { children, otherDependents } = dependentsInYear(household, 0);
  return { ...(children > 0 && { children }), ...(otherDependents > 0 && { otherDependents }) };
}
