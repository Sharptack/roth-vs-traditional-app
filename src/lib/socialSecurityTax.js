// How much of a KNOWN Social Security benefit is taxable, using the IRS
// combined-income formula (IRC §86; IRS Pub. 915 worksheet).
//
// (Estimating the benefit itself is a separate concern — see socialSecurity.js.)
//
//   combined income = other income + 50% of the SS benefit
//
//   combined <= lower threshold  -> 0 taxable
//   lower < combined <= upper    -> min(50% of excess over lower, 50% of benefit)
//   combined > upper             -> min( 85% of benefit,
//                                        85% of excess over upper
//                                          + min(50% of benefit, 50% of the band width) )
//
// where the band width is (upper - lower): $9,000 Single, $12,000 MFJ. Half of
// that — $4,500 Single / $6,000 MFJ — is the most the 50% tier can contribute,
// and it is what the IRS worksheet (lines 9-13) uses in the 85% tier.
//
// This is what creates the marginal-rate "bump" during phase-in: each extra
// dollar of other income drags 50 cents (then 85 cents) of benefits into
// taxable income too, so the real marginal rate is 1.5x (then 1.85x) the
// bracket rate. No hardcoded bump table is needed.
import { SS_TAX_THRESHOLDS } from '../data/ssTaxThresholds.js';
import { getYearData } from './yearLookup.js';

export function calculateTaxableSocialSecurity(otherIncome, ssBenefit, filingStatus, year) {
  if (!(ssBenefit > 0)) return 0;

  const { data } = getYearData(SS_TAX_THRESHOLDS, year);
  const thresholds = data[filingStatus];
  if (!thresholds) throw new Error(`Unknown filing status: ${filingStatus}`);
  const { lower, upper } = thresholds;

  const combinedIncome = Math.max(0, otherIncome) + 0.5 * ssBenefit;
  if (combinedIncome <= lower) return 0;

  const halfBenefit = 0.5 * ssBenefit;

  // 50% tier
  const fiftyPercentTier = Math.min(
    0.5 * (Math.min(combinedIncome, upper) - lower),
    halfBenefit,
  );
  if (combinedIncome <= upper) return fiftyPercentTier;

  // 85% tier
  const eightyFivePercentTier = 0.85 * (combinedIncome - upper);
  return Math.min(0.85 * ssBenefit, eightyFivePercentTier + fiftyPercentTier);
}
