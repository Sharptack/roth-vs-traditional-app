// The full-year tax calculation as data rows (roadmap phase 2; rebuilt in round 2 phase 1): income
// lines with their payroll tax -> Social Security -> AGI, MAGI -> deductions -> each ordinary
// bracket -> each capital-gains bracket -> NIIT -> total.
// Pure; reads a calculateYearTax result (and the same bracket data it used), so the rows always
// add up to the engine's totals (tested). The tax calculator page renders these; a comparison,
// summary or aggregate page can use the same rows.
//
// Row: { key, label, value, kind, rate?, from?, to? }
//   kind: 'line' (an amount), 'sub' (an amount that is subtracted), 'total' (a subtotal),
//         'tax' (payroll tax on the income line above it; not part of the walk to AGI),
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
// The rows appear only when they apply (round 2 phase 1): payroll tax beside each earned income,
// the Social Security steps only with benefits, net investment income and capital gains only when
// there are any, each deduction only when taken. Form 1040 line numbers where they help.
export function yearTaxRows(params, r) {
  const { filingStatus, year, rateShift = 0, thresholdScale = 1 } = params;
  const L = r.lines;
  const p = r.payroll;
  const rows = [];
  const add = (key, label, value, kind = 'line', extra = {}) => rows.push({ key, label, value, kind, ...extra });
  const nonZero = (v) => Math.abs(v) > 0.005;

  add('incomeHeading', 'Income', null, 'heading');
  if (nonZero(L.wages)) {
    add('wages', 'Wages (W-2)', L.wages);
    const fica = p.w2.socialSecurity + p.w2.medicare;
    if (nonZero(fica)) add('wagesPayroll', 'Payroll tax on them (FICA: Social Security 6.2% to the wage base, Medicare 1.45%)', fica, 'tax');
  }
  if (nonZero(L.selfEmploymentIncome)) {
    add('selfEmployment', 'Self-employment income (1099, net)', L.selfEmploymentIncome);
    if (nonZero(p.selfEmployment.tax)) add('sePayroll', 'Self-employment tax on it (15.3% of 92.35%, Social Security part to the wage base)', p.selfEmployment.tax, 'tax');
  }
  if (nonZero(p.additionalMedicare)) add('additionalMedicare', 'Additional Medicare tax (0.9% on earnings over the threshold)', p.additionalMedicare, 'tax');
  if (nonZero(L.ordinaryIncome)) add('ordinaryIncome', 'Pre-tax withdrawals, pensions, conversions', L.ordinaryIncome);
  if (nonZero(L.investmentOrdinaryIncome)) add('investmentOrdinary', 'Interest, non-qualified dividends, short-term gains', L.investmentOrdinaryIncome);
  if (nonZero(L.preferentialIncome)) add('preferential', 'Long-term gains and qualified dividends', L.preferentialIncome);
  if (nonZero(L.socialSecurity)) add('socialSecurity', 'Social Security benefits', L.socialSecurity);
  if (nonZero(L.selfEmploymentTaxDeduction)) add('seDeduction', 'Half of self-employment tax', L.selfEmploymentTaxDeduction, 'sub');
  if (nonZero(L.pretaxDeferrals)) add('deferrals', 'Pre-tax 401(k)/IRA contributions', L.pretaxDeferrals, 'sub');

  if (nonZero(L.socialSecurity)) {
    add('ssHeading', 'Social Security', null, 'heading');
    add('provisional', 'Provisional income (other income plus half the benefits)', L.provisionalIncome);
    add('taxableSocialSecurity', `Taxable Social Security (Form 1040 line 6b), ${pct(L.taxableSocialSecurity / L.socialSecurity)} of the benefits`, L.taxableSocialSecurity);
  }
  add('agi', 'Adjusted gross income (AGI, Form 1040 line 11)', L.agi, 'total');
  add('magi', 'Modified AGI (MAGI): sets IRMAA, NIIT and the senior deduction (the same as AGI here)', L.magi);
  if (nonZero(L.netInvestmentIncome)) add('nii', 'Net investment income (for NIIT)', L.netInvestmentIncome);

  add('deductionHeading', 'Deductions', null, 'heading');
  if (L.itemizing) add('itemized', 'Itemized deductions (more than the standard deduction)', L.itemizedDeductions, 'sub');
  else add('standardDeduction', 'Standard deduction', L.baseStandardDeduction, 'sub');
  if (nonZero(L.additional65Deduction)) add('additional65', 'Additional standard deduction, age 65 or older', L.additional65Deduction, 'sub');
  if (nonZero(L.seniorDeduction)) add('senior', 'Senior deduction (2025–2028)', L.seniorDeduction, 'sub');
  if (nonZero(L.qbiDeduction)) add('qbi', 'Qualified business income (QBI) deduction', L.qbiDeduction, 'sub');
  add('taxableIncome', 'Taxable income (Form 1040 line 15)', L.taxableIncome, 'total');

  add('ordinaryHeading', 'Ordinary income tax', null, 'heading');
  add('ordinaryTaxable', 'Taxable ordinary income after deductions (taxable income less gains and qualified dividends)', L.ordinaryTaxableIncome, 'line');
  bracketSlices(0, L.ordinaryTaxableIncome, getBrackets(filingStatus, year), rateShift).forEach((sl, i) =>
    add(`ordinary${i}`, `${pct(sl.rate)} on ${Math.round(sl.amount).toLocaleString('en-US')}`, sl.tax, 'bracket', sl),
  );
  add('ordinaryTax', 'Ordinary income tax', r.ordinaryTax, 'total');

  if (L.preferentialIncome > 0) {
    add('gainsHeading', 'Capital-gains tax', null, 'heading');
    const cg = getYearData(CAPITAL_GAINS_BRACKETS, year).data[filingStatus];
    // Gains sit on top of ordinary taxable income, up to total taxable income.
    bracketSlices(L.ordinaryTaxableIncome, L.taxableIncome, cg).forEach((sl, i) =>
      add(`gains${i}`, `${pct(sl.rate)} on ${Math.round(sl.amount).toLocaleString('en-US')}`, sl.tax, 'bracket', sl),
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
    add('payrollTax', 'Payroll tax (with each earned income above)', r.payrollTax, 'line');
    add('totalTax', 'Total federal tax', r.totalTax, 'total');
  }
  return rows;
}
