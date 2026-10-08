import { describe, it, expect } from 'vitest';
import { contributionNotes } from '../src/lib/contributionRules.js';
import { DEFAULT_HOUSEHOLD_VALUES as D, addRow, newPerson, updateRow } from '../src/lib/householdValues.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';

// A single household this year: W-2 wages, and its contribution rows.
function household({ age = '40', wages, rows }) {
  let v = { ...D, people: [newPerson('p1', { age, retirementAge: '65' })], contributions: [] };
  v = updateRow(v, 'incomes', 'i1', 'amount', String(wages));
  for (const r of rows) v = addRow(v, 'contributions', r);
  return toHouseholdV2(v, 2026);
}
const kinds = (notes) => notes.map((n) => `${n.kind}:${n.status}`);

describe('who can contribute to what (2026, HAND CALC)', () => {
  it('Roth IRA: reduced inside the phase-out, closed above it', () => {
    // single, 160,000 of wages, Roth IRA: MAGI 160,000 -> 7,500 × 8,000 / 15,000 = 4,000
    const mid = contributionNotes(household({ wages: 160000, rows: [{ tax: 'roth', account: 'ira', amount: '7000' }] }));
    expect(kinds(mid)).toEqual(['rothIra:reduced']);
    expect(mid[0].message).toContain('at most $4,000 may go into a Roth IRA');
    const high = contributionNotes(household({ wages: 200000, rows: [{ tax: 'roth', account: 'ira', amount: '7000' }] }));
    expect(kinds(high)).toContain('rothIra:none');
    expect(contributionNotes(household({ wages: 100000, rows: [{ tax: 'roth', account: 'ira', amount: '7000' }] }))).toEqual([]);
  });

  it('Traditional IRA deduction: only with a workplace plan in the household', () => {
    // 401(k) Pre-tax 5,000 + IRA 7,500, wages 85,000: MAGI 80,000, under 81,000 -> fully deductible
    expect(contributionNotes(household({ wages: 85000, rows: [{ tax: 'pretax', account: '401k', amount: '5000' }, { tax: 'pretax', account: 'ira', amount: '7500' }] }))).toEqual([]);
    // 401(k) Roth 5,000 (no deferral) + IRA: MAGI 85,000 -> 7,500 × 6,000 / 10,000 = 4,500 deductible
    // (a Roth row and a Pre-tax row is the mix the comparison doesn't take yet; the note still applies)
    const mixed = contributionNotes(household({ wages: 85000, rows: [{ tax: 'roth', account: '401k', amount: '5000' }, { tax: 'pretax', account: 'ira', amount: '7500' }] }));
    expect(kinds(mixed)).toEqual(['iraDeduction:reduced']);
    expect(mixed[0].message).toContain('only $4,500 of a Traditional IRA contribution is deductible');
    // no workplace plan: deductible at any income (the Roth IRA limit still applies to the Roth side)
    expect(kinds(contributionNotes(household({ wages: 300000, rows: [{ tax: 'pretax', account: 'ira', amount: '7500' }] })))).toEqual(['rothIra:none']);
  });

  it('the Roth catch-up rule: 50 or over, saving past the base limit, over $150,000 of wages', () => {
    // 55, 200,000 of wages, 401(k) 30,000 Pre-tax: catch-up 8,000 must be Roth; base 24,500
    const n = contributionNotes(household({ age: '55', wages: 200000, rows: [{ tax: 'pretax', account: '401k', amount: '30000' }] }));
    expect(kinds(n)).toEqual(['rothCatchUp:roth']);
    expect(n[0].message).toContain('the $8,000 catch-up must go in as Roth');
    expect(n[0].message).toContain('only $24,500 can be deferred Pre-tax');
    // 140,000 of wages, or saving within the base limit, or under 50: nothing to say
    expect(contributionNotes(household({ age: '55', wages: 140000, rows: [{ tax: 'pretax', account: '401k', amount: '30000' }] }))).toEqual([]);
    expect(contributionNotes(household({ age: '55', wages: 200000, rows: [{ tax: 'pretax', account: '401k', amount: '20000' }] }))).toEqual([]);
    expect(contributionNotes(household({ age: '45', wages: 200000, rows: [{ tax: 'pretax', account: '401k', amount: '30000' }] }))).toEqual([]);
  });
});
