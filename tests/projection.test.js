import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';

const Y = 2026;

// A one-person retired household built directly (no wages, no Social Security, today's rules).
function retiree({ age, birthYear = Y - age, pretax = 0, roth = 0, taxable = 0, basisShare = 0, returnRate = 0 }) {
  return {
    version: 1,
    year: Y,
    filingStatus: 'single',
    people: [
      { id: 'p1', birthYear, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } },
    ],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a2', owner: 'p1', type: 'roth', balance: roth },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: taxable, basisShare },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate, inflationRate: 0, ageDeductions: false },
  };
}

describe('runProjection (2026, HAND CALC)', () => {
  it('three years: one Pre-tax account, no Social Security, 10% return, $30,000 after-tax need', () => {
    // age 66, born 1960 (RMDs at 75: none here). Need W with W - tax(W) = 30,000:
    //   tax = 1,240 + 12% x (W - 16,100 - 12,400) -> 0.88 W + 3,420 - 1,240 = 30,000 -> W = 27,820 / 0.88
    //   = 31,613.6364 (taxable 15,513.64, in the 12% bracket: tax 1,613.64)
    // balances: (500,000 - 31,613.64) x 1.1 = 515,225.00; (515,225 - 31,613.64) x 1.1 = 531,972.50;
    //           (531,972.50 - 31,613.64) x 1.1 = 550,394.75
    const { rows } = runProjection(retiree({ age: 66, pretax: 500000, returnRate: 0.1 }), { need: 30000, endAge: 68 });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.withdrawals.pretax).toBeCloseTo(27820 / 0.88, 4);
      expect(r.totalTax).toBeCloseTo(1613.6364, 3);
      expect(r.afterTaxIncome).toBeCloseTo(30000, 4);
      expect(r.shortfall).toBe(0);
    }
    expect(rows.map((r) => r.endBalances.pretax)).toEqual([
      expect.closeTo(515225, 3),
      expect.closeTo(531972.5, 3),
      expect.closeTo(550394.75, 3),
    ]);
  });

  it('an RMD larger than the need: the surplus is reinvested in a taxable account as basis', () => {
    // age 80, born 1946 (start age 72): RMD 1,000,000 / 20.2 = 49,504.95
    // tax: taxable 33,404.95 -> 1,240 + 12% x 21,004.95 (2,520.59) = 3,760.59; after tax 45,744.36
    // need 10,000 -> surplus 35,744.36 to taxable (all basis); return 0
    const { rows } = runProjection(retiree({ age: 80, pretax: 1000000 }), { need: 10000, endAge: 80 });
    const r = rows[0];
    expect(r.rmd).toBeCloseTo(49504.95, 2);
    expect(r.withdrawals.pretax).toBeCloseTo(49504.95, 2);
    expect(r.totalTax).toBeCloseTo(3760.59, 2);
    expect(r.surplus).toBeCloseTo(35744.36, 2);
    expect(r.endBalances.pretax).toBeCloseTo(950495.05, 2);
    expect(r.endBalances.taxable).toBeCloseTo(35744.36, 2);
    expect(r.taxableBasis).toBeCloseTo(35744.36, 2);
  });

  it('running out: the shortfall and the year the money ran out', () => {
    // $50,000 Pre-tax, need 30,000, return 0. Year 1 as above (W = 31,613.64) -> 18,386.36 left.
    // Year 2: withdraw it all; tax on 18,386.36: taxable 2,286.36 x 10% = 228.64 -> 18,157.73,
    // short 11,842.27. Year 3: nothing left, short 30,000.
    const { rows, runOutYear } = runProjection(retiree({ age: 66, pretax: 50000 }), { need: 30000, endAge: 68 });
    expect(rows[0].shortfall).toBe(0);
    expect(rows[1].withdrawals.pretax).toBeCloseTo(18386.36, 2);
    expect(rows[1].afterTaxIncome).toBeCloseTo(18157.73, 2);
    expect(rows[1].shortfall).toBeCloseTo(11842.27, 2);
    expect(rows[2].shortfall).toBeCloseTo(30000, 6);
    expect(runOutYear).toBe(Y + 1);
  });

  it('the engine enforces the rules whatever the strategy returns', () => {
    // a strategy that takes nothing still takes the RMD; one that asks for too much gets the balance
    const nothing = () => ({ withdrawals: {}, conversions: [] });
    const r1 = runProjection(retiree({ age: 80, pretax: 1000000 }), { need: 10000, endAge: 80, strategy: nothing }).rows[0];
    expect(r1.withdrawals.pretax).toBeCloseTo(1000000 / 20.2, 2);
    const greedy = ({ accounts }) => ({ withdrawals: Object.fromEntries(accounts.map((a) => [a.id, a.balance * 10])), conversions: [] });
    const r2 = runProjection(retiree({ age: 66, pretax: 40000, roth: 10000 }), { need: 10000, endAge: 66, strategy: greedy }).rows[0];
    expect(r2.withdrawals.pretax).toBe(40000);
    expect(r2.withdrawals.roth).toBe(10000);
    expect(r2.endBalances.total).toBeCloseTo(r2.surplus, 6); // all that's left is the reinvested surplus
  });

  it('a working year: contributions go in at year end, taxes on the paycheck, no withdrawals', () => {
    // the default household (35, $100,000 W-2, $10,000 Pre-tax): tax 10,970 + payroll 7,650
    const h = toHousehold({ ...PREVIEW_DEFAULT_VALUES, accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '0', basisShare: '0.5' }] }, Y);
    h.assumptions.returnRate = 0;
    const r = runProjection(h, { need: 50000, endAge: 35 }).rows[0];
    expect(r.working).toEqual([true]);
    expect(r.contributions.pretax).toBe(10000);
    expect(r.withdrawals.total).toBe(0);
    expect(r.incomeTax).toBeCloseTo(10970, 6);
    expect(r.payrollTax).toBeCloseTo(7650, 6);
    expect(r.endBalances.pretax).toBe(10000);
  });

  it('catch-up starts at 50: $35,000 saved from 49 puts $24,500 then $32,500 in the account', () => {
    const h = toHousehold({ ...PREVIEW_DEFAULT_VALUES, currentAge: '49', savings: '35000' }, Y);
    const { rows } = runProjection(h, { need: 50000, endAge: 50 });
    expect(rows[0].contributions.pretax).toBe(24500);
    expect(rows[0].contributions.taxable).toBe(10500);
    expect(rows[1].contributions.pretax).toBe(32500);
    expect(rows[1].contributions.taxable).toBe(2500);
  });
});

describe('runProjection reconciles with the total portfolio section', () => {
  // Where the two models agree by design: retiring at 62 or later (the snapshot counts Social
  // Security from the first retirement year; the projection starts it at the claiming age, 62 at
  // the earliest), and the IRS limit unchanged over the saving years when saving over it (the
  // snapshot holds today's limit; the projection adds catch-up at 50 and the 60-63 tier). Today's
  // rules (no inflation, no age deductions), contributions as entered (Pre-tax): the first
  // retirement year must equal compare.js's all-Pre-tax portfolio, to the cent.
  const cases = [
    {},
    { grossIncome: '60000', savings: '6000' },
    { grossIncome: '180000', savings: '40000', currentAge: '64', retirementAge: '66', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '200000', basisShare: '0.5' }, { id: 'a2', owner: 'p1', type: 'taxable', balance: '80000', basisShare: '0.4' }] },
    { currentAge: '55', retirementAge: '67', savings: '15000', filingStatus: 'mfj' },
  ];
  for (const c of cases) {
    it(`first retirement year matches (${JSON.stringify(c).slice(0, 60)})`, () => {
      const values = { ...PREVIEW_DEFAULT_VALUES, inflationRate: '0', ageDeductions: 'no', taxSavedBasis: 'marginal', ...c };
      const h = toHousehold(values, Y);
      const r = compareRothVsTraditional(householdToCompareInputs(h));
      expect(r.valid).toBe(true);
      const { rows } = runProjection(h, { need: r.retirementNeed.target });
      const first = rows.find((row) => !row.working[0]);
      const p = r.portfolio.pretax;
      expect(first.startBalances.pretax).toBeCloseTo(p.buckets.pretax, 2);
      expect(first.startBalances.taxable).toBeCloseTo(p.buckets.taxable, 2);
      expect(first.withdrawals.pretax).toBeCloseTo(p.withdrawals.pretax, 2);
      expect(first.withdrawals.taxable).toBeCloseTo(p.withdrawals.taxable, 2);
      expect(first.totalTax).toBeCloseTo(p.totalTaxPaid, 2);
      expect(first.socialSecurity).toBeCloseTo(r.socialSecurity.annualBenefit, 6);
    });
  }
});
