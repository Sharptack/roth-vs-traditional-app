// The full-year tax calculation as data rows (roadmap phase 2): income lines -> AGI ->
// deductions -> each ordinary bracket -> each capital-gains bracket -> NIIT -> payroll tax.
// Pure; reads a calculateYearTax result (and the same bracket data it used), so the rows always
// add up to the engine's totals (tested). The tax calculator page renders these; a comparison,
// summary or aggregate page can use the same rows.
//
// Row: { key, label, value, kind, rate?, from?, to? }
//   kind: 'line' (an amount), 'sub' (an amount that is subtracted), 'total' (a subtotal),
//         'bracket' (one bracket's slice: amount from `from` to `to`, taxed at `rate`, value = tax),
//         'heading' (a group title, no value)
import { CAPITAL_GAINS_BRACKETS } from '../data/capitalGainsBrackets.js';
import { NIIT_RATES } from '../data/niitRates.js';
import { getBrackets } from './taxCalculations.js';
import { getYearData } from './yearLookup.js';

// The slices of [start, top) that fall in each bracket.
export function bracketSlices(start, top, brackets, rateShift = 0) {
  const slices = [];
  let bottom = 0;
  for (const { rate, upTo } of brackets) {
    const from = Math.max(bottom, start);
    const to = Math.min(top, upTo);
    if (to > from) slices.push({ rate: rate + rateShift, from, to, amount: to - from, tax: (to - from) * (rate + rateShift) });
    bottom = upTo;
    if (bottom >= top) break;
  }
  return slices;
}

const pct = (r) => `${Math.round(r * 1000) / 10}%`;

// params: the same object passed to calculateYearTax; r: its result.
export function yearTaxRows(params, r) {
  const { filingStatus, year, rateShift = 0, thresholdScale = 1 } = params;
  const L = r.lines;
  const rows = [];
  const add = (key, label, value, kind = 'line', extra = {}) => rows.push({ key, label, value, kind, ...extra });
  const nonZero = (v) => Math.abs(v) > 0.005;

  add('incomeHeading', 'Income', null, 'heading');
  if (nonZero(L.wages)) add('wages', 'Wages (W-2)', L.wages);
  if (nonZero(L.selfEmploymentIncome)) add('selfEmployment', 'Self-employment income (1099, net)', L.selfEmploymentIncome);
  if (nonZero(L.ordinaryIncome)) add('ordinaryIncome', 'Pre-tax withdrawals, pensions, conversions', L.ordinaryIncome);
  if (nonZero(L.investmentOrdinaryIncome)) add('investmentOrdinary', 'Interest, non-qualified dividends, short-term gains', L.investmentOrdinaryIncome);
  if (nonZero(L.preferentialIncome)) add('preferential', 'Long-term gains and qualified dividends', L.preferentialIncome);
  if (nonZero(L.socialSecurity)) {
    add('socialSecurity', 'Social Security benefits', L.socialSecurity);
    add('taxableSocialSecurity', 'Taxable part of Social Security', L.taxableSocialSecurity);
  }
  if (nonZero(L.selfEmploymentTaxDeduction)) add('seDeduction', 'Half of self-employment tax', L.selfEmploymentTaxDeduction, 'sub');
  if (nonZero(L.pretaxDeferrals)) add('deferrals', 'Pre-tax 401(k)/IRA contributions', L.pretaxDeferrals, 'sub');
  add('agi', 'Adjusted gross income (AGI)', L.agi, 'total');

  add('deductionHeading', 'Deductions', null, 'heading');
  add('standardDeduction', 'Standard deduction', L.baseStandardDeduction, 'sub');
  if (nonZero(L.additional65Deduction)) add('additional65', 'Additional standard deduction, age 65 or older', L.additional65Deduction, 'sub');
  if (nonZero(L.seniorDeduction)) add('senior', 'Senior deduction (2025–2028)', L.seniorDeduction, 'sub');
  add('taxableIncome', 'Taxable income', L.taxableIncome, 'total');

  add('ordinaryHeading', 'Ordinary income tax', null, 'heading');
  add('ordinaryTaxable', 'Ordinary taxable income', L.ordinaryTaxableIncome, 'line');
  bracketSlices(0, L.ordinaryTaxableIncome, getBrackets(filingStatus, year), rateShift).forEach((s, i) =>
    add(`ordinary${i}`, `${pct(s.rate)} on ${Math.round(s.amount).toLocaleString('en-US')}`, s.tax, 'bracket', s),
  );
  add('ordinaryTax', 'Ordinary income tax', r.ordinaryTax, 'total');

  if (L.preferentialIncome > 0) {
    add('gainsHeading', 'Capital-gains tax', null, 'heading');
    const cg = getYearData(CAPITAL_GAINS_BRACKETS, year).data[filingStatus];
    // Gains sit on top of ordinary taxable income, up to total taxable income.
    bracketSlices(L.ordinaryTaxableIncome, L.taxableIncome, cg).forEach((s, i) =>
      add(`gains${i}`, `${pct(s.rate)} on ${Math.round(s.amount).toLocaleString('en-US')}`, s.tax, 'bracket', s),
    );
    add('capitalGainsTax', 'Capital-gains tax', r.capitalGainsTax, 'total');
  }

  if (r.niit > 0) {
    const { data } = getYearData(NIIT_RATES, year);
    const threshold = data.threshold[filingStatus] * thresholdScale;
    add('niit', `Net Investment Income Tax: ${pct(data.rate)} × the lesser of investment income and MAGI over ${Math.round(threshold).toLocaleString('en-US')}`, r.niit, 'line', { rate: data.rate, threshold });
  }
  add('incomeTax', 'Federal income tax', r.incomeTax, 'total');

  if (r.payrollTax > 0) {
    add('payrollHeading', 'Payroll tax', null, 'heading');
    const p = r.payroll;
    if (nonZero(p.w2.socialSecurity)) add('ssTax', 'Social Security (6.2%, to the wage base)', p.w2.socialSecurity);
    if (nonZero(p.w2.medicare)) add('medicare', 'Medicare (1.45%)', p.w2.medicare);
    if (nonZero(p.selfEmployment.tax)) add('seTax', 'Self-employment tax', p.selfEmployment.tax);
    if (nonZero(p.additionalMedicare)) add('additionalMedicare', 'Additional Medicare (0.9%)', p.additionalMedicare);
    add('payrollTax', 'Payroll tax', r.payrollTax, 'total');
    add('totalTax', 'Total federal tax', r.totalTax, 'total');
  }
  return rows;
}
