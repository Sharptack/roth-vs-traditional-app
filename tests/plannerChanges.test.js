// Round 2 phase 6 step (b): the planner's changes for single years (runProjection's yearChanges,
// by default household.plannerChanges). A change alters only its year and later.
import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';

const Y = 2026;

function retiree({ age, pretax = 0, taxable = 0, basisShare = 1, returnRate = 0 }) {
  return {
    version: 1,
    year: Y,
    filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - age, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: taxable, basisShare },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate, inflationRate: 0, ageDeductions: false },
  };
}

// 40, single, $100,000 W-2 to 65, a $10,000 Pre-tax 401(k) row with a 100% match on the first 4% of
// pay ($4,000), return 0.
function worker() {
  const h = retiree({ age: 40 });
  h.version = 2;
  h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
  h.incomes = [{ id: 'w', owner: 'p1', type: 'w2', amount: 100000, fromAge: null, toAge: null }];
  h.futureContributions.contributions = [{ owner: 'p1', amount: 10000 }];
  h.contributionRows = [{ id: 'c1', owner: 'p1', tax: 'pretax', account: '401k', amount: 10000, employer: { type: 'match', matchRate: 1, matchUpTo: 0.04 } }];
  return h;
}

describe('the planner’s conversions (2026, HAND CALC)', () => {
  it('a conversion in 2026 is the conversion page’s conversion: the same year, worked by hand', () => {
    // As projection.test.js (convertNow): age 70, $200,000 Pre-tax, $100,000 taxable (all basis),
    // need $30,000, convert $20,000. Spending: Pre-tax 20,278.5714, taxable 10,139.2857; the conversion's
    // tax 2,235.5714 from taxable; total tax 2,653.4286; end Pre-tax 159,721.4286, taxable 87,625.1429, Roth 20,000.
    const h = retiree({ age: 70, pretax: 200000, taxable: 100000 });
    const [r] = runProjection(h, { need: 30000, endAge: 70, yearChanges: [{ year: 2026, kind: 'convert', owner: 'p1', amount: 20000 }] }).rows;
    expect(r.conversions).toBeCloseTo(20000, 6);
    expect(r.withdrawals.pretax).toBeCloseTo(20278.5714, 3);
    expect(r.withdrawals.taxable).toBeCloseTo(10139.2857 + 2235.5714, 3);
    expect(r.totalTax).toBeCloseTo(2653.4286, 3);
    expect(r.endBalances.pretax).toBeCloseTo(159721.4286, 3);
    expect(r.endBalances.taxable).toBeCloseTo(87625.1429, 3);
    expect(r.endBalances.roth).toBeCloseTo(20000, 6);
  });

  it('a conversion in a later year: every earlier row identical; that year worked by hand', () => {
    // $200,000 Pre-tax only, need $30,000, return 0. 2026: W = 31,613.6364 (tax 1,613.6364), Pre-tax
    // left 168,386.3636. 2027, convert $20,000: W again 31,613.6364; its tax 12% x 20,000 = 2,400 held
    // back (no taxable account); Pre-tax 168,386.3636 - 31,613.6364 - 20,000 = 116,772.7273; Roth 17,600.
    const h = retiree({ age: 70, pretax: 200000 });
    const base = runProjection(h, { need: 30000, endAge: 73 }).rows;
    const changed = runProjection(h, { need: 30000, endAge: 73, yearChanges: [{ year: 2027, kind: 'convert', owner: 'p1', amount: 20000 }] }).rows;
    expect(changed[0]).toEqual(base[0]);
    const r = changed[1];
    expect(r.withdrawals.pretax).toBeCloseTo(31613.6364, 3);
    expect(r.conversions).toBeCloseTo(20000, 6);
    expect(r.conversionTaxWithheld).toBeCloseTo(2400, 6);
    expect(r.totalTax).toBeCloseTo(4013.6364, 3);
    expect(r.endBalances.pretax).toBeCloseTo(116772.7273, 3);
    expect(r.endBalances.roth).toBeCloseTo(17600, 6);
    // later years differ (less Pre-tax, a Roth balance)
    expect(changed[2].endBalances.roth).toBeGreaterThan(0);
  });

  it('from the owner’s Pre-tax accounts only, pro rata by balance; never more than is there', () => {
    const h = retiree({ age: 70, pretax: 0 });
    h.filingStatus = 'mfj';
    h.people.push({ ...h.people[0], id: 'p2' });
    h.futureContributions.contributions.push({ owner: 'p2', amount: 0 });
    h.accounts = [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: 300000 },
      { id: 'b1', owner: 'p2', type: 'pretax', balance: 60000 },
      { id: 'b2', owner: 'p2', type: 'pretax', balance: 40000 },
    ];
    // p2's $10,000: 6,000 from b1 and 4,000 from b2 (their balances 60:40); a1 untouched by it
    const [r] = runProjection(h, { need: 0, endAge: 70, yearChanges: [{ year: 2026, kind: 'convert', owner: 'p2', amount: 10000 }] }).rows;
    const out = Object.fromEntries(r.detail.accounts.map((a) => [a.id, a.convertedOut]));
    expect(out).toMatchObject({ a1: 0, b1: 6000, b2: 4000 });
    // $1,000,000 asked of $100,000: all of it, no more
    const [all] = runProjection(h, { need: 0, endAge: 70, yearChanges: [{ year: 2026, kind: 'convert', owner: 'p2', amount: 1000000 }] }).rows;
    expect(all.conversions).toBeCloseTo(100000, 6);
  });

  it('no changes, or an empty list, or changes outside the plan’s years: the same results', () => {
    const h = retiree({ age: 70, pretax: 200000, taxable: 50000 });
    const base = runProjection(h, { need: 30000, endAge: 75 }).rows;
    expect(runProjection(h, { need: 30000, endAge: 75, yearChanges: [] }).rows).toEqual(base);
    expect(runProjection(h, { need: 30000, endAge: 75, yearChanges: [{ year: 2090, kind: 'convert', owner: 'p1', amount: 5000 }] }).rows).toEqual(base);
    // the household's own list is the default
    expect(runProjection({ ...h, plannerChanges: [{ year: 2027, kind: 'convert', owner: 'p1', amount: 5000 }] }, { need: 30000, endAge: 75 }).rows[1].conversions).toBeCloseTo(5000, 6);
  });
});

describe('the planner’s contribution changes (2026, HAND CALC)', () => {
  // Base year: taxable 100,000 - 10,000 - 16,100 = 73,900 -> 1,240 + 4,560 + 22% x 23,500 = 10,970.
  // At $20,000: taxable 63,900 -> 1,240 + 4,560 + 22% x 13,500 = 8,770. At $0: taxable 83,900 -> 13,170.
  it('for one year: that year only, then back to the row as entered', () => {
    const base = runProjection(worker(), { endAge: 43 }).rows;
    const rows = runProjection(worker(), { endAge: 43, yearChanges: [{ year: 2027, kind: 'contribution', row: 'c1', amount: 20000, scope: 'year' }] }).rows;
    expect(rows[0]).toEqual(base[0]);
    expect(rows.map((r) => r.contributions.pretax)).toEqual([10000, 20000, 10000, 10000]);
    expect(rows[1].incomeTax).toBeCloseTo(8770, 6);
    expect(rows[2].incomeTax).toBeCloseTo(10970, 6);
    // the match stays at 4% of pay ($4,000): $20,000 is past it
    expect(rows.map((r) => r.employerContributions)).toEqual([4000, 4000, 4000, 4000]);
    // end balances (return 0): 14,000, then +24,000, +14,000, +14,000
    expect(rows.map((r) => r.endBalances.pretax)).toEqual([14000, 38000, 52000, 66000]);
  });

  it('from a year on; a later change takes over; $0 earns no match', () => {
    const rows = runProjection(worker(), {
      endAge: 43,
      yearChanges: [
        { year: 2027, kind: 'contribution', row: 'c1', amount: 20000, scope: 'onward' },
        { year: 2029, kind: 'contribution', row: 'c1', amount: 0, scope: 'onward' },
      ],
    }).rows;
    expect(rows.map((r) => r.contributions.pretax)).toEqual([10000, 20000, 20000, 0]);
    expect(rows.map((r) => r.employerContributions)).toEqual([4000, 4000, 4000, 0]);
    expect(rows[3].incomeTax).toBeCloseTo(13170, 6);
  });

  it('one year inside a change from a year on: the one year wins there', () => {
    const rows = runProjection(worker(), {
      endAge: 43,
      yearChanges: [
        { year: 2027, kind: 'contribution', row: 'c1', amount: 20000, scope: 'onward' },
        { year: 2028, kind: 'contribution', row: 'c1', amount: 5000, scope: 'year' },
      ],
    }).rows;
    expect(rows.map((r) => r.contributions.pretax)).toEqual([10000, 20000, 5000, 20000]);
  });

  it('a taxable savings row: its amount changes the savings to the taxable account', () => {
    const h = worker();
    h.contributionRows.push({ id: 'c2', owner: 'p1', tax: 'taxable', account: '401k', amount: 3000, employer: { type: 'none' } });
    h.futureContributions.taxableSavings = [{ owner: 'p1', amount: 3000 }];
    const rows = runProjection(h, { endAge: 41, yearChanges: [{ year: 2027, kind: 'contribution', row: 'c2', amount: 8000, scope: 'year' }] }).rows;
    expect(rows.map((r) => r.contributions.taxable)).toEqual([3000, 8000]);
  });
});
