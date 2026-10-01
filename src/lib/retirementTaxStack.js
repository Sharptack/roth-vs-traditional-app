// Federal tax on one year of retirement income, given what is being withdrawn
// from each kind of account. Shared by sideAwareRates.js (the Section 2 rate
// comparison) and portfolioTax.js (the Section 3 solver) so the two can never
// drift apart on the tax rules.
//
// Rules applied:
//   - Social Security taxability is computed from "other income" =
//       pre-tax withdrawals + taxable-account withdrawals
//     (Roth withdrawals are tax-free and are NOT part of combined income.)
//   - Ordinary tax applies to (pre-tax withdrawals + taxable Social Security
//     - standard deduction), through the progressive brackets.
//   - Taxable-account withdrawals: only the GAIN part (taxableGainShare of the
//     withdrawal; the rest is cost basis coming back, untaxed) counts toward
//     Social Security combined income and is taxed. Withdrawals are split
//     pro-rata between basis and gain. The default share of 1 treats the whole
//     withdrawal as gain. The gain is treated as long-term capital gain and taxed via the REAL 0% / 15% / 20% capital-gains brackets,
//     stacked on top of ordinary income (see capitalGainsTax.js) — NOT a flat
//     rate. Many retirees with modest other income pay 0% on some or all of a
//     taxable-account withdrawal.
//   - Net Investment Income Tax: 3.8% on the gain, limited to MAGI above
//     $200,000 Single / $250,000 MFJ. MAGI = Pre-tax withdrawals + taxable
//     Social Security + gains (Roth withdrawals and cost basis are in neither).
import { calculateTax, getStandardDeduction } from './taxCalculations.js';
import { calculateTaxableSocialSecurity } from './socialSecurityTax.js';
import { calculateCapitalGainsTax, calculateNiit } from './capitalGainsTax.js';
import { calculateYearTax } from './yearTax.js';

// taxRules (optional; the #/next preview): { thresholdScale, rateShift, ages, calendarYear } — when given, the
// year is taxed by the single-year engine (yearTax.js) with those rules: fixed-dollar thresholds
// scaled for inflation, a rate what-if, and the age 65+ deductions for the given ages. Without it,
// the code below runs exactly as before (the current calculator). Both agree to the cent when the
// rules are neutral (tested).
export function calculateRetirementTax({
  pretaxWithdrawal = 0,
  taxableWithdrawal = 0,
  taxableGainShare = 1,
  ssBenefit = 0,
  filingStatus,
  year,
  taxRules,
}) {
  const capitalGains = taxableWithdrawal * taxableGainShare;
  if (taxRules) {
    const r = calculateYearTax({
      filingStatus,
      year,
      people: (taxRules.ages ?? []).map((age) => ({ age })),
      income: { ordinaryIncome: pretaxWithdrawal, preferentialIncome: capitalGains, socialSecurity: ssBenefit },
      thresholdScale: taxRules.thresholdScale ?? 1,
      rateShift: taxRules.rateShift ?? 0,
      calendarYear: taxRules.calendarYear ?? year,
    });
    return {
      taxableSS: r.lines.taxableSocialSecurity,
      grossOrdinaryIncome: r.lines.ordinaryGross,
      capitalGains,
      ordinaryTaxableIncome: r.lines.ordinaryTaxableIncome,
      ordinaryTax: r.ordinaryTax,
      capitalGainsTax: r.capitalGainsTax,
      magi: r.lines.magi,
      niit: r.niit,
      totalTax: r.incomeTax,
      standardDeduction: r.lines.standardDeduction,
    };
  }
  const taxableSS = calculateTaxableSocialSecurity(
    pretaxWithdrawal + capitalGains,
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
    capitalGains,
    standardDeduction,
    filingStatus,
    year,
  );
  const magi = grossOrdinaryIncome + capitalGains;
  const niit = calculateNiit(magi, capitalGains, filingStatus, year);
  return {
    taxableSS,
    grossOrdinaryIncome, // before the standard deduction
    capitalGains, // the taxed part of the taxable-account withdrawal
    ordinaryTaxableIncome,
    ordinaryTax,
    capitalGainsTax,
    magi, // modified AGI for the NIIT
    niit, // Net Investment Income Tax on the gains
    totalTax: ordinaryTax + capitalGainsTax + niit,
  };
}
