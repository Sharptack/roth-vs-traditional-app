// IRS contribution-limit lookups for the "Savings for retirement" amount.
import { CONTRIBUTION_LIMITS } from '../data/contributionLimits.js';
import { getYearData } from './yearLookup.js';
import { ACCOUNT_TYPES, CONTRIBUTION_LIMIT_THRESHOLD } from './constants.js';

// Looks up the IRS elective-deferral limit for an account type/year. Shared by
// checkContributionLimit (the UI warning) and splitAtContributionLimit (the
// excess-to-taxable redirect) so the two never disagree on the number. To add a
// year, edit src/data/contributionLimits.js — nothing here needs to change.
function getLimit(accountType, year) {
  const { year: dataYear, data } = getYearData(CONTRIBUTION_LIMITS, year);
  const limit = data[accountType];
  if (limit === undefined) throw new Error(`Unknown account type: ${accountType}`);
  return { limit, year: dataYear };
}

// -> { atLimit, overLimit, limit, year, message }
//   atLimit   true when amount >= 90% of the limit (this includes over the limit)
//   overLimit true when amount is above the limit
//   year      the year the limit data actually belongs to (may be older than the
//             requested year if that year's data has not been added yet)
//   message   user-facing text, or '' when not at/near the limit
export function checkContributionLimit(amount, accountType, year) {
  const { limit, year: dataYear } = getLimit(accountType, year);
  const atLimit = amount >= CONTRIBUTION_LIMIT_THRESHOLD * limit;
  const overLimit = amount > limit;
  const label = ACCOUNT_TYPES[accountType];
  const formattedLimit = `$${limit.toLocaleString('en-US')}`;

  let message = '';
  if (atLimit) {
    if (overLimit) {
      const excess = amount - limit;
      message =
        `Your savings amount is above the ${dataYear} ${label} contribution limit of ` +
        `${formattedLimit}. The extra $${Math.round(excess).toLocaleString('en-US')}/year can't ` +
        `legally go into a ${label}, so it's modeled as going into a taxable investment account ` +
        'instead — see the total portfolio comparison below.';
    } else {
      message =
        `You're at/near the ${dataYear} ${label} contribution limit of ${formattedLimit}. ` +
        'At the limit, Roth contributions shelter more real after-tax wealth than Traditional, ' +
        'independent of tax rate.';
    }
  }
  return { atLimit, overLimit, limit, year: dataYear, message };
}

// Anything above the IRS limit can't legally go into the tax-advantaged account
// being modeled, so it's split off and modeled as an additional contribution to
// a taxable investment account instead (see compare.js, which grows it the same
// way as other taxable-account money and taxes it via the real capital-gains
// brackets at withdrawal — capitalGainsTax.js).
// -> { toAccount, excessToTaxable, limit, year }
export function splitAtContributionLimit(amount, accountType, year) {
  const { limit, year: dataYear } = getLimit(accountType, year);
  const safeAmount = Math.max(0, amount);
  return {
    toAccount: Math.min(safeAmount, limit),
    excessToTaxable: Math.max(0, safeAmount - limit),
    limit,
    year: dataYear,
  };
}
