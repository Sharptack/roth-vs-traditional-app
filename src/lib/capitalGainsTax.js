// Long-term capital gains tax, stacked on top of ordinary income — NOT a flat
// rate. The IRS taxes gains as if they sit on top of your ordinary taxable
// income: gains that fall in the 0% bracket owe nothing, gains that straddle a
// threshold are split, and so on. This is the same "stack one amount on top of
// another and read off each bracket" pattern used for the Social Security
// phase-in (socialSecurityTax.js), applied here to the capital-gains brackets
// instead of the ordinary ones. Method: IRS Qualified Dividends and Capital
// Gain Tax Worksheet.
//
// One consequence worth knowing: retirees with modest ordinary income often
// land partly or fully in the 0% bracket, so a taxable-account withdrawal can
// be cheaper than it looks. This calculator now reflects that instead of
// assuming a flat rate.
//
// Not modeled: the Net Investment Income Tax (see the data file).
import { CAPITAL_GAINS_BRACKETS } from '../data/capitalGainsBrackets.js';
import { getYearData } from './yearLookup.js';

// grossOrdinaryIncome: ordinary income BEFORE the standard deduction (e.g.
//   pre-tax withdrawals + taxable Social Security). Needed here, not just the
//   already-deducted ordinaryTaxableIncome, because any of the standard
//   deduction left unused by ordinary income shelters gains too.
// gainsAmount: the long-term capital gain being realized this year.
// standardDeduction: from taxCalculations.getStandardDeduction (shared, so the
//   two calculations can never use different deduction amounts).
export function calculateCapitalGainsTax(
  grossOrdinaryIncome,
  gainsAmount,
  standardDeduction,
  filingStatus,
  year,
) {
  if (!(gainsAmount > 0)) return 0;

  const { data } = getYearData(CAPITAL_GAINS_BRACKETS, year);
  const brackets = data[filingStatus];
  if (!brackets) throw new Error(`Unknown filing status: ${filingStatus}`);

  // Ordinary income fills the standard deduction first; gains stack on top of
  // whatever taxable income is left, using total (ordinary + gains) taxable
  // income to find where the stack starts and ends.
  const ordinaryTaxableIncome = Math.max(0, grossOrdinaryIncome - standardDeduction);
  const totalTaxableIncome = Math.max(0, grossOrdinaryIncome + gainsAmount - standardDeduction);
  const gainsInBrackets = totalTaxableIncome - ordinaryTaxableIncome;
  if (gainsInBrackets <= 0) return 0;

  let tax = 0;
  let bottom = 0;
  const stackTop = ordinaryTaxableIncome + gainsInBrackets;
  for (const { rate, upTo } of brackets) {
    if (bottom >= stackTop) break;
    const rangeBottom = Math.max(bottom, ordinaryTaxableIncome);
    const rangeTop = Math.min(stackTop, upTo);
    if (rangeTop > rangeBottom) tax += (rangeTop - rangeBottom) * rate;
    bottom = upTo;
  }
  return tax;
}
