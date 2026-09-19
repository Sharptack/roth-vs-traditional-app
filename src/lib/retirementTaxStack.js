// Federal tax on one year of retirement income, given what is being withdrawn
// from each kind of account. Shared by both solvers (incomeNeed.js and
// portfolioTax.js) so the two can never drift apart on the tax rules.
//
// Rules applied:
//   - Social Security taxability is computed from "other income" =
//       pre-tax withdrawals + taxable-account withdrawals
//     (Roth withdrawals are tax-free and are NOT part of combined income.)
//   - Ordinary tax applies to (pre-tax withdrawals + taxable Social Security
//     - standard deduction), through the progressive brackets.
//   - Taxable-account withdrawals are taxed at a flat assumed capital gains
//     rate (LTCG_RATE), in addition to ordinary tax. Simplification: the whole
//     withdrawal is treated as gain, and it does not push ordinary income into
//     higher brackets.
import { calculateTax, getStandardDeduction } from './taxCalculations.js';
import { calculateTaxableSocialSecurity } from './socialSecurityTax.js';
import { LTCG_RATE } from './constants.js';

export function calculateRetirementTax({
  pretaxWithdrawal = 0,
  taxableWithdrawal = 0,
  ssBenefit = 0,
  filingStatus,
  year,
  ltcgRate = LTCG_RATE,
}) {
  const taxableSS = calculateTaxableSocialSecurity(
    pretaxWithdrawal + taxableWithdrawal,
    ssBenefit,
    filingStatus,
    year,
  );
  const ordinaryTaxableIncome = Math.max(
    0,
    pretaxWithdrawal + taxableSS - getStandardDeduction(filingStatus, year),
  );
  const ordinaryTax = calculateTax(ordinaryTaxableIncome, filingStatus, year);
  const capitalGainsTax = taxableWithdrawal * ltcgRate;
  return {
    taxableSS,
    ordinaryTaxableIncome,
    ordinaryTax,
    capitalGainsTax,
    totalTax: ordinaryTax + capitalGainsTax,
  };
}
