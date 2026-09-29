// Roth vs. Pre-tax for the contributions made while income is LOW, when the saver expects to
// earn more later. Feeds the Visualization page's "earning more later" charts. Pure and
// framework-free; the tax rules are the same ones compare.js uses (calculateSideAwareRates,
// splitAtTakeHome, the Social Security estimator), only the income path is new.
//
// Why a separate function. compare.js holds income flat: Future Contributions are the same
// amount every year until retirement, and nothing else is saved. A higher future income changes
// the answer through what it adds to the retirement tax stack, not through the retirement income
// number (the rates never depend on the need; see sideAwareRates.js):
//   1. The savings from the higher-earning years are withdrawn in retirement too, so they sit
//      under today's contributions in the stack, like an Existing Account.
//   2. Social Security is based on the higher career earnings, so it is bigger.
//
// The income path (single filer, all W-2):
//   currentAge .. raiseAge        earns incomeNow; saves savingsRate * incomeNow a year. THESE
//                                 contributions are the Roth-or-Pre-tax decision being measured
//                                 (at today's marginal rate, same take-home cost either way, the
//                                 IRS limit handled exactly like compare.js's splitAtTakeHome).
//   raiseAge .. retirementAge     earns incomeLater; saves savingsRate * incomeLater a year, held
//                                 laterRothShare Roth / the rest Pre-tax, up to the IRS limit at
//                                 raiseAge; anything over the limit goes to a taxable account
//                                 (every contributed dollar is cost basis).
// Social Security: the estimator's AIME is the average of each working year's earnings (capped
// at the wage base) from today to retirement, instead of today's income alone.
// Withdrawals: 4% of every balance in the first retirement year, as everywhere else.
import { calculateTaxFromGross } from './taxCalculations.js';
import { checkContributionLimit } from './contributionLimits.js';
import { splitAtTakeHome, winnerOf } from './compare.js';
import { futureValueAnnuity, futureValueLumpSum } from './growthCalculations.js';
import { estimateSocialSecurityBenefit } from './socialSecurity.js';
import { calculateSideAwareRates } from './sideAwareRates.js';
import { getYearData } from './yearLookup.js';
import { FICA_RATES } from '../data/ficaRates.js';
import { WITHDRAWAL_RATE } from './constants.js';

// -> the same point shape as scenarios.js's runScenarioPoint (taxSavedNow, effectiveRetirement,
//    gap, rothAfterTax, pretaxAfterTax, advantagePct, overLimit, winner), plus `detail`.
export function compareWithRisingIncome({
  incomeNow,
  incomeLater,
  currentAge,
  raiseAge,
  retirementAge,
  savingsRate,
  laterRothShare = 0, // 0 = the later savings are all Pre-tax, 1 = all Roth
  filingStatus = 'single',
  accountType = '401k',
  returnRate,
  year,
}) {
  if (!(currentAge < raiseAge && raiseAge <= retirementAge)) {
    throw new Error('Ages must satisfy currentAge < raiseAge <= retirementAge.');
  }
  const years = retirementAge - currentAge;
  const yearsNow = raiseAge - currentAge;
  const yearsLater = retirementAge - raiseAge;
  // Contributions made each year for `n` years, then left to grow until retirement.
  const grownStream = (payment, n) =>
    futureValueLumpSum(futureValueAnnuity(payment, returnRate, n), returnRate, years - n);

  // The decision: today's contributions, at today's marginal rate.
  const marginalRate = calculateTaxFromGross(incomeNow, filingStatus, year).marginalRate;
  const savingsNow = savingsRate * incomeNow;
  const limitNow = checkContributionLimit(savingsNow, accountType, year, currentAge).limit;
  const split = splitAtTakeHome(savingsNow, 'pretax', marginalRate, limitNow);
  const W = WITHDRAWAL_RATE * grownStream(split.pretax.toAccount, yearsNow);
  const RW = WITHDRAWAL_RATE * grownStream(split.roth.toAccount, yearsNow);
  const side = (excess) => {
    const withdrawal = WITHDRAWAL_RATE * grownStream(excess, yearsNow);
    const value = withdrawal / WITHDRAWAL_RATE;
    return { withdrawal, gains: value > 0 ? withdrawal * Math.max(0, 1 - (excess * yearsNow) / value) : 0 };
  };
  const pretaxSide = side(split.pretax.excessToTaxable);
  const rothSide = side(split.roth.excessToTaxable);

  // The later, higher-earning years' savings: already in the stack in retirement.
  const savingsLater = savingsRate * incomeLater;
  const limitLater = checkContributionLimit(savingsLater, accountType, year, raiseAge).limit;
  const toAccountLater = Math.min(savingsLater, limitLater);
  const excessLater = savingsLater - toAccountLater;
  const laterValue = (payment) => futureValueAnnuity(payment, returnRate, yearsLater);
  const laterTaxable = laterValue(excessLater);
  const other = {
    pretaxGross: WITHDRAWAL_RATE * laterValue(toAccountLater * (1 - laterRothShare)),
    roth: WITHDRAWAL_RATE * laterValue(toAccountLater * laterRothShare),
    taxableGross: WITHDRAWAL_RATE * laterTaxable,
    taxableGains: laterTaxable > 0 ? WITHDRAWAL_RATE * (laterTaxable - excessLater * yearsLater) : 0,
  };

  // Social Security from the average of the whole working path.
  const { wageBase } = getYearData(FICA_RATES, year).data;
  const averageEarnings =
    (yearsNow * Math.min(incomeNow, wageBase) + yearsLater * Math.min(incomeLater, wageBase)) / years;
  const ssBenefit = estimateSocialSecurityBenefit({ annualIncome: averageEarnings, currentAge, retirementAge, year })
    .annualBenefit;

  const s = calculateSideAwareRates({
    other,
    ssBenefit,
    filingStatus,
    year,
    pretaxAccountWithdrawal: W,
    rothAccountWithdrawal: RW,
    pretaxSide,
    rothSide,
  });
  // After-tax income each scenario's Future Contributions deliver: withdrawals minus the extra
  // tax they cause on top of Social Security + the later savings (the same attribution as compare.js).
  const rothAfterTax = RW + rothSide.withdrawal - (s.stacks.rothWorld.totalTax - s.stacks.existing.totalTax);
  const pretaxAfterTax = W + pretaxSide.withdrawal - (s.stacks.preTaxWorld.totalTax - s.stacks.existing.totalTax);

  return {
    taxSavedNow: s.taxSavedNow,
    effectiveRetirement: s.effectiveRate,
    gap: s.gap,
    rothAfterTax,
    pretaxAfterTax,
    advantagePct: ((rothAfterTax - pretaxAfterTax) / pretaxAfterTax) * 100,
    overLimit: split.roth.excessToTaxable > 0 || split.pretax.excessToTaxable > 0,
    winner: winnerOf(rothAfterTax, pretaxAfterTax),
    detail: { marginalRate, split, accountWithdrawal: W, averageEarnings, ssBenefit, other },
  };
}
