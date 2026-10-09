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
  // rules (no inflation, no age deductions, no IRMAA: the snapshot doesn't model it), contributions as entered (Pre-tax): the first
  // retirement year must equal compare.js's all-Pre-tax portfolio, to the cent.
  const cases = [
    {},
    { grossIncome: '60000', savings: '6000' },
    { grossIncome: '180000', savings: '40000', currentAge: '64', retirementAge: '66', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '200000', basisShare: '0.5' }, { id: 'a2', owner: 'p1', type: 'taxable', balance: '80000', basisShare: '0.4' }] },
    { currentAge: '55', retirementAge: '67', savings: '15000', filingStatus: 'mfj' },
  ];
  for (const c of cases) {
    it(`first retirement year matches (${JSON.stringify(c).slice(0, 60)})`, () => {
      const values = { ...PREVIEW_DEFAULT_VALUES, inflationRate: '0', ageDeductions: 'no', medicareIrmaa: 'no', taxSavedBasis: 'marginal', ...c };
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

describe('the retirement tax-rate what-if (2026, HAND CALC)', () => {
  it("3 points higher in retirement: the RMD year's tax rises by 3% of taxable income", () => {
    // the RMD case: withdrawal 49,504.95, taxable 33,404.95, tax 3,760.59.
    // +3 points on every ordinary bracket: + 3% x 33,404.95 = 1,002.15 -> 4,762.74
    const h = retiree({ age: 80, pretax: 1000000 });
    h.assumptions.retirementRateShift = 0.03;
    expect(runProjection(h, { need: 10000, endAge: 80 }).rows[0].totalTax).toBeCloseTo(4762.74, 2);
    // a caller's own shift wins (the break-even search passes its own)
    expect(runProjection(h, { need: 10000, endAge: 80, retirementRateShift: 0 }).rows[0].totalTax).toBeCloseTo(3760.59, 2);
  });

  it('working years are not shifted; the adapter passes the shift to the Roth comparison', () => {
    const values = { ...PREVIEW_DEFAULT_VALUES, retirementRateShift: '0.03' };
    const h = toHousehold(values, Y);
    expect(runProjection(h, { need: 50000, endAge: 35 }).rows[0].incomeTax).toBeCloseTo(10970, 6);
    expect(householdToCompareInputs(h).retirementTaxRules.rateShift).toBe(0.03);
    expect(householdToCompareInputs(toHousehold(PREVIEW_DEFAULT_VALUES, Y)).retirementTaxRules.rateShift).toBeUndefined();
    // a higher retirement rate can only raise the effective rate on the account withdrawal
    const base = compareRothVsTraditional(householdToCompareInputs(toHousehold(PREVIEW_DEFAULT_VALUES, Y)));
    const shifted = compareRothVsTraditional(householdToCompareInputs(h));
    expect(shifted.rates.effectiveRetirement).toBeGreaterThan(base.rates.effectiveRetirement);
  });
});

describe('runProjection: Medicare IRMAA (2026, HAND CALC)', () => {
  // Single, 80, born 1946, $2,787,600 Pre-tax, no Social Security, return 0, need 0: withdrawals are
  // exactly the RMDs, so MAGI doesn't depend on the surcharge.
  //   year 0: 2,787,600 / 20.2 = 138,000.00  (MAGI over $137,000: tier 2)
  //   year 1: 2,649,600 / 19.4 = 136,577.32  (tier 1)
  //   year 2: 2,513,022.68 / 18.5 = 135,839.06
  // Surcharges (per person, 2026): tier 2 = (202.90 + 37.50) x 12 = 2,884.80; tier 1 = (81.20 + 14.50) x 12 = 1,148.40.
  //   year 0: the years before the projection are taken at year 0's MAGI -> tier 2, 2,884.80
  //   year 1: 2 years back = before the projection -> year 0's MAGI -> 2,884.80
  //   year 2: year 0's MAGI (138,000) -> 2,884.80
  //   year 3: year 1's MAGI (136,577.32) -> 1,148.40
  const household = (irmaa) => ({ ...retiree({ age: 80, pretax: 2787600 }), assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false, medicareIrmaa: irmaa } });

  it('the surcharge follows MAGI two years back, and comes out of after-tax cash', () => {
    const on = runProjection(household(true), { need: 0, endAge: 83 }).rows;
    const off = runProjection(household(false), { need: 0, endAge: 83 }).rows;
    expect(on.map((r) => r.magi)).toEqual([expect.closeTo(138000, 2), expect.closeTo(136577.32, 2), expect.closeTo(135839.06, 2), expect.any(Number)]);
    expect(on.map((r) => r.irmaaTier)).toEqual([2, 2, 2, 1]);
    expect(on.map((r) => r.irmaa)).toEqual([expect.closeTo(2884.8, 6), expect.closeTo(2884.8, 6), expect.closeTo(2884.8, 6), expect.closeTo(1148.4, 6)]);
    // same withdrawals and tax; cash and the reinvested surplus are lower by exactly the surcharge
    on.forEach((r, i) => {
      expect(r.withdrawals.total).toBeCloseTo(off[i].withdrawals.total, 6);
      expect(r.totalTax).toBeCloseTo(off[i].totalTax, 6);
      expect(off[i].afterTaxIncome - r.afterTaxIncome).toBeCloseTo(r.irmaa, 6);
      expect(off[i].surplus - r.surplus).toBeCloseTo(r.irmaa, 6);
    });
    expect(off.every((r) => r.irmaa === 0 && r.irmaaTier === 0)).toBe(true);
  });

  it('under 65 (no Medicare) nothing is charged, whatever the income', () => {
    // 64 with a $100,000 need from a large Pre-tax balance: MAGI well over the threshold, no Medicare yet
    const h = { ...retiree({ age: 64, pretax: 3000000 }), assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false, medicareIrmaa: true } };
    const { rows } = runProjection(h, { need: 100000, endAge: 65 });
    expect(rows[0].magi).toBeGreaterThan(109000);
    expect(rows[0].irmaa).toBe(0);
    // at 65 the surcharge starts, set by the earlier years' MAGI
    expect(rows[1].irmaa).toBeGreaterThan(0);
  });
});

// Survivor years (phase 2, step a). A retired couple filing jointly, built directly; each person
// lives through the year they reach their plan-to age, and the survivor files single from the next.
function couple({ age1 = 80, age2 = 66, planTo1 = 80, planTo2 = 95, ss1 = 0, ss2 = 0, accounts = [], pensions, survivorSpending, returnRate = 0 } = {}) {
  const person = (id, age, planToAge, benefit) => ({
    id,
    birthYear: Y - age,
    retirementAge: age - 1,
    planToAge,
    wages: 0,
    selfEmploymentIncome: 0,
    socialSecurity: { known: true, benefit, claimAge: null },
  });
  return {
    version: 1,
    year: Y,
    filingStatus: 'mfj',
    people: [person('p1', age1, planTo1, ss1), person('p2', age2, planTo2, ss2)],
    accounts,
    ...(pensions && { pensions }),
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }, { owner: 'p2', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate, inflationRate: 0, ageDeductions: false, ...(survivorSpending !== undefined && { survivorSpending }) },
  };
}

describe('runProjection: survivor years (2026, HAND CALC)', () => {
  it('the year after the first death: single brackets, 80% spending, the survivor’s RMD age', () => {
    // p1 80 (born 1946, plan to 80: dies at the end of this year), p2 66 (born 1960, RMDs from 75).
    // One Pre-tax account of p1's, $1,000,000, return 0, need $60,000.
    // Year 0 (joint, the year of death): RMD 1,000,000 / 20.2 = 49,504.95, less than the need's W.
    //   W - tax = 60,000, tax = 2,480 + 12% x (W - 32,200 - 24,800) = 0.12 W - 4,360
    //   -> 0.88 W = 55,640 -> W = 63,227.2727; tax 3,227.2727; end balance 936,772.7273
    // Year 1 (p2 67, single; the account is now p2's: no RMD before 75), need 80% = 48,000:
    //   tax = 1,240 + 12% x (W - 16,100 - 12,400) = 0.12 W - 2,180 -> 0.88 W = 45,820
    //   -> W = 52,068.1818; tax 4,068.1818 (taxable 35,968.18, inside the 12% bracket)
    //   end balance 884,704.5455. Year 2 (p2 68): the same; end 832,636.3636.
    const h = couple({ accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: 1000000 }] });
    const { rows } = runProjection(h, { need: 60000, endAge: 82 });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.filingStatus)).toEqual(['mfj', 'single', 'single']);
    expect(rows.map((r) => r.alive)).toEqual([[true, true], [false, true], [false, true]]);
    expect(rows[0].rmd).toBeCloseTo(49504.95, 2);
    expect(rows[0].withdrawals.pretax).toBeCloseTo(55640 / 0.88, 4);
    expect(rows[0].totalTax).toBeCloseTo(3227.2727, 3);
    for (const r of rows.slice(1)) {
      expect(r.rmd).toBe(0);
      expect(r.need).toBe(48000);
      expect(r.withdrawals.pretax).toBeCloseTo(45820 / 0.88, 4);
      expect(r.totalTax).toBeCloseTo(4068.1818, 3);
      expect(r.afterTaxIncome).toBeCloseTo(48000, 4);
    }
    expect(rows.map((r) => r.endBalances.pretax)).toEqual([
      expect.closeTo(936772.7273, 3),
      expect.closeTo(884704.5455, 3),
      expect.closeTo(832636.3636, 3),
    ]);
  });

  it('survivor spending is an input: 70% of $60,000', () => {
    // Year 1, single, need 42,000: 0.88 W = 42,000 - 2,180 = 39,820 -> W = 45,250; tax 5,430 - 2,180 = 3,250
    const h = couple({ accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: 1000000 }], survivorSpending: 0.7 });
    const r = runProjection(h, { need: 60000, endAge: 81 }).rows[1];
    expect(r.need).toBe(42000);
    expect(r.withdrawals.pretax).toBeCloseTo(45250, 6);
    expect(r.totalTax).toBeCloseTo(3250, 6);
  });

  it('Social Security: the survivor keeps the larger of the two benefits', () => {
    // known benefits (no spousal top-up): 30,000 + 12,000 while both live; then the larger, 30,000
    const larger = runProjection(couple({ ss1: 30000, ss2: 12000 }), { need: 0, endAge: 82 }).rows;
    expect(larger.map((r) => r.socialSecurity)).toEqual([42000, 30000, 30000]);
    // the survivor's own is larger: they keep it (12,000)
    const own = runProjection(couple({ ss1: 10000, ss2: 12000 }), { need: 0, endAge: 81 }).rows;
    expect(own.map((r) => r.socialSecurity)).toEqual([22000, 12000]);
  });

  it("pensions: the deceased's continues at its survivor share, the survivor's in full", () => {
    // p1: $2,000 a month from 65, 50% to the survivor; p2: $1,000 a month from 65, no survivor share.
    // Both started, no COLA, inflation 0: 24,000 + 12,000 = 36,000; then 12,000 + 12,000 = 24,000
    const pensions = [
      { owner: 'p1', monthly: 2000, startAge: 65, cola: 0, survivorShare: 0.5 },
      { owner: 'p2', monthly: 1000, startAge: 65, cola: 0, survivorShare: 0 },
    ];
    const { rows } = runProjection(couple({ pensions }), { need: 0, endAge: 81 });
    expect(rows.map((r) => r.pension)).toEqual([36000, 24000]);
  });

  it("the deceased's taxable account gets a step-up in basis at the end of the year of death", () => {
    // $100,000 taxable of p1's, 20% basis, 10% return, nothing withdrawn: 110,000 at year end, its
    // basis stepped up from 20,000 to 110,000 (without a death it stays 20,000)
    const accounts = [{ id: 'a1', owner: 'p1', type: 'taxable', balance: 100000, basisShare: 0.2 }];
    const died = runProjection(couple({ accounts, returnRate: 0.1 }), { need: 0, endAge: 80 }).rows[0];
    expect(died.endBalances.taxable).toBeCloseTo(110000, 6);
    expect(died.taxableBasis).toBeCloseTo(110000, 6);
    const lived = runProjection(couple({ accounts, returnRate: 0.1, planTo1: 95 }), { need: 0, endAge: 80 }).rows[0];
    expect(lived.taxableBasis).toBeCloseTo(20000, 6);
  });

  it('no death before the end age (or no plan-to ages): the results are unchanged', () => {
    const accounts = [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: 800000 },
      { id: 'a2', owner: 'p2', type: 'taxable', balance: 200000, basisShare: 0.5 },
    ];
    const run = (planTo1, planTo2) =>
      runProjection(couple({ accounts, planTo1, planTo2, ss1: 30000, ss2: 15000, returnRate: 0.05 }), { need: 70000, endAge: 90 }).rows;
    const without = run(null, null);
    expect(run(95, 95)).toEqual(without);
    expect(without.every((r) => r.filingStatus === 'mfj')).toBe(true);
  });
});

describe('runProjection: tax drag on taxable accounts (2026, HAND CALC)', () => {
  // A worker, 40, single, wages $100,000, retiring at 65; one taxable account of $100,000, all basis.
  function worker({ dividendYield }) {
    const h = retiree({ age: 40, taxable: 100000, basisShare: 1, returnRate: 0.05 });
    h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
    h.assumptions = { ...h.assumptions, dividendYield };
    return h;
  }

  it('while working, the account pays the dividends’ tax and reinvests the rest', () => {
    // Taxable ordinary income 100,000 - 16,100 = 83,900, above the 0% capital-gains bracket ($49,450),
    // so qualified dividends pay 15%; MAGI far below the NIIT threshold.
    // Year 1: dividends 100,000 x 2% = 2,000; tax 300.
    //   balance 100,000 x 1.05 - 300 = 104,700; basis 100,000 + 2,000 - 300 = 101,700
    // Year 2: dividends 104,700 x 2% = 2,094; tax 314.10.
    //   balance 104,700 x 1.05 - 314.10 = 109,620.90; basis 101,700 + 2,094 - 314.10 = 103,479.90
    const { rows } = runProjection(worker({ dividendYield: 0.02 }), { endAge: 41 });
    const plain = runProjection(worker({ dividendYield: 0 }), { endAge: 41 }).rows;
    expect(rows.map((r) => r.dividends)).toEqual([expect.closeTo(2000, 6), expect.closeTo(2094, 6)]);
    expect(rows.map((r) => r.dividendTaxFromAccounts)).toEqual([expect.closeTo(300, 6), expect.closeTo(314.1, 6)]);
    expect(rows[0].capitalGainsTax).toBeCloseTo(300, 6);
    expect(rows[0].totalTax - plain[0].totalTax).toBeCloseTo(300, 6);
    expect(rows.map((r) => r.endBalances.taxable)).toEqual([expect.closeTo(104700, 6), expect.closeTo(109620.9, 6)]);
    expect(rows.map((r) => r.taxableBasis)).toEqual([expect.closeTo(101700, 6), expect.closeTo(103479.9, 6)]);
    // The paycheck is untouched: after-tax income is what it is without dividends.
    rows.forEach((r, i) => expect(r.afterTaxIncome).toBeCloseTo(plain[i].afterTaxIncome, 6));
  });

  it('no yield (version 1 households) changes nothing', () => {
    const h = worker({ dividendYield: 0 });
    delete h.assumptions.dividendYield;
    const { rows } = runProjection(h, { endAge: 41 });
    expect(rows[0].dividends).toBe(0);
    expect(rows[0].endBalances.taxable).toBeCloseTo(105000, 6);
    expect(rows[0].taxableBasis).toBeCloseTo(100000, 6);
  });

  it('retired, under the 0% bracket: dividends on what stays invested, all reinvested as basis', () => {
    // 70, $100,000 taxable all basis, need $10,000, return 5%, yield 2%. No gain, and the dividends
    // are under the standard deduction: no tax, so W = 10,000.
    // dividends (100,000 - 10,000) x 2% = 1,800; balance 90,000 x 1.05 = 94,500;
    // basis 100,000 x (1 - 10,000 / 100,000) + 1,800 = 91,800
    const h = retiree({ age: 70, taxable: 100000, basisShare: 1, returnRate: 0.05 });
    h.assumptions.dividendYield = 0.02;
    const r = runProjection(h, { need: 10000, endAge: 70 }).rows[0];
    expect(r.withdrawals.taxable).toBeCloseTo(10000, 4);
    expect(r.dividends).toBeCloseTo(1800, 4);
    expect(r.totalTax).toBe(0);
    expect(r.dividendTaxFromAccounts).toBe(0);
    expect(r.endBalances.taxable).toBeCloseTo(94500, 4);
    expect(r.taxableBasis).toBeCloseTo(91800, 4);
  });

  it('retired, in the 15% bracket: the withdrawal covers the dividends’ tax', () => {
    // 70, $2,000,000 taxable all basis (no gain on a sale), need $100,000, yield 5%, return 5%.
    // tax = 15% x ((2,000,000 - W) x 5% - 16,100 - 49,450) = 5,167.5 - 0.0075 W; W - tax = 100,000
    //   -> 1.0075 W = 105,167.5 -> W = 104,384.6154; tax 4,384.6154
    //   dividends (2,000,000 - W) x 5% = 94,780.7692 (taxable 78,680.77: inside the 15% bracket)
    // balance (2,000,000 - W) x 1.05 = 1,990,396.1538 = basis 1,895,615.3846 + 94,780.7692
    const h = retiree({ age: 70, taxable: 2000000, basisShare: 1, returnRate: 0.05 });
    h.assumptions.dividendYield = 0.05;
    const r = runProjection(h, { need: 100000, endAge: 70 }).rows[0];
    expect(r.withdrawals.taxable).toBeCloseTo(105167.5 / 1.0075, 3);
    expect(r.totalTax).toBeCloseTo(4384.6154, 3);
    expect(r.dividends).toBeCloseTo(94780.7692, 3);
    expect(r.afterTaxIncome).toBeCloseTo(100000, 3);
    expect(r.endBalances.taxable).toBeCloseTo(1990396.1538, 3);
    expect(r.taxableBasis).toBeCloseTo(1990396.1538, 3);
  });
});

describe('runProjection: employer contributions (2026, HAND CALC)', () => {
  // A worker, 40, single, wages $100,000, retiring at 65; $10,000 a year Pre-tax to a 401(k); return 0.
  function worker(employer) {
    const h = retiree({ age: 40 });
    h.version = 2;
    h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
    h.futureContributions.contributions = [{ owner: 'p1', amount: 10000 }];
    h.contributionRows = [{ id: 'c1', owner: 'p1', tax: 'pretax', account: '401k', amount: 10000, employer }];
    return h;
  }

  it('a 100% match on the first 4% of pay: $4,000 a year into Pre-tax, no change to the year’s tax', () => {
    // year 1: 10,000 + 4,000 = 14,000; year 2: 28,000
    const { rows } = runProjection(worker({ type: 'match', matchRate: 1, matchUpTo: 0.04 }), { endAge: 41 });
    const plain = runProjection(worker({ type: 'none' }), { endAge: 41 }).rows;
    expect(rows.map((r) => r.employerContributions)).toEqual([4000, 4000]);
    expect(rows.map((r) => r.endBalances.pretax)).toEqual([14000, 28000]);
    expect(rows[0].contributions.pretax).toBe(10000);
    expect(rows[0].totalTax).toBe(plain[0].totalTax);
    expect(rows[0].afterTaxIncome).toBe(plain[0].afterTaxIncome);
  });

  it('stops at retirement', () => {
    // retiring at 41: the year at 41 has no wages and no employer money
    const h = worker({ type: 'flat', amount: 5000 });
    h.people[0].retirementAge = 41;
    const { rows } = runProjection(h, { endAge: 41 });
    expect(rows.map((r) => r.employerContributions)).toEqual([5000, 0]);
  });
});

describe('runProjection: returns before and after retirement (HAND CALC)', () => {
  it('one person: the after-retirement return from the year they retire', () => {
    // 64, retiring at 65, $100,000 Roth; 10% before, 0% after; no need, no tax.
    // 64: 100,000 x 1.10 = 110,000; 65: 110,000 x 1.00 = 110,000
    const h = retiree({ age: 64, roth: 100000, returnRate: 0.1 });
    h.people[0].retirementAge = 65;
    h.assumptions.retirementReturnRate = 0;
    const { rows } = runProjection(h, { endAge: 65 });
    expect(rows.map((r) => r.endBalances.roth)).toEqual([expect.closeTo(110000, 6), expect.closeTo(110000, 6)]);
    expect(rows.map((r) => r.returnRate)).toEqual([0.1, 0]);
  });

  it('a couple: the before-retirement return while either still works', () => {
    // you 60 (retiring at 61), your spouse 59 (retiring at 61), $100,000 Roth; 10% before, 0% after.
    // year 0: both work -> 110,000; year 1: you retired, spouse works -> 121,000; year 2: both retired -> 121,000
    const h = couple({ age1: 60, age2: 59, planTo1: 95, planTo2: 95, returnRate: 0.1, accounts: [{ id: 'a1', owner: 'p1', type: 'roth', balance: 100000 }] });
    h.people[0].retirementAge = 61;
    h.people[1].retirementAge = 61;
    h.assumptions.retirementReturnRate = 0;
    const { rows } = runProjection(h, { endAge: 62 });
    expect(rows.map((r) => r.endBalances.roth)).toEqual([expect.closeTo(110000, 6), expect.closeTo(121000, 6), expect.closeTo(121000, 6)]);
  });

  it('absent (version 1 households): the one return throughout', () => {
    const h = retiree({ age: 64, roth: 100000, returnRate: 0.1 });
    h.people[0].retirementAge = 65;
    const { rows } = runProjection(h, { endAge: 65 });
    expect(rows.map((r) => r.endBalances.roth)).toEqual([expect.closeTo(110000, 6), expect.closeTo(121000, 6)]);
  });
});

describe('runProjection: each taxable account’s own dividend yield (HAND CALC)', () => {
  it('an account’s own yield wins over the assumption', () => {
    // the worker of the tax drag tests (wages $100,000: dividends at 15%), return 5%, assumption 2%;
    // a second $100,000 taxable account at its own 3%. Year 1: 2,000 + 3,000 = 5,000 of dividends,
    // tax 750; the second account: 100,000 x 1.05 - 450 = 104,550, basis 100,000 + 3,000 - 450 = 102,550
    const h = retiree({ age: 40, taxable: 100000, basisShare: 1, returnRate: 0.05 });
    h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
    h.accounts.push({ id: 'a4', owner: 'p1', type: 'taxable', balance: 100000, basisShare: 1, dividendYield: 0.03 });
    h.assumptions.dividendYield = 0.02;
    const r = runProjection(h, { endAge: 40 }).rows[0];
    expect(r.dividends).toBeCloseTo(5000, 6);
    expect(r.dividendTaxFromAccounts).toBeCloseTo(750, 6);
    // 104,700 (the first, as before) + 104,550
    expect(r.endBalances.taxable).toBeCloseTo(209250, 6);
    expect(r.taxableBasis).toBeCloseTo(101700 + 102550, 6);
  });
});

describe('runProjection: income rows over their ages, and the surplus setting (2026, HAND CALC)', () => {
  const other = (treatment, amount, fromAge, toAge) => ({ id: 'x', owner: 'p1', type: 'other', treatment, amount, fromAge, toAge });

  it('retired: rent counts as ordinary income and cash, so less is withdrawn', () => {
    // 70, $500,000 Pre-tax, need $30,000, $20,000 of rent to 90. Cash = 20,000 + W - tax = 30,000;
    // tax = 1,240 + 12% x (20,000 + W - 16,100 - 12,400) = 0.12 W + 220 -> 0.88 W = 10,220
    // -> W = 11,613.6364, tax 1,613.6364 (taxable 15,513.64, in the 12% bracket)
    const h = retiree({ age: 70, pretax: 500000 });
    h.incomes = [other('ordinary', 20000, null, 90)];
    const r = runProjection(h, { need: 30000, endAge: 70 }).rows[0];
    expect(r.withdrawals.pretax).toBeCloseTo(10220 / 0.88, 4);
    expect(r.totalTax).toBeCloseTo(1613.6364, 3);
    expect(r.otherIncome).toBe(20000);
    expect(r.afterTaxIncome).toBeCloseTo(30000, 4);
  });

  it('a row stops after its last age', () => {
    const h = retiree({ age: 70, pretax: 500000 });
    h.incomes = [other('ordinary', 20000, null, 70)];
    const { rows } = runProjection(h, { need: 30000, endAge: 71 });
    expect(rows.map((r) => r.otherIncome)).toEqual([20000, 0]);
  });

  // A worker, 40, single, wages $100,000 (a W-2 row with blank ages: until retirement at 65).
  function worker(incomes, surplus) {
    const h = retiree({ age: 40 });
    h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
    h.incomes = [{ id: 'w', owner: 'p1', type: 'w2', amount: 100000, fromAge: null, toAge: null }, ...incomes];
    if (surplus) h.assumptions.surplus = surplus;
    return h;
  }

  it('working: income beyond the paycheck, after its tax, is saved (the default)', () => {
    // $10,000 of rent: taxable 83,900 + 10,000 = 93,900, inside the 22% bracket -> tax 2,200;
    // reinvested 7,800 in a taxable account (basis)
    const r = runProjection(worker([other('ordinary', 10000, null, null)]), { endAge: 40 }).rows[0];
    expect(r.surplus).toBeCloseTo(7800, 6);
    expect(r.reinvested).toBeCloseTo(7800, 6);
    expect(r.extraSpending).toBe(0);
    expect(r.endBalances.taxable).toBeCloseTo(7800, 6);
  });

  it('or spent: spending rises in those years, nothing reinvested', () => {
    const r = runProjection(worker([other('ordinary', 10000, null, null)], 'spend'), { endAge: 40 }).rows[0];
    expect(r.surplus).toBeCloseTo(7800, 6);
    expect(r.reinvested).toBe(0);
    expect(r.extraSpending).toBeCloseTo(7800, 6);
    expect(r.endBalances.taxable).toBe(0);
  });

  it('earnings rows over their ages: until retirement when blank; part-time work after it', () => {
    // retiring at 42; part-time W-2 of $20,000 from 42 to 43
    const h = worker([{ id: 'pt', owner: 'p1', type: 'w2', amount: 20000, fromAge: 42, toAge: 43 }]);
    h.people[0].retirementAge = 42;
    const { rows } = runProjection(h, { endAge: 44 });
    expect(rows.map((r) => r.wages)).toEqual([100000, 100000, 20000, 20000, 0]);
    expect(rows.map((r) => r.working[0])).toEqual([true, true, false, false, false]);
  });

  it('earnings that end before retirement: no surplus, nothing drawn', () => {
    const h = worker([]);
    h.incomes[0].toAge = 40;
    const { rows } = runProjection(h, { endAge: 41 });
    expect(rows.map((r) => r.wages)).toEqual([100000, 0]);
    expect(rows[1].surplus).toBe(0);
    expect(rows[1].withdrawals.total).toBe(0);
    expect(rows[1].shortfall).toBe(0);
  });
});

// The Roth conversion calculator's lifetime view (decided 2026-10-09): a conversion in the first year.
describe('runProjection: a conversion this year (convertNow, HAND CALC)', () => {
  it('retired: the year\'s withdrawals pay its tax; the whole amount reaches Roth', () => {
    // age 70, born 1956 (RMDs at 73), no age deductions, $200,000 Pre-tax, need $30,000, convert $20,000.
    // W - tax(W + 20,000) = 30,000; taxable W + 20,000 - 16,100 = W + 3,900, in the 12% bracket:
    //   tax = 1,240 + 12% x (W + 3,900 - 12,400) = 220 + 0.12 W -> 0.88 W = 30,220 -> W = 34,340.9091
    //   (taxable 38,240.91; tax 4,340.9091). Without it: W = 31,613.6364, tax 1,613.6364 (above).
    //   Pre-tax at the year end: 200,000 - 34,340.9091 - 20,000 = 145,659.0909; Roth 20,000.
    const h = retiree({ age: 70, pretax: 200000 });
    const [r] = runProjection(h, { need: 30000, endAge: 70, convertNow: 20000 }).rows;
    expect(r.conversions).toBe(20000);
    expect(r.withdrawals.pretax).toBeCloseTo(34340.9091, 3);
    expect(r.totalTax).toBeCloseTo(4340.9091, 3);
    expect(r.afterTaxIncome).toBeCloseTo(30000, 4);
    expect(r.conversionTaxWithheld).toBe(0);
    expect(r.endBalances.pretax).toBeCloseTo(145659.0909, 3);
    expect(r.endBalances.roth).toBeCloseTo(20000, 6);
    // no conversion after the first year
    const rows = runProjection(h, { need: 30000, endAge: 71, convertNow: 20000 }).rows;
    expect(rows[1].conversions).toBe(0);
  });

  it('working: its tax is held back from the conversion, so less reaches Roth', () => {
    // age 50, retiring at 65, $100,000 W-2, $100,000 Pre-tax, return 0, convert $10,000.
    //   tax without: taxable 83,900 -> 1,240 + 4,560 + 22% x 33,500 (7,370) = 13,170
    //   tax with:    taxable 93,900 -> 1,240 + 4,560 + 22% x 43,500 (9,570) = 15,370; held back 2,200
    //   Roth 10,000 - 2,200 = 7,800; Pre-tax 90,000; cash 100,000 - 7,650 - 13,170 = 79,180 (unchanged)
    const h = retiree({ age: 50, pretax: 100000 });
    h.people[0] = { ...h.people[0], retirementAge: 65, wages: 100000 };
    const [r] = runProjection(h, { endAge: 50, convertNow: 10000 }).rows;
    expect(r.incomeTax).toBeCloseTo(15370, 6);
    expect(r.conversionTaxWithheld).toBeCloseTo(2200, 6);
    expect(r.endBalances.roth).toBeCloseTo(7800, 6);
    expect(r.endBalances.pretax).toBeCloseTo(90000, 6);
    expect(r.afterTaxIncome).toBeCloseTo(79180, 6);
    expect(r.surplus).toBe(0);
  });

  it('never more than the Pre-tax balance; none without one', () => {
    const [r] = runProjection(retiree({ age: 70, pretax: 5000, roth: 100000 }), { need: 10000, endAge: 70, convertNow: 20000 }).rows;
    expect(r.conversions + r.withdrawals.pretax).toBeLessThanOrEqual(5000 + 1e-6);
    const [none] = runProjection(retiree({ age: 70, roth: 100000 }), { need: 10000, endAge: 70, convertNow: 20000 }).rows;
    expect(none.conversions).toBe(0);
  });
});
