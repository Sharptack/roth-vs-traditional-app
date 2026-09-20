// Forward federal income-tax math: taxable income -> tax owed, marginal rate.
//
// Progressive brackets: every dollar is taxed at ITS OWN bracket's rate. We never
// apply one flat rate to the whole amount.
import { TAX_BRACKETS } from '../data/taxBrackets.js';
import { getYearData } from './yearLookup.js';

function getFilingData(filingStatus, year) {
  const { year: dataYear, data } = getYearData(TAX_BRACKETS, year);
  const brackets = data.brackets[filingStatus];
  if (!brackets) throw new Error(`Unknown filing status: ${filingStatus}`);
  return { dataYear, brackets, standardDeduction: data.standardDeduction[filingStatus] };
}

export function getStandardDeduction(filingStatus, year) {
  return getFilingData(filingStatus, year).standardDeduction;
}

// Tax owed on TAXABLE income (i.e. income already net of deductions).
export function calculateTax(taxableIncome, filingStatus, year) {
  if (!(taxableIncome > 0)) return 0;
  const { brackets } = getFilingData(filingStatus, year);
  let tax = 0;
  let bottom = 0;
  for (const { rate, upTo } of brackets) {
    if (taxableIncome <= bottom) break;
    const taxedInThisBracket = Math.min(taxableIncome, upTo) - bottom;
    tax += taxedInThisBracket * rate;
    bottom = upTo;
  }
  return tax;
}

// Marginal rate: the rate the NEXT dollar of taxable income would be taxed at.
// A bracket owns [bottom, upTo), so exactly at a boundary the next dollar is in
// the higher bracket. If taxable income is negative (income below the standard
// deduction) the next dollar is still sheltered, so the marginal rate is 0.
export function getMarginalRate(taxableIncome, filingStatus, year) {
  if (taxableIncome < 0) return 0;
  const { brackets } = getFilingData(filingStatus, year);
  for (const { rate, upTo } of brackets) {
    if (taxableIncome < upTo) return rate;
  }
  return brackets[brackets.length - 1].rate;
}

// Convenience for Section 1: gross income -> deduction, taxable income, tax,
// marginal rate, effective rate. `adjustments` are above-the-line deductions taken
// before the standard deduction (e.g. half of self-employment tax).
export function calculateTaxFromGross(grossIncome, filingStatus, year, adjustments = 0) {
  const { dataYear, standardDeduction } = getFilingData(filingStatus, year);
  const taxableIncome = Math.max(0, grossIncome - adjustments - standardDeduction);
  const tax = calculateTax(taxableIncome, filingStatus, year);
  // Marginal rate is judged on the signed figure so income under the standard
  // deduction reports 0%, not 10%.
  const marginalRate = getMarginalRate(
    grossIncome - adjustments - standardDeduction,
    filingStatus,
    year,
  );
  return {
    dataYear,
    standardDeduction,
    adjustments,
    taxableIncome,
    tax,
    marginalRate,
    effectiveRate: grossIncome > 0 ? tax / grossIncome : 0,
  };
}
