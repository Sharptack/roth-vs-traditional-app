// The FULL line-by-line tax calculation for one retirement-year income stack: every
// ordinary bracket's slice and tax, every capital-gains bracket's slice and tax, the
// Social Security taxability math, and the NIIT math. This is the same arithmetic as
// calculateRetirementTax (retirementTaxStack.js) — same bracket tables, same stacking
// order — just decomposed into rows instead of collapsed into totals, for a "show your
// work" display. The two must always agree on totalTax (tested).
import { TAX_BRACKETS } from '../data/taxBrackets.js';
import { CAPITAL_GAINS_BRACKETS } from '../data/capitalGainsBrackets.js';
import { NIIT_RATES } from '../data/niitRates.js';
import { getStandardDeduction } from './taxCalculations.js';
import { calculateTaxableSocialSecurity } from './socialSecurityTax.js';
import { getYearData } from './yearLookup.js';
import { ageDeductions } from './yearTax.js';

// taxRules (optional): the same rules calculateRetirementTax takes (thresholdScale, rateShift,
// ages), so the breakdown matches it whichever way the stack was taxed.
export function explainFullTax({
  pretaxWithdrawal = 0,
  taxableWithdrawal = 0,
  taxableGainShare = 1,
  ssBenefit = 0,
  filingStatus,
  year,
  taxRules,
}) {
  const thresholdScale = taxRules?.thresholdScale ?? 1;
  const rateShift = taxRules?.rateShift ?? 0;
  const capitalGains = taxableWithdrawal * taxableGainShare;
  const taxableBasis = taxableWithdrawal - capitalGains;
  const taxableSS = calculateTaxableSocialSecurity(pretaxWithdrawal + capitalGains, ssBenefit, filingStatus, year, thresholdScale);
  const baseStandardDeduction = getStandardDeduction(filingStatus, year);
  const grossOrdinaryIncome = pretaxWithdrawal + taxableSS;
  const age = ageDeductions(
    (taxRules?.ages ?? []).map((a) => ({ age: a })),
    filingStatus,
    year,
    grossOrdinaryIncome + capitalGains,
    { calendarYear: taxRules?.calendarYear ?? year, thresholdScale },
  );
  // Itemizing (taxRules.itemizedDeductions, when larger) replaces the standard deduction and its 65+
  // extra; the senior deduction applies either way (as yearTax.js).
  const itemized = Math.max(0, taxRules?.itemizedDeductions ?? 0);
  const itemizing = itemized > baseStandardDeduction + age.additional65;
  const standardDeduction = (itemizing ? itemized : baseStandardDeduction + age.additional65) + age.senior;
  const ordinaryTaxableIncome = Math.max(0, grossOrdinaryIncome - standardDeduction);

  // Ordinary brackets: each row is the slice of ordinaryTaxableIncome inside that bracket.
  const { data: bracketYear } = getYearData(TAX_BRACKETS, year);
  const ordinaryBrackets = bracketYear.brackets[filingStatus];
  const ordinaryRows = [];
  let ordinaryTax = 0;
  let bottom = 0;
  for (const { rate, upTo } of ordinaryBrackets) {
    if (ordinaryTaxableIncome <= bottom) break;
    const amount = Math.min(ordinaryTaxableIncome, upTo) - bottom;
    const tax = amount * (rate + rateShift);
    ordinaryRows.push({ rate: rate + rateShift, from: bottom, to: Math.min(ordinaryTaxableIncome, upTo), amount, tax });
    ordinaryTax += tax;
    bottom = upTo;
  }

  // Capital-gains brackets: gains are stacked ON TOP of ordinaryTaxableIncome, so each
  // row is the slice of the COMBINED total that falls above ordinaryTaxableIncome.
  const { data: gainsBracketYear } = getYearData(CAPITAL_GAINS_BRACKETS, year);
  const gainsBrackets = gainsBracketYear[filingStatus];
  const totalTaxableIncome = Math.max(0, grossOrdinaryIncome + capitalGains - standardDeduction);
  const stackTop = ordinaryTaxableIncome + Math.max(0, totalTaxableIncome - ordinaryTaxableIncome);
  const gainsRows = [];
  let capitalGainsTax = 0;
  let cgBottom = 0;
  for (const { rate, upTo } of gainsBrackets) {
    if (cgBottom >= stackTop) break;
    const rangeBottom = Math.max(cgBottom, ordinaryTaxableIncome);
    const rangeTop = Math.min(stackTop, upTo);
    if (rangeTop > rangeBottom) {
      const amount = rangeTop - rangeBottom;
      const tax = amount * rate;
      gainsRows.push({ rate, from: rangeBottom, to: rangeTop, amount, tax });
      capitalGainsTax += tax;
    }
    cgBottom = upTo;
  }

  const magi = grossOrdinaryIncome + capitalGains;
  const { data: niitYear } = getYearData(NIIT_RATES, year);
  const niitThreshold = niitYear.threshold[filingStatus] * thresholdScale;
  const niitBase = Math.min(Math.max(0, capitalGains), Math.max(0, magi - niitThreshold));
  const niit = niitYear.rate * niitBase;

  return {
    ssBenefit,
    taxableSS,
    pretaxWithdrawal,
    grossOrdinaryIncome,
    baseStandardDeduction,
    additional65Deduction: age.additional65,
    seniorDeduction: age.senior,
    standardDeduction, // the total of the three above
    ordinaryTaxableIncome,
    ordinaryRows,
    ordinaryTax,
    taxableWithdrawal,
    taxableBasis,
    capitalGains,
    gainsRows,
    capitalGainsTax,
    magi,
    niitThreshold,
    niitRate: niitYear.rate,
    niitBase,
    niit,
    totalTax: ordinaryTax + capitalGainsTax + niit,
  };
}
