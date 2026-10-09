// Employer contributions to a 401(k) (round 2 phase 2 step d, decided 2026-10-09): each 401(k)
// contribution row may carry the employer's contribution, entered as either
//   - a match: matchRate x the employee's deferral, on deferrals up to matchUpTo x W-2 pay
//     ("100% of the first 4%" = matchRate 1, matchUpTo 0.04), or
//   - a flat dollar amount a year.
// The deferral counted is the row's amount as entered, capped at the person's IRS deferral limit
// (rows in order, sharing it). Employer money is Pre-tax (Roth employer contributions, allowed since
// SECURE 2.0, are not modeled). The total is held to the overall limit on annual additions (IRC
// §415(c)): employee deferrals (the catch-up not counted) + employer contributions.
//
// Simplification: the match is on the deferral AS ENTERED, the same in the Roth and Pre-tax
// scenarios, though a Pre-tax deferral at the same take-home cost is larger and could earn more
// match while under the match's cap.
import { CONTRIBUTION_LIMITS } from '../data/contributionLimits.js';
import { getYearData } from './yearLookup.js';
import { checkContributionLimit } from './contributionLimits.js';

// rows: [{ amount, employer: { type: 'none' | 'match' | 'flat', matchRate, matchUpTo, amount } }]
//       (one person's 401(k) rows); wages: their W-2 pay; age: their age that year.
// -> the employer's contribution that year, dollars.
export function employerContribution({ rows, wages, year, age }) {
  if (!rows.some((r) => r.employer && r.employer.type !== 'none')) return 0;
  const { limit, base } = checkContributionLimit(0, '401k', year, age);
  let room = limit;
  let deferred = 0;
  let total = 0;
  for (const r of rows) {
    const deferral = Math.min(Math.max(0, r.amount), room);
    room -= deferral;
    deferred += deferral;
    const e = r.employer ?? { type: 'none' };
    if (e.type === 'match') total += e.matchRate * Math.min(deferral, e.matchUpTo * Math.max(0, wages));
    if (e.type === 'flat') total += Math.max(0, e.amount);
  }
  const { annualAdditions } = getYearData(CONTRIBUTION_LIMITS, year).data['401k'];
  return Math.min(total, Math.max(0, annualAdditions - Math.min(deferred, base)));
}

// A person's employer contribution that year, from a version 2 household's contribution rows
// (their Roth and Pre-tax 401(k) rows) and W-2 wages. Version 1 households have none.
export function employerContributionFor(household, person, age) {
  const rows = (household.contributionRows ?? []).filter((r) => r.owner === person.id && r.account === '401k' && r.tax !== 'taxable');
  return employerContribution({ rows, wages: person.wages, year: household.year, age });
}
