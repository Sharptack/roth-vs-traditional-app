// Round 2 phase 6 step (a): each projection row's parts (row.detail), for the year table's
// breakdowns. The parts add up to the row's totals, and the tax rows rebuild the year's tax.
import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';
import { accountFlowTotal, accountLabels, columnParts, incomeLabel, yearTaxRowsOf } from '../src/lib/projectionDetail.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES, newPerson } from '../src/lib/householdValues.js';

const Y = 2026;

function retiree({ age, pretax = 0, returnRate = 0 }) {
  return {
    version: 1,
    year: Y,
    filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - age, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a2', owner: 'p1', type: 'roth', balance: 0 },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate, inflationRate: 0, ageDeductions: false },
  };
}

describe('projection row detail (2026, HAND CALC)', () => {
  it('a retired year with a conversion: each account’s flow, the withdrawal, the tax rows', () => {
    // age 70 (born 1956, RMDs at 73), $200,000 Pre-tax, 10% return, need $30,000, convert $20,000.
    // From projection.test.js (no taxable account: the conversion's tax, 2,400, is held back from it):
    // W = 31,613.6364, tax 4,013.6364.
    // a1 (Pre-tax): 200,000 - 31,613.6364 withdrawn - 20,000 converted = 148,386.3636;
    //   growth 10% = 14,838.6364; end 163,225.0000
    // the projection's Roth account for p1: 17,600 in, growth 1,760, end 19,360
    // a2 (Roth, $0, nothing in or out): not listed
    const [r] = runProjection(retiree({ age: 70, pretax: 200000, returnRate: 0.1 }), { need: 30000, endAge: 70, convertNow: 20000 }).rows;
    const { accounts } = r.detail;
    expect(accounts.map((a) => a.id)).toEqual(['a1', 'new-roth-p1']);
    const [a1, roth] = accounts;
    expect(a1).toMatchObject({ owner: 'p1', type: 'pretax', start: 200000, rmd: 0, convertedOut: 20000, convertedIn: 0 });
    expect(a1.withdrawn).toBeCloseTo(31613.6364, 3);
    expect(a1.growth).toBeCloseTo(14838.6364, 3);
    expect(a1.end).toBeCloseTo(163225, 3);
    expect(roth).toMatchObject({ type: 'roth', start: 0, withdrawn: 0 });
    expect(roth.convertedIn).toBeCloseTo(17600, 6);
    expect(roth.growth).toBeCloseTo(1760, 6);
    expect(roth.end).toBeCloseTo(19360, 6);
    for (const a of accounts) expect(accountFlowTotal(a)).toBeCloseTo(a.end, 6);
    // the tax rows end on the year's tax
    const rows = yearTaxRowsOf(r);
    expect(rows.find((x) => x.key === 'incomeTax').value).toBeCloseTo(4013.6364, 3);
    expect(rows.find((x) => x.key === 'ordinaryIncome').value).toBeCloseTo(51613.6364, 3); // W + the conversion
    // spending: the need met exactly
    expect(r.detail.spending).toMatchObject({ need: 30000, baseNeed: 30000, extraSpending: 0, reinvested: 0, shortfall: 0 });
  });

  it('an RMD year: the RMD part of the withdrawal is marked', () => {
    // age 80 (born 1946): RMD 1,000,000 / 20.2 = 49,504.95, more than a $10,000 need: all of it is the RMD;
    // the surplus 35,744.36 (projection.test.js) is reinvested in the projection's taxable account.
    const [r] = runProjection(retiree({ age: 80, pretax: 1000000 }), { need: 10000, endAge: 80 }).rows;
    const a1 = r.detail.accounts.find((a) => a.id === 'a1');
    expect(a1.rmd).toBeCloseTo(49504.95, 2);
    expect(a1.withdrawn).toBeCloseTo(49504.95, 2);
    const side = r.detail.accounts.find((a) => a.id === 'new-taxable-p1');
    expect(side.reinvested).toBeCloseTo(35744.36, 2);
    expect(side.end).toBeCloseTo(35744.36, 2);
    expect(r.detail.spending.reinvested).toBeCloseTo(35744.36, 2);
  });

  it('a couple: Social Security per person, then the survivor’s own and survivor parts', () => {
    // known benefits 30,000 and 12,000; p1 (80) dies this year. Year 1: p2's own 12,000 plus the
    // excess of p1's 30,000 over it, 18,000. Survivor spending 80% of the need.
    const person = (id, age, planToAge, benefit) => ({
      id, birthYear: Y - age, retirementAge: age - 1, planToAge, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit, claimAge: null },
    });
    const h = {
      version: 1, year: Y, filingStatus: 'mfj',
      people: [person('p1', 80, 80, 30000), person('p2', 66, 95, 12000)],
      accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: 1000000 }],
      futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }, { owner: 'p2', amount: 0 }] },
      spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
      calculators: {},
      assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false },
    };
    const rows = runProjection(h, { need: 60000, endAge: 81 }).rows;
    const ss = (r) => r.detail.income.filter((x) => x.kind === 'socialSecurity').map(({ owner, part, amount }) => ({ owner, part, amount }));
    expect(ss(rows[0])).toEqual([
      { owner: 'p1', part: 'own', amount: 30000 },
      { owner: 'p2', part: 'own', amount: 12000 },
    ]);
    expect(ss(rows[1])).toEqual([
      { owner: 'p2', part: 'own', amount: 12000 },
      { owner: 'p2', part: 'survivor', amount: 18000 },
    ]);
    expect(rows[1].detail.spending).toMatchObject({ baseNeed: 60000, need: 48000 });
    // the account rolled to p2 at the end of the year of death
    expect(rows[1].detail.accounts[0].owner).toBe('p2');
  });

  it('a working year: earnings by row, the contribution and the employer’s, into the account', () => {
    // 40, single, a $100,000 W-2 row, $10,000 Pre-tax with a 100% match on 4% ($4,000), return 0:
    // the projection's Pre-tax account for p1 gets 10,000 + 4,000 = 14,000.
    const h = retiree({ age: 40 });
    h.version = 2;
    h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
    h.incomes = [{ id: 'w', owner: 'p1', type: 'w2', amount: 100000, fromAge: null, toAge: null }];
    h.futureContributions.contributions = [{ owner: 'p1', amount: 10000 }];
    h.contributionRows = [{ id: 'c1', owner: 'p1', tax: 'pretax', account: '401k', amount: 10000, employer: { type: 'match', matchRate: 1, matchUpTo: 0.04 } }];
    const [r] = runProjection(h, { endAge: 40 }).rows;
    expect(r.detail.income).toEqual([{ kind: 'w2', id: 'w', owner: 'p1', amount: 100000 }]);
    const acct = r.detail.accounts.find((a) => a.id === 'new-pretax-p1');
    expect(acct).toMatchObject({ contributed: 10000, employer: 4000, end: 14000 });
    const rows = yearTaxRowsOf(r);
    expect(rows.find((x) => x.key === 'deferrals').value).toBe(10000);
    expect(rows.find((x) => x.key === 'totalTax').value).toBeCloseTo(r.totalTax, 8);
  });
});

describe('projection row detail: the parts add up (the default household and a richer one)', () => {
  const check = (household, need) => {
    const { rows } = runProjection(household, { need });
    for (const r of rows) {
      const d = r.detail;
      const sumBy = (pred, field) => d.accounts.filter(pred).reduce((s, a) => s + a[field], 0);
      for (const type of ['pretax', 'roth', 'taxable']) {
        expect(sumBy((a) => a.type === type, 'withdrawn')).toBeCloseTo(r.withdrawals[type], 6);
        expect(sumBy((a) => a.type === type, 'start')).toBeCloseTo(r.startBalances[type], 6);
        expect(sumBy((a) => a.type === type, 'end')).toBeCloseTo(r.endBalances[type], 6);
        expect(sumBy((a) => a.type === type, 'contributed')).toBeCloseTo(r.contributions[type], 6);
      }
      expect(sumBy(() => true, 'employer')).toBeCloseTo(r.employerContributions, 6);
      expect(sumBy(() => true, 'convertedOut')).toBeCloseTo(r.conversions, 6);
      expect(sumBy(() => true, 'rmd')).toBeCloseTo(r.rmd, 6);
      for (const a of d.accounts) expect(accountFlowTotal(a)).toBeCloseTo(a.end, 6);
      const income = (kind) => d.income.filter((x) => x.kind === kind).reduce((s, x) => s + x.amount, 0);
      expect(income('w2') + income('1099')).toBeCloseTo(r.wages, 6);
      expect(income('socialSecurity')).toBeCloseTo(r.socialSecurity, 6);
      expect(income('pension')).toBeCloseTo(r.pension, 6);
      expect(income('other')).toBeCloseTo(r.otherIncome, 6);
      expect(yearTaxRowsOf(r).find((x) => x.key === 'incomeTax').value).toBeCloseTo(r.incomeTax, 6);
    }
    return rows;
  };

  it('the default household', () => {
    check(toHouseholdV2(DEFAULT_HOUSEHOLD_VALUES, Y), 60000);
  });

  it('a couple with a pension, rent, a taxable account and IRMAA', () => {
    const v = structuredClone(DEFAULT_HOUSEHOLD_VALUES);
    v.includeSpouse = 'yes';
    v.filingStatus = 'mfj';
    v.people = [newPerson('p1', { age: '60', retirementAge: '63', planToAge: '85' }), newPerson('p2', { age: '58', retirementAge: '60', planToAge: '92' })];
    const row = { ...v.incomes[0], fromAge: '', toAge: '' };
    v.incomes = [
      { ...row, id: 'i1', owner: 'p1', type: 'w2', amount: '150000' },
      { ...row, id: 'i2', owner: 'p2', type: 'pension', amount: '1500', fromAge: '62', survivorShare: '0.5' },
      { ...row, id: 'i3', owner: 'p1', type: 'other', treatment: 'ordinary', amount: '12000' },
    ];
    v.accounts = [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: '900000', basisShare: '0.5', dividendYield: '' },
      { id: 'a2', owner: 'p2', type: 'roth', balance: '150000', basisShare: '0.5', dividendYield: '' },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: '300000', basisShare: '0.6', dividendYield: '' },
    ];
    const h = toHouseholdV2(v, Y);
    expect(h.people).toHaveLength(2);
    const rows = check(h, 90000);
    // the case covers what it says: a pension, survivor years, IRMAA, dividends, RMDs, rent
    expect(rows.some((r) => r.pension > 0 && r.alive.includes(false))).toBe(true);
    expect(rows.some((r) => r.irmaa > 0)).toBe(true);
    expect(rows.some((r) => r.dividends > 0)).toBe(true);
    expect(rows.some((r) => r.rmd > 0)).toBe(true);
    expect(rows.some((r) => r.otherIncome > 0)).toBe(true);
    expect(rows.some((r) => r.detail.income.some((x) => x.part === 'survivor'))).toBe(true);
  });
});

describe('projection row detail: labels', () => {
  it('accounts: numbered when an owner has two of a type; the plan’s own by what goes in, a lump sum named', () => {
    const accounts = [
      { id: 'a1', owner: 'p1', type: 'pretax' },
      { id: 'a2', owner: 'p1', type: 'pretax' },
      { id: 'a3', owner: 'p2', type: 'roth' },
      { id: 'lump-i4', owner: 'p2', type: 'pretax' },
      { id: 'new-roth-p1', owner: 'p1', type: 'roth' },
    ];
    expect(accountLabels(accounts, { couple: true })).toEqual({
      a1: 'You: Pre-tax account 1',
      a2: 'You: Pre-tax account 2',
      a3: 'Spouse: Roth account',
      'lump-i4': 'Spouse: Pre-tax IRA (pension lump sum)',
      'new-roth-p1': 'You: Roth, new contributions and conversions',
    });
    expect(accountLabels([{ id: 'a1', owner: 'p1', type: 'taxable' }])).toEqual({ a1: 'Taxable account' });
  });

  it('income lines', () => {
    expect(incomeLabel({ kind: 'socialSecurity', owner: 'p2', part: 'survivor' }, { couple: true })).toBe('Spouse: Social Security, survivor benefit (above their own)');
    expect(incomeLabel({ kind: 'pension', owner: 'p1', index: 1 }, { pensionCount: 2 })).toBe('Pension 2');
    expect(incomeLabel({ kind: 'other', owner: 'p1', treatment: 'ordinary' })).toBe('Other income (taxable as ordinary income)');
  });
});

describe('the year table’s columns that open: the parts add up to the total', () => {
  const TOTALS = {
    wages: (r) => r.wages,
    ss: (r) => r.socialSecurity,
    pension: (r) => r.pension,
    other: (r) => r.otherIncome,
    withdrawn: (r) => r.withdrawals.total,
    contributed: (r) => r.contributions.total,
    incomeTax: (r) => r.incomeTax,
    end: (r) => r.endBalances.total,
  };
  it('a couple with a pension, rent, a taxable account and IRMAA; and a family with the child tax credit', () => {
    const v = structuredClone(DEFAULT_HOUSEHOLD_VALUES);
    v.includeSpouse = 'yes';
    v.filingStatus = 'mfj';
    v.people = [newPerson('p1', { age: '60', retirementAge: '63', planToAge: '85' }), newPerson('p2', { age: '58', retirementAge: '60', planToAge: '92' })];
    const row = { ...v.incomes[0], fromAge: '', toAge: '' };
    v.incomes = [
      { ...row, id: 'i1', owner: 'p1', type: 'w2', amount: '150000' },
      { ...row, id: 'i2', owner: 'p2', type: 'pension', amount: '1500', fromAge: '62', survivorShare: '0.5' },
      { ...row, id: 'i3', owner: 'p1', type: 'other', treatment: 'ordinary', amount: '12000' },
    ];
    v.accounts = [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: '900000', basisShare: '0.5', dividendYield: '' },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: '300000', basisShare: '0.6', dividendYield: '' },
    ];
    const family = structuredClone(DEFAULT_HOUSEHOLD_VALUES);
    family.dependents = [{ id: 'd1', kind: 'child', age: '5' }];
    for (const h of [toHouseholdV2(v, Y), toHouseholdV2(family, Y)]) {
      const { rows } = runProjection(h, { need: 90000 });
      for (const [column, total] of Object.entries(TOTALS)) {
        const parts = columnParts(column, rows);
        for (const r of rows) expect(parts.reduce((s, p) => s + p.value(r), 0), `${column} ${r.year}`).toBeCloseTo(total(r), 6);
      }
    }
    // the family's credit shows as its own part
    expect(columnParts('incomeTax', runProjection(toHouseholdV2(family, Y), { need: 90000 }).rows).map((p) => p.key)).toContain('incomeTax:credits');
  });
});
