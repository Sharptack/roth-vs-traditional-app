// FICA (Social Security + Medicare payroll tax), employee share.
//
// It matters here because it comes out of your paycheck today but does not exist
// in retirement: take-home pay is gross income minus income tax AND FICA, so
// leaving FICA out overstates the after-tax lifestyle you need to replace.
//
// Applied to gross wages regardless of 401(k)/IRA choice (Pre-tax deferrals
// reduce income tax, not FICA).
//
// Simplification: for married filing jointly the income is treated as one
// earner's, so the Social Security portion stops at a single wage base. A
// two-earner couple with a combined income above the wage base would really pay
// somewhat more. (Same simplification the Social Security benefit estimator
// makes.)
import { FICA_RATES } from '../data/ficaRates.js';
import { getYearData } from './yearLookup.js';

export function calculateFica(grossWages, filingStatus, year) {
  const { data } = getYearData(FICA_RATES, year);
  const threshold = data.additionalMedicare.threshold[filingStatus];
  if (threshold === undefined) throw new Error(`Unknown filing status: ${filingStatus}`);

  const wages = Math.max(0, grossWages);
  const socialSecurity = data.socialSecurityRate * Math.min(wages, data.wageBase);
  const medicare = data.medicareRate * wages;
  const additionalMedicare = data.additionalMedicare.rate * Math.max(0, wages - threshold);
  return {
    socialSecurity,
    medicare,
    additionalMedicare,
    total: socialSecurity + medicare + additionalMedicare,
  };
}
