// Who can contribute to what, for the Roth vs. Pre-tax page (round 2 phase 1, the merge). Pure.
// The comparison weighs saving Roth against saving Pre-tax in the same account; these notes say
// when one of those choices isn't fully open to this household (iraRules.js has the rules):
//   - an IRA saved Roth: the Roth IRA income limit may cut the Roth side down, or out;
//   - an IRA saved Pre-tax: for someone covered by a workplace plan (or whose spouse is), the
//     deduction phases out with income, and a contribution that can't be deducted isn't Pre-tax;
//   - a 401(k) with catch-up contributions: from 2026, above $150,000 of prior-year wages they
//     must be Roth, so the Pre-tax side can only defer up to the base limit.
// Both sides of the comparison are checked whichever way the person saves today. "Covered by a
// workplace plan" is read from the contribution rows (any 401(k) row). Modified AGI is this year's
// AGI from the tax engine. This year's wages stand in for last year's.
import { calculateYearTaxTotals } from './yearTax.js';
import { householdToYearTaxParams } from './taxCalculator.js';
import { catchUpMustBeRoth, rothIraLimit, traditionalIraDeduction } from './iraRules.js';
import { checkContributionLimit } from './contributionLimits.js';
import { formatCurrency as $ } from './format.js';

// -> [{ owner, kind: 'rothIra' | 'iraDeduction' | 'rothCatchUp', status: 'reduced' | 'none' | 'roth', message }]
export function contributionNotes(household) {
  const { year, people, filingStatus } = household;
  const rows = household.contributionRows ?? [];
  if (rows.length === 0) return [];
  const magi = calculateYearTaxTotals(householdToYearTaxParams(household)).lines.magi;
  const ageOf = (p) => year - p.birthYear;
  const has401k = (owner) => rows.some((r) => r.owner === owner && r.account === '401k' && r.tax !== 'taxable');
  const who = (p) => (people.length > 1 ? (p.id === 'p1' ? 'You: ' : 'Your spouse: ') : '');
  const range = (r) => `${$(r.from)} to ${$(r.to)}`;
  const notes = [];
  for (const p of people) {
    const own = rows.filter((r) => r.owner === p.id && r.tax !== 'taxable' && Number(r.amount) > 0);
    if (own.some((r) => r.account === 'ira')) {
      const roth = rothIraLimit({ magi, filingStatus, year, age: ageOf(p) });
      if (roth.status === 'none') {
        notes.push({ owner: p.id, kind: 'rothIra', status: 'none', message: `${who(p)}at ${$(magi)} of modified AGI, above the Roth IRA income limit (${range(roth.range)}), a Roth IRA contribution isn't allowed, so the Roth side of an IRA isn't open. A backdoor Roth (a nondeductible Traditional IRA contribution converted to Roth) is outside this calculator.` });
      } else if (roth.status === 'reduced') {
        notes.push({ owner: p.id, kind: 'rothIra', status: 'reduced', message: `${who(p)}at ${$(magi)} of modified AGI, inside the Roth IRA phase-out (${range(roth.range)}), at most ${$(roth.allowed)} may go into a Roth IRA this year.` });
      }
      const spouse = people.find((x) => x.id !== p.id);
      const deduction = traditionalIraDeduction({ magi, filingStatus, year, age: ageOf(p), covered: has401k(p.id), spouseCovered: spouse ? has401k(spouse.id) : false });
      if (deduction.status === 'none') {
        notes.push({ owner: p.id, kind: 'iraDeduction', status: 'none', message: `${who(p)}with a workplace plan in the household and ${$(magi)} of modified AGI (above ${range(deduction.range)}), a Traditional IRA contribution isn't deductible, so it isn't Pre-tax: the Pre-tax side of an IRA isn't open.` });
      } else if (deduction.status === 'reduced') {
        notes.push({ owner: p.id, kind: 'iraDeduction', status: 'reduced', message: `${who(p)}with a workplace plan in the household and ${$(magi)} of modified AGI (inside ${range(deduction.range)}), only ${$(deduction.deductible)} of a Traditional IRA contribution is deductible; the rest isn't Pre-tax.` });
      }
    }
    if (own.some((r) => r.account === '401k')) {
      const limit = checkContributionLimit(0, '401k', year, ageOf(p));
      const saved = own.filter((r) => r.account === '401k').reduce((a, r) => a + Number(r.amount), 0);
      if (limit.catchUp > 0 && saved > limit.base && catchUpMustBeRoth({ priorYearWages: p.wages, year })) {
        notes.push({ owner: p.id, kind: 'rothCatchUp', status: 'roth', message: `${who(p)}with over $150,000 of wages last year, the ${$(limit.catchUp)} catch-up must go in as Roth (from 2026), so only ${$(limit.base)} can be deferred Pre-tax. The comparison doesn't apply this yet: its Pre-tax side still defers the catch-up.` });
      }
    }
  }
  return notes;
}
