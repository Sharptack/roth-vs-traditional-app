import { describe, it, expect } from 'vitest';
import { runProjection } from '../src/lib/projection.js';
import { conventionalOrderStrategy, rothConversionStrategy } from '../src/lib/strategies.js';
import { compareWithConversions, convertBelowRate, fillBracket } from '../src/lib/lowerYearConversions.js';
import { compareLifetime } from '../src/lib/lifetimeComparison.js';
import { sustainableSpending } from '../src/lib/projectionSummary.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';

const Y = 2026;
const person = (id, age, retirementAge) => ({ id, birthYear: Y - age, retirementAge, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } });
function retiree({ age, pretax = 0, taxable = 0, irmaa = false }) {
  return {
    version: 1, year: Y, filingStatus: 'single',
    people: [person('p1', age, age - 1)],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a2', owner: 'p1', type: 'roth', balance: 0 },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: taxable, basisShare: 1 },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: {},
    assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false, medicareIrmaa: irmaa },
  };
}
const year1 = (h, strategy, need = 30000) => runProjection(h, { need, endAge: Y - h.people[0].birthYear, strategy }).rows[0];

describe('fillBracket (2026)', () => {
  it('the bracket under the chosen rate', () => {
    expect(fillBracket('single', Y, 0.22)).toEqual({ rate: 0.12, top: 50400 });
    expect(fillBracket('single', Y, 0.24)).toEqual({ rate: 0.22, top: 105700 });
    expect(fillBracket('mfj', Y, 0.22)).toEqual({ rate: 0.12, top: 100800 });
    // a rate between brackets: the highest below it
    expect(fillBracket('single', Y, 0.27)).toEqual({ rate: 0.24, top: 201775 });
    // nothing is below 10%
    expect(fillBracket('single', Y, 0.1)).toBeNull();
    // rates in retirement 3 points higher: 12% is 15%, under 22%; 22% is 25%, not under 24%
    expect(fillBracket('single', Y, 0.24, 0.03).top).toBe(50400);
  });
});

describe('convertBelowRate (2026, HAND CALC)', () => {
  it('below 22%, before RMDs: fills to the top of 12%, the same as the 12% conversion strategy', () => {
    // 66, $500,000 Pre-tax, $300,000 taxable (all basis), need 30,000. Spending from taxable (no
    // ordinary income); convert 50,400 + 16,100 = 66,500, tax 1,240 + 0.12 x 38,000 = 5,800 from
    // taxable: 30,000 + 5,800 = 35,800.
    const h = retiree({ age: 66, pretax: 500000, taxable: 300000 });
    const r = year1(h, convertBelowRate(conventionalOrderStrategy, { rate: 0.22 }));
    expect(r.conversions).toBeCloseTo(66500, 2);
    expect(r.totalTax).toBeCloseTo(5800, 2);
    expect(r.withdrawals.taxable).toBeCloseTo(35800, 2);
    const same = year1(h, rothConversionStrategy(0.12));
    expect(r.conversions).toBeCloseTo(same.conversions, 4);
  });

  it('an RMD year converts too, on top of the RMD', () => {
    // 75 (RMDs from 73): RMD 500,000 / 24.6 = 20,325.2033. Its tax: 0.10 x 4,225.2033 = 422.5203,
    // cash 19,902.6829; taxable pays the rest of the need, 10,097.3171. Convert to ordinary income
    // 66,500: 66,500 - 20,325.2033 = 46,174.7967. Tax 5,800 in all; the conversion's 5,377.4797 from
    // taxable: 15,474.7968 drawn.
    const h = retiree({ age: 75, pretax: 500000, taxable: 300000 });
    const r = year1(h, convertBelowRate(conventionalOrderStrategy, { rate: 0.22 }));
    expect(r.rmd).toBeCloseTo(20325.2033, 3);
    expect(r.conversions).toBeCloseTo(46174.7967, 2);
    expect(r.totalTax).toBeCloseTo(5800, 2);
    expect(r.withdrawals.taxable).toBeCloseTo(15474.7968, 2);
    expect(r.afterTaxIncome).toBeCloseTo(30000, 4);
  });

  it('nothing below the rate: the plan unchanged', () => {
    const h = retiree({ age: 66, pretax: 500000, taxable: 300000 });
    const plain = runProjection(h, { need: 30000, endAge: 80, strategy: conventionalOrderStrategy }).rows;
    const rule = runProjection(h, { need: 30000, endAge: 80, strategy: convertBelowRate(conventionalOrderStrategy, { rate: 0.1 }) }).rows;
    expect(rule.map((r) => r.endBalances)).toEqual(plain.map((r) => r.endBalances));
    expect(rule.every((r) => r.conversions === 0)).toBe(true);
  });

  it('a person still working does not convert; the retired spouse does', () => {
    // MFJ: p1 66 retired ($500,000 Pre-tax, $300,000 taxable), p2 60 working (no wages, retires at
    // 65, $400,000 Pre-tax). Spending from taxable; p1 converts to the 12% top: 100,800 + 32,200 =
    // 133,000. p2's account is untouched.
    const h = retiree({ age: 66, pretax: 500000, taxable: 300000 });
    h.filingStatus = 'mfj';
    h.people.push(person('p2', 60, 65));
    h.accounts.push({ id: 'b1', owner: 'p2', type: 'pretax', balance: 400000 });
    const r = year1(h, convertBelowRate(conventionalOrderStrategy, { rate: 0.22 }));
    expect(r.conversions).toBeCloseTo(133000, 2);
    expect(r.detail.accounts.find((a) => a.id === 'b1')?.convertedOut ?? 0).toBe(0);
  });

  it('the IRMAA option stops at the next tier', () => {
    // 66, below 32% (fill to the top of 24%: 201,775 + 16,100 = 217,875). With the IRMAA stop:
    // MAGI without the rule 0 (spending from taxable basis), tier 1 starts over 109,000, so
    // convert 109,000. Its tax: taxable 92,900 -> 1,240 + 4,560 + 0.22 x 42,500 = 15,150.
    const h = retiree({ age: 66, pretax: 1000000, taxable: 300000, irmaa: true });
    const free = year1(h, convertBelowRate(conventionalOrderStrategy, { rate: 0.32 }));
    expect(free.conversions).toBeCloseTo(217875, 2);
    const capped = year1(h, convertBelowRate(conventionalOrderStrategy, { rate: 0.32, irmaaCap: true }));
    expect(capped.conversions).toBeCloseTo(109000, 2);
    expect(capped.magi).toBeLessThanOrEqual(109000 + 1e-6);
    expect(capped.totalTax).toBeCloseTo(15150, 2);
  });
});

describe('compareWithConversions', () => {
  const setUp = (over) => {
    const h = toHousehold(
      { ...PREVIEW_DEFAULT_VALUES, inflationRate: '0', ageDeductions: 'no', taxSavedBasis: 'marginal', returnRate: '0.05', knowsSocialSecurity: 'yes', socialSecurityBenefit: '0', ...over },
      Y,
    );
    h.assumptions.returnRate = 0;
    return { h, r: compareRothVsTraditional(householdToCompareInputs(h)) };
  };

  it('each figure equals a separate full run', () => {
    // A $40,000 need on $600,000 Pre-tax: the retired years sit in 12%, under today's 22%.
    const set = setUp({ currentAge: '60', retirementAge: '62', projEndAge: '75', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '600000', basisShare: '0.5' }] });
    const h = set.h;
    const r = { ...set.r, retirementNeed: { ...set.r.retirementNeed, target: 40000 } };
    const c = compareWithConversions(h, r, { endAge: 75, strategy: conventionalOrderStrategy });
    expect(c.rate).toBe(r.rates.contributionRate ?? r.rates.marginalNow);
    const rule = convertBelowRate(conventionalOrderStrategy, { rate: c.rate });
    const plain = compareLifetime(h, r, { endAge: 75, strategy: conventionalOrderStrategy });
    const own = compareLifetime(h, r, { endAge: 75, strategy: rule });
    expect(c.without.difference).toEqual(plain.difference);
    expect(c.with.difference).toEqual(own.difference);
    const contributions = (type) => [{ owner: 'p1', takeHomeCost: r.contributionSplit.takeHomeCost, rate: c.rate, type }];
    expect(c.with.roth.sustainable).toBe(sustainableSpending(h, { endAge: 75, contributions: contributions('roth'), strategy: rule }));
    expect(c.converted.pretax).toBeGreaterThan(0);
    expect(c.converted.roth).toBeGreaterThan(0); // the Roth side's existing Pre-tax money converts too
    const total = runProjection(h, { endAge: 75, need: r.retirementNeed.target, contributions: contributions('pretax'), strategy: rule }).rows.reduce((s, x) => s + x.conversions, 0);
    expect(c.converted.pretax).toBeCloseTo(total, 4);
  });

  it('no years below the chosen rate: today\'s lifetime comparison', () => {
    const { h, r } = setUp({ currentAge: '60', retirementAge: '62', projEndAge: '75', accounts: [{ id: 'a1', owner: 'p1', type: 'pretax', balance: '600000', basisShare: '0.5' }] });
    const c = compareWithConversions(h, r, { endAge: 75, rate: 0.1 });
    expect(c.fill).toBeNull();
    expect(c.with.difference).toEqual(c.without.difference);
    expect(c.with.winner).toBe(c.without.winner);
    expect(c.roth).toEqual([]);
    expect(c.pretax).toEqual([]);
  });
});
