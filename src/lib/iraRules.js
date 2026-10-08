// Who can contribute to what (round 2 phase 1). Pure. The Roth vs. Pre-tax comparison should only
// compare choices the client actually has:
//   - a Roth IRA contribution shrinks, then stops, as income rises;
//   - a Traditional IRA contribution stops being deductible (so it is no longer Pre-tax) for
//     someone covered by a workplace plan, or whose spouse is, as income rises;
//   - from 2026, a higher earner's 401(k) catch-up contributions must be Roth.
// Ranges are on modified AGI (data/iraRules.js). A backdoor Roth (a nondeductible Traditional IRA
// contribution converted to Roth) is outside this app.
import { IRA_RULES } from '../data/iraRules.js';
import { checkContributionLimit } from './contributionLimits.js';
import { getYearData } from './yearLookup.js';

// The IRS reduction across a phase-out range (Pub. 590-A worksheets): the limit times the share of
// the range still above MAGI, rounded UP to the next $10, and at least $200 while anything is left.
// -> the reduced amount (the full limit below the range, 0 at or above its top)
export function phasedOut(limit, magi, { from, to }) {
  if (magi <= from) return limit;
  if (magi >= to) return 0;
  const reduced = Math.ceil((limit * (to - magi)) / (to - from) / 10 - 1e-9) * 10;
  return Math.min(limit, Math.max(200, reduced));
}

const iraLimit = (year, age) => checkContributionLimit(0, 'ira', year, age).limit;
const statusOf = (filingStatus) => (filingStatus === 'mfj' ? 'mfj' : 'single');

// The most this person may put into a Roth IRA this year.
// -> { allowed, limit (the IRA limit at this age), range, status: 'full' | 'reduced' | 'none' }
export function rothIraLimit({ magi, filingStatus, year, age }) {
  const { data } = getYearData(IRA_RULES, year);
  const range = data.rothIra[statusOf(filingStatus)];
  const limit = iraLimit(year, age);
  const allowed = phasedOut(limit, magi, range);
  return { allowed, limit, range, status: allowed === limit ? 'full' : allowed > 0 ? 'reduced' : 'none' };
}

// How much of a Traditional IRA contribution this person may deduct.
//  covered: this person is covered by a workplace retirement plan; spouseCovered: their spouse is
//  (joint returns only).
// -> { deductible, limit, range (null when no phase-out applies), status }
export function traditionalIraDeduction({ magi, filingStatus, year, age, covered, spouseCovered = false }) {
  const { data } = getYearData(IRA_RULES, year);
  const status = statusOf(filingStatus);
  const limit = iraLimit(year, age);
  const range = covered ? data.deduction.covered[status] : status === 'mfj' && spouseCovered ? data.deduction.spouseCovered.mfj : null;
  const deductible = range ? phasedOut(limit, magi, range) : limit;
  return { deductible, limit, range, status: deductible === limit ? 'full' : deductible > 0 ? 'reduced' : 'none' };
}

// Whether this person's 401(k) catch-up contributions must be Roth (SECURE 2.0 §603): FICA wages
// in the prior year above the threshold. Self-employment income isn't FICA wages, so a 1099
// earner is never caught by it.
export function catchUpMustBeRoth({ priorYearWages, year }) {
  const { data } = getYearData(IRA_RULES, year);
  return data.rothCatchUpWages !== null && priorYearWages > data.rothCatchUpWages;
}
