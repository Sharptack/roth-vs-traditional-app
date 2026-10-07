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
import { calculateYearTaxTotals } from './yearTax.js';

// taxRules (optional; the #/next preview): { thresholdScale, rateShift, ages, calendarYear }:
// fixed-dollar thresholds scaled for inflation, a rate what-if, and the age 65+ deductions for the
// given ages. Without it, today's rules (the current calculator).
//
// One engine: this is the single-year engine (yearTax.js) with only retirement income. It used to
// carry its own copy of the rules for the current calculator; the agreement grids in
// tests/yearTax.test.js prove the two gave identical results to the cent, so the copy was removed
// (2026-10-07) and every caller now shares one implementation.
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
  const r = calculateYearTaxTotals({
    filingStatus,
    year,
    people: (taxRules?.ages ?? []).map((age) => ({ age })),
    income: { ordinaryIncome: pretaxWithdrawal, preferentialIncome: capitalGains, socialSecurity: ssBenefit },
    thresholdScale: taxRules?.thresholdScale ?? 1,
    rateShift: taxRules?.rateShift ?? 0,
    calendarYear: taxRules?.calendarYear ?? year,
  });
  return {
    taxableSS: r.lines.taxableSocialSecurity,
    grossOrdinaryIncome: r.lines.ordinaryGross, // before the standard deduction
    capitalGains, // the taxed part of the taxable-account withdrawal
    ordinaryTaxableIncome: r.lines.ordinaryTaxableIncome,
    ordinaryTax: r.ordinaryTax,
    capitalGainsTax: r.capitalGainsTax,
    magi: r.lines.magi, // modified AGI for the NIIT
    niit: r.niit, // Net Investment Income Tax on the gains
    totalTax: r.incomeTax,
    standardDeduction: r.lines.standardDeduction,
  };
}
