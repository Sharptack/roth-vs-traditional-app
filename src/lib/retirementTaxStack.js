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
//   - Taxable-account withdrawals are treated as entirely long-term capital
//     gain and taxed via the REAL 0% / 15% / 20% capital-gains brackets,
//     stacked on top of ordinary income (see capitalGainsTax.js) — NOT a flat
//     rate. Many retirees with modest other income pay 0% on some or all of a
//     taxable-account withdrawal.
import { calculateTax, getStandardDeduction } from './taxCalculations.js';
import { calculateTaxableSocialSecurity } from './socialSecurityTax.js';
import { calculateCapitalGainsTax } from './capitalGainsTax.js';

export function calculateRetirementTax({
  pretaxWithdrawal = 0,
  taxableWithdrawal = 0,
  ssBenefit = 0,
  filingStatus,
  year,
}) {
  const taxableSS = calculateTaxableSocialSecurity(
    pretaxWithdrawal + taxableWithdrawal,
    ssBenefit,
    filingStatus,
    year,
  );
  const standardDeduction = getStandardDeduction(filingStatus, year);
  const grossOrdinaryIncome = pretaxWithdrawal + taxableSS;
  const ordinaryTaxableIncome = Math.max(0, grossOrdinaryIncome - standardDeduction);
  const ordinaryTax = calculateTax(ordinaryTaxableIncome, filingStatus, year);
  const capitalGainsTax = calculateCapitalGainsTax(
    grossOrdinaryIncome,
    taxableWithdrawal,
    standardDeduction,
    filingStatus,
    year,
  );
  return {
    taxableSS,
    grossOrdinaryIncome, // before the standard deduction
    ordinaryTaxableIncome,
    ordinaryTax,
    capitalGainsTax,
    totalTax: ordinaryTax + capitalGainsTax,
  };
}
