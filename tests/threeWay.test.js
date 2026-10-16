import { describe, it, expect } from 'vitest';
import { threeWayPoint, threeWayValues, threeWayWinner } from '../src/lib/threeWay.js';
import { THREE_WAY_POINTS, THREE_WAY_AGES, THREE_WAY_INCOMES, THREE_WAY_BALANCES } from '../src/data/threeWayGrid.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { compareWithConversions } from '../src/lib/lowerYearConversions.js';
import { lifetimeOptions } from '../src/lib/lifetimeComparison.js';
import { THREE_WAY_HASH, routeFromHash } from '../src/lib/route.js';

const Y = 2026;

describe('threeWayWinner (HAND CALC)', () => {
  it('a clear winner: Roth 100 vs. Pre-tax 99 is 1% apart, more than 0.5%', () => {
    // lead = (100 - 99) / 99 = 0.0101010...
    const w = threeWayWinner({ roth: 100, pretax: 99, converting: 90 });
    expect(w.winner).toBe('roth');
    expect(w.tied).toEqual(['roth']);
    expect(w.lead).toBeCloseTo(0.0101010101, 9);
  });

  it('conversions ahead: 1,010 vs. 1,000 is (1,010 - 1,000) / 1,010 = 0.99% behind, not tied', () => {
    // lead = 10 / 1,000 = 0.01
    const w = threeWayWinner({ roth: 1000, pretax: 996, converting: 1010 });
    expect(w.winner).toBe('converting');
    expect(w.tied).toEqual(['converting']);
    expect(w.lead).toBeCloseTo(0.01, 12);
  });

  it('about even: 996 is (1,000 - 996) / 1,000 = 0.4% behind the best, inside 0.5%', () => {
    // lead = 4 / 996 = 0.0040160643
    const w = threeWayWinner({ roth: 1000, pretax: 996, converting: 900 });
    expect(w.winner).toBe('even');
    expect(w.tied).toEqual(['roth', 'pretax']);
    expect(w.lead).toBeCloseTo(0.0040160643, 9);
  });

  it('two scenarios, and one', () => {
    // 100 vs. 50: lead = 50 / 50 = 1
    expect(threeWayWinner({ roth: 50, pretax: 100 })).toEqual({ winner: 'pretax', tied: ['pretax'], lead: 1 });
    expect(threeWayWinner({ roth: 5 })).toEqual({ winner: 'roth', tied: ['roth'], lead: 0 });
  });
});

describe('the grid and its sample households', () => {
  it('every combination once, ages slowest', () => {
    // 4 ages x 6 incomes x 6 balances = 144
    expect(THREE_WAY_POINTS).toHaveLength(THREE_WAY_AGES.length * THREE_WAY_INCOMES.length * THREE_WAY_BALANCES.length);
    expect(THREE_WAY_POINTS).toHaveLength(144);
    expect(THREE_WAY_POINTS[0]).toEqual({ age: 25, income: 50000, balance: 0 });
    expect(THREE_WAY_POINTS[36]).toEqual({ age: 35, income: 50000, balance: 0 });
  });

  it('a sample household: single, the pay, 10% saved, the balance all Pre-tax, 65 to 95, no debt payments', () => {
    const h = toHouseholdV2(threeWayValues({ age: 45, income: 150000, balance: 500000 }), Y);
    expect(h.filingStatus).toBe('single');
    expect(h.people).toHaveLength(1);
    expect(Y - h.people[0].birthYear).toBe(45);
    expect(h.people[0].retirementAge).toBe(65);
    expect(h.calculators.projection.endAge).toBe(95);
    expect(h.people[0].wages).toBe(150000);
    expect(h.futureContributions.contributions.reduce((s, c) => s + c.amount, 0)).toBe(15000);
    expect(h.accounts.filter((a) => a.balance > 0)).toEqual([expect.objectContaining({ type: 'pretax', balance: 500000 })]);
    expect(h.spending.debtPaymentsEnding).toBe(0);
  });
});

describe('threeWayPoint', () => {
  it("is the Roth page's comparison with conversions, run on the sample household", () => {
    const point = { age: 55, income: 250000, balance: 1500000 };
    const p = threeWayPoint(point, Y);
    const h = toHouseholdV2(threeWayValues(point), Y);
    const r = compareRothVsTraditional({ ...householdToCompareInputs(h), skipBlend: true });
    const c = compareWithConversions(h, r, lifetimeOptions(h));
    expect(p.scenarios.roth.endingAfterTax).toBe(c.without.roth.summary.endingAfterTax);
    expect(p.scenarios.pretax.endingAfterTax).toBe(c.without.pretax.summary.endingAfterTax);
    expect(p.scenarios.converting.endingAfterTax).toBe(c.with.pretax.summary.endingAfterTax);
    expect(p.scenarios.converting.totalTax).toBe(c.with.pretax.summary.totalTax);
    expect(p.scenarios.converting.sustainable).toBe(c.with.pretax.sustainable);
    expect(p.scenarios.converting.converted).toBe(c.converted.pretax);
    expect(p.need).toBe(c.without.need);
    expect(p.rate).toBe(c.rate);
    expect(p.noConversions).toBe(false);
    const w = threeWayWinner({ roth: c.without.roth.summary.endingAfterTax, pretax: c.without.pretax.summary.endingAfterTax, converting: c.with.pretax.summary.endingAfterTax });
    expect({ winner: p.winner, tied: p.tied, lead: p.lead }).toEqual(w);
  }, 30000);

  it('no room to convert: the conversions scenario is Pre-tax itself and sits out of the winner', () => {
    // $50,000 pay: today's rate is 12%, and nothing is below it but 10%, which Social Security and the
    // Pre-tax withdrawals already fill at this spending.
    const p = threeWayPoint({ age: 25, income: 50000, balance: 0 }, Y);
    expect(p.noConversions).toBe(true);
    expect(p.scenarios.converting.endingAfterTax).toBe(p.scenarios.pretax.endingAfterTax);
    expect(p.tied).not.toContain('converting');
    expect(['roth', 'pretax', 'even']).toContain(p.winner);
    expect(p.allRunOut).toBe(false);
    expect(p.measure).toBe('endingAfterTax');
  }, 30000);

  it('the money runs out in every scenario: ranked by sustainable spending, all three in', () => {
    // 45, $50,000 pay, nothing saved yet: each scenario is $0 at 95, so wealth ties at $0. Sustainable
    // spending (2026): Roth 35,075, Pre-tax 36,164, with conversions 35,887 (rounded). HAND CALC on
    // those: Pre-tax is best; conversions are (36,164 - 35,887) / 36,164 = 0.77% behind, more than
    // 0.5%, so Pre-tax wins outright, by 277 / 35,887 = 0.77%.
    const p = threeWayPoint({ age: 45, income: 50000, balance: 0 }, Y);
    expect(p.allRunOut).toBe(true);
    expect(p.measure).toBe('sustainable');
    for (const k of ['roth', 'pretax', 'converting']) expect(p.scenarios[k].endingAfterTax).toBe(0);
    expect(p.scenarios.roth.sustainable).toBeCloseTo(35075, -1);
    expect(p.scenarios.pretax.sustainable).toBeCloseTo(36164, -1);
    expect(p.scenarios.converting.sustainable).toBeCloseTo(35887, -1);
    expect(p.winner).toBe('pretax');
    expect(p.lead).toBeCloseTo(0.0077, 3);
    const s = p.scenarios;
    expect(p).toMatchObject(threeWayWinner({ roth: s.roth.sustainable, pretax: s.pretax.sustainable, converting: s.converting.sustainable }));
  }, 30000);
});

describe('the page address', () => {
  it('#/scenarios/three-way opens the three-scenario page; #/scenarios stays the Visualization page', () => {
    expect(routeFromHash(THREE_WAY_HASH)).toBe('threeWay');
    expect(routeFromHash('#/scenarios')).toBe('scenarios');
    expect(routeFromHash('#/scenarios/three-wayx')).toBe('app');
  });
});
