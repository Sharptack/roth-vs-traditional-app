// IRS contribution-limit lookups for the "Savings for retirement" amount.
import { CONTRIBUTION_LIMITS } from '../data/contributionLimits.js';
import { getYearData } from './yearLookup.js';
import { ACCOUNT_TYPES, CONTRIBUTION_LIMIT_THRESHOLD } from './constants.js';

// Catch-up contributions (age 50+, and SECURE 2.0's higher 401(k) tier for
// ages 60-63 specifically) on top of the base limit. `age` is the saver's
// CURRENT age. Simplification: like the base limits and tax brackets
// elsewhere in this app, this is a snapshot at today's age/today's rules,
// held constant across the whole projection horizon — it does NOT model
// aging into (or out of) a catch-up tier over a multi-decade projection, the
// same way it doesn't model the limit itself rising in future years.
function catchUpAmount(entry, age) {
  if (!(age >= 50)) return 0;
  if (entry.catchUp60to63 !== undefined && age >= 60 && age <= 63) return entry.catchUp60to63;
  return entry.catchUp50 ?? 0;
}

// Looks up the IRS elective-deferral limit (base + any catch-up) for an
// account type/year/age. Shared by checkContributionLimit (the UI warning)
// and splitAtContributionLimit (the excess-to-taxable redirect) so the two
// never disagree. To add a year, edit src/data/contributionLimits.js —
// nothing here needs to change.
function getLimit(accountType, year, age = 0) {
  const { year: dataYear, data } = getYearData(CONTRIBUTION_LIMITS, year);
  const entry = data[accountType];
  if (entry === undefined) throw new Error(`Unknown account type: ${accountType}`);
  const catchUp = catchUpAmount(entry, age);
  return { limit: entry.base + catchUp, base: entry.base, catchUp, year: dataYear };
}

// -> { atLimit, overLimit, limit, base, catchUp, year, message }
//   atLimit   true when amount >= 90% of the limit (this includes over the limit)
//   overLimit true when amount is above the limit
//   catchUp   the catch-up amount included in `limit` (0 if the saver is under 50
//             or none was provided)
//   year      the year the limit data actually belongs to (may be older than the
//             requested year if that year's data has not been added yet)
//   message   user-facing text, or '' when not at/near the limit
// `age` is optional; omit it (or pass < 50) to check against the base limit only.
export function checkContributionLimit(amount, accountType, year, age) {
  const { limit, base, catchUp, year: dataYear } = getLimit(accountType, year, age);
  const atLimit = amount >= CONTRIBUTION_LIMIT_THRESHOLD * limit;
  const overLimit = amount > limit;
  const label = ACCOUNT_TYPES[accountType];
  const formattedLimit = `$${limit.toLocaleString('en-US')}`;
  const catchUpNote =
    catchUp > 0
      ? ` (that includes a $${catchUp.toLocaleString('en-US')} catch-up contribution for being 50 or older)`
      : '';

  let message = '';
  if (atLimit) {
    if (overLimit) {
      const excess = amount - limit;
      message =
        `Your savings amount is above the ${dataYear} ${label} contribution limit of ` +
        `${formattedLimit}${catchUpNote}. The extra $${Math.round(excess).toLocaleString('en-US')}/year can't ` +
        `legally go into a ${label}, so it's modeled as going into a taxable investment account ` +
        'instead — see the total portfolio comparison below.';
    } else {
      message =
        `You're at/near the ${dataYear} ${label} contribution limit of ${formattedLimit}${catchUpNote}. ` +
        'Where one side\'s equivalent contribution won\'t fit under the limit (a Pre-tax contribution ' +
        'costs less take-home pay, so its equivalent is larger), the rest of the same take-home pay goes to a ' +
        'taxable account instead. Both sides include it.';
    }
  }
  return { atLimit, overLimit, limit, base, catchUp, year: dataYear, message };
}

// Anything above the IRS limit can't legally go into the tax-advantaged account
// being modeled, so it's split off and modeled as an additional contribution to
// a taxable investment account instead (see compare.js, which grows it the same
// way as other taxable-account money and taxes it via the real capital-gains
// brackets at withdrawal — capitalGainsTax.js).
// `age` is optional; omit it (or pass < 50) to cap at the base limit only.
// -> { toAccount, excessToTaxable, limit, base, catchUp, year }
export function splitAtContributionLimit(amount, accountType, year, age) {
  const { limit, base, catchUp, year: dataYear } = getLimit(accountType, year, age);
  const safeAmount = Math.max(0, amount);
  return {
    toAccount: Math.min(safeAmount, limit),
    excessToTaxable: Math.max(0, safeAmount - limit),
    limit,
    base,
    catchUp,
    year: dataYear,
  };
}
