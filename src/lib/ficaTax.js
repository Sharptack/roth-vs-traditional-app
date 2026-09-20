// FICA (Social Security + Medicare payroll tax) and self-employment tax.
//
// It matters here because it comes out of your paycheck today but does not exist
// in retirement: take-home pay is gross income minus income tax AND payroll tax,
// so leaving it out overstates the after-tax lifestyle you need to replace.
//
// Two kinds of earnings:
//   W-2 wages           employee share: 6.2% Social Security (to the wage base) + 1.45% Medicare.
//   1099 / self-employed  both halves: 12.4% + 2.9%, applied to 92.35% of net earnings, with the
//                       Social Security part limited by whatever wage base room W-2 wages left.
//                       Half of the self-employment tax is deductible before income tax.
// Additional Medicare (0.9%) applies to combined wages + self-employment earnings above the
// filing-status threshold.
//
// 1099 income is treated as NET earnings (after business expenses). Not modeled: the
// qualified business income (QBI) deduction, solo-401(k)/SEP contributions.
//
// Applied regardless of 401(k)/IRA choice (Pre-tax deferrals reduce income tax, not FICA).
//
// Simplification: for married filing jointly the income is treated as one earner's, so
// the Social Security portion stops at a single wage base. A two-earner couple with a
// combined income above the wage base would really pay somewhat more. (Same
// simplification the Social Security benefit estimator makes.)
import { FICA_RATES } from '../data/ficaRates.js';
import { getYearData } from './yearLookup.js';

export function calculateEmploymentTaxes({ wages = 0, selfEmploymentIncome = 0, filingStatus, year }) {
  const { data } = getYearData(FICA_RATES, year);
  const threshold = data.additionalMedicare.threshold[filingStatus];
  if (threshold === undefined) throw new Error(`Unknown filing status: ${filingStatus}`);

  const w2 = Math.max(0, wages);
  const w2SocialSecurity = data.socialSecurityRate * Math.min(w2, data.wageBase);
  const w2Medicare = data.medicareRate * w2;

  // Self-employment tax
  const se = data.selfEmployment;
  const netEarnings = Math.max(0, selfEmploymentIncome) * se.earningsFactor;
  const owesSE = netEarnings >= se.minimumEarnings;
  const wageBaseRoom = Math.max(0, data.wageBase - w2);
  const seSocialSecurity = owesSE ? se.socialSecurityRate * Math.min(netEarnings, wageBaseRoom) : 0;
  const seMedicare = owesSE ? se.medicareRate * netEarnings : 0;
  const seTax = seSocialSecurity + seMedicare;

  const additionalMedicare =
    data.additionalMedicare.rate * Math.max(0, w2 + (owesSE ? netEarnings : 0) - threshold);

  return {
    w2: { socialSecurity: w2SocialSecurity, medicare: w2Medicare },
    selfEmployment: {
      netEarnings: owesSE ? netEarnings : 0,
      socialSecurity: seSocialSecurity,
      medicare: seMedicare,
      tax: seTax,
      // Half of self-employment tax is deducted from income before income tax.
      deduction: seTax / 2,
    },
    additionalMedicare,
    total: w2SocialSecurity + w2Medicare + seTax + additionalMedicare,
  };
}

// W-2 wages only (employee share). Kept as the simple entry point.
export function calculateFica(grossWages, filingStatus, year) {
  const r = calculateEmploymentTaxes({ wages: grossWages, filingStatus, year });
  return {
    socialSecurity: r.w2.socialSecurity,
    medicare: r.w2.medicare,
    additionalMedicare: r.additionalMedicare,
    total: r.total,
  };
}
