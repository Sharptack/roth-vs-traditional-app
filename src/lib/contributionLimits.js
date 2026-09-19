// IRS contribution-limit check for the "Savings for retirement" amount.
import { CONTRIBUTION_LIMITS } from '../data/contributionLimits.js';
import { getYearData } from './yearLookup.js';
import { ACCOUNT_TYPES, CONTRIBUTION_LIMIT_THRESHOLD } from './constants.js';

// -> { atLimit, overLimit, limit, year, message }
//   atLimit   true when amount >= 90% of the limit (this includes over the limit)
//   overLimit true when amount is above the limit
//   year      the year the limit data actually belongs to (may be older than the
//             requested year if that year's data has not been added yet)
//   message   user-facing text, or '' when not at/near the limit
export function checkContributionLimit(amount, accountType, year) {
  const { year: dataYear, data } = getYearData(CONTRIBUTION_LIMITS, year);
  const limit = data[accountType];
  if (limit === undefined) throw new Error(`Unknown account type: ${accountType}`);

  const atLimit = amount >= CONTRIBUTION_LIMIT_THRESHOLD * limit;
  const overLimit = amount > limit;
  const label = ACCOUNT_TYPES[accountType];
  const formattedLimit = `$${limit.toLocaleString('en-US')}`;

  let message = '';
  if (atLimit) {
    const lead = overLimit
      ? `Your savings amount is above the ${dataYear} ${label} contribution limit of ${formattedLimit}. `
      : `You're at/near the ${dataYear} ${label} contribution limit of ${formattedLimit}. `;
    message =
      lead +
      'At the limit, Roth contributions shelter more real after-tax wealth than Traditional, ' +
      'independent of tax rate — a fuller comparison for this case is planned for a future version.';
  }
  return { atLimit, overLimit, limit, year: dataYear, message };
}
