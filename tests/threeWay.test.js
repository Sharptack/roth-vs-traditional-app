import { describe, it, expect } from 'vitest';
import { lastsInAll, threeWayPoint, threeWayRanking, threeWayValues, threeWayWinner } from '../src/lib/threeWay.js';
import {
  THREE_WAY_POINTS,
  THREE_WAY_AGES,
  THREE_WAY_INCOMES,
  THREE_WAY_BALANCES,
  THREE_WAY_SAMPLE,
  THREE_WAY_SAVINGS_STEPS,
} from '../src/data/threeWayGrid.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { compareWithConversions } from '../src/lib/lowerYearConversions.js';
import { lifetimeOptions } from '../src/lib/lifetimeComparison.js';
import { THREE_WAY_HASH, routeFromHash } from '../src/lib/route.js';

const Y = 2026;
const compareOf = (h) => compareRothVsTraditional({ ...householdToCompareInputs(h), skipBlend: true });

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

  it('lower is better (lifetime tax): the least wins, the lead is how much less than the next best', () => {
    // Pre-tax 150 is least; conversions 160 are (160 - 150) / 150 = 6.7% above, not tied.
    // lead = (160 - 150) / 160 = 0.0625
    const w = threeWayWinner({ roth: 200, pretax: 150, converting: 160 }, { lowerIsBetter: true });
    expect(w).toEqual({ winner: 'pretax', tied: ['pretax'], lead: 0.0625 });
  });

  it('lower is better: within 0.5% of the least is even, (100.4 - 100) / 100 = 0.4%', () => {
    // lead = 0.4 / 100.4 = 0.0039840637
    const w = threeWayWinner({ roth: 100, pretax: 110, converting: 100.4 }, { lowerIsBetter: true });
    expect(w.winner).toBe('even');
    expect(w.tied).toEqual(['roth', 'converting']);
    expect(w.lead).toBeCloseTo(0.0039840637, 9);
  });
});

describe('threeWayRanking (HAND CALC on made-up points)', () => {
  // after-tax wealth = Pre-tax left x (1 - heirs' rate) + the rest
  const s = (pretaxLeft, rest, totalTax, sustainable) => ({
    endingAt: { 0.24: pretaxLeft * 0.76 + rest, 0.12: pretaxLeft * 0.88 + rest, 0: pretaxLeft + rest },
    totalTax,
    sustainable,
  });
  // Roth: 1,000,000 all Roth. Pre-tax: 1,200,000 Pre-tax left. Conversions: 600,000 Pre-tax + 500,000 Roth.
  const point = {
    scenarios: {
      roth: s(0, 1000000, 300000, 50000),
      pretax: s(1200000, 0, 400000, 51000),
      converting: s(600000, 500000, 350000, 50500),
    },
    noConversions: false,
    allRunOut: false,
  };

  it("the heirs' rate decides wealth", () => {
    // 24%: Roth 1,000,000; Pre-tax 912,000; conversions 456,000 + 500,000 = 956,000 -> Roth, by
    // 44,000 / 956,000 = 4.60%.
    const at24 = threeWayRanking(point, { heirRate: 0.24 });
    expect(at24.measure).toBe('wealth');
    expect(at24.values).toEqual({ roth: 1000000, pretax: 912000, converting: 956000 });
    expect(at24.winner).toBe('roth');
    expect(at24.lead).toBeCloseTo(44000 / 956000, 12);
    // the default is the app's 24%
    expect(threeWayRanking(point)).toEqual(at24);
    // 12%: Pre-tax 1,056,000; conversions 528,000 + 500,000 = 1,028,000; Roth 1,000,000 -> Pre-tax.
    expect(threeWayRanking(point, { heirRate: 0.12 }).winner).toBe('pretax');
    // 0%: Pre-tax 1,200,000, ahead of conversions' 1,100,000 by 100,000 / 1,100,000 = 9.09%.
    const at0 = threeWayRanking(point, { heirRate: 0 });
    expect(at0.winner).toBe('pretax');
    expect(at0.lead).toBeCloseTo(100000 / 1100000, 12);
  });

  it('by lifetime tax, the least wins', () => {
    // Roth 300,000 is least; conversions 350,000: lead = 50,000 / 350,000
    const t = threeWayRanking(point, { by: 'tax' });
    expect(t.measure).toBe('tax');
    expect(t.winner).toBe('roth');
    expect(t.lead).toBeCloseTo(50000 / 350000, 12);
  });

  it('no conversions: the conversions scenario sits out', () => {
    expect(Object.keys(threeWayRanking({ ...point, noConversions: true }).values)).toEqual(['roth', 'pretax']);
    expect(Object.keys(threeWayRanking({ ...point, noConversions: true }, { by: 'tax' }).values)).toEqual(['roth', 'pretax']);
  });

  it('the money runs out in all three: sustainable spending, all three in, whatever was asked', () => {
    // Pre-tax 51,000 best; conversions (51,000 - 50,500) / 51,000 = 0.98% behind: Pre-tax, by 500 / 50,500.
    for (const by of ['wealth', 'tax']) {
      const r = threeWayRanking({ ...point, noConversions: true, allRunOut: true }, { by });
      expect(r.measure).toBe('sustainable');
      expect(r.values).toEqual({ roth: 50000, pretax: 51000, converting: 50500 });
      expect(r.winner).toBe('pretax');
      expect(r.lead).toBeCloseTo(500 / 50500, 12);
    }
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
    expect(h.futureContributions.contributions.reduce((sum, c) => sum + c.amount, 0)).toBe(15000);
    expect(h.accounts.filter((a) => a.balance > 0)).toEqual([expect.objectContaining({ type: 'pretax', balance: 500000 })]);
    expect(h.spending.debtPaymentsEnding).toBe(0);
  });

  it('a raised savings rate: 25% of $150,000 = $37,500', () => {
    const h = toHouseholdV2(threeWayValues({ age: 45, income: 150000, balance: 500000 }, THREE_WAY_SAMPLE, 0.25), Y);
    expect(h.futureContributions.contributions.reduce((sum, c) => sum + c.amount, 0)).toBe(37500);
  });
});

describe('threeWayPoint', () => {
  it("is the Roth page's comparison with conversions, run on the sample household", () => {
    // Lasts at 10%, so 10%.
    const point = { age: 55, income: 250000, balance: 1500000 };
    const p = threeWayPoint(point, Y);
    expect(p.savingsRate).toBe(0.1);
    expect(p.raised).toBe(false);
    expect(p.unfunded).toBe(false);
    const h = toHouseholdV2(threeWayValues(point), Y);
    const r = compareOf(h);
    expect(lastsInAll(h, r)).toBe(true);
    const c = compareWithConversions(h, r, lifetimeOptions(h));
    expect(p.scenarios.roth.endingAt[0.24]).toBe(c.without.roth.summary.endingAfterTax);
    expect(p.scenarios.pretax.endingAt[0.24]).toBe(c.without.pretax.summary.endingAfterTax);
    expect(p.scenarios.converting.endingAt[0.24]).toBe(c.with.pretax.summary.endingAfterTax);
    expect(p.scenarios.converting.totalTax).toBe(c.with.pretax.summary.totalTax);
    expect(p.scenarios.converting.sustainable).toBe(c.with.pretax.sustainable);
    expect(p.scenarios.converting.converted).toBe(c.converted.pretax);
    expect(p.need).toBe(c.without.need);
    expect(p.rate).toBe(c.rate);
    expect(p.noConversions).toBe(false);
    expect(p.allRunOut).toBe(false);
    // Wealth is linear in the heirs' rate (Pre-tax left x (1 - rate) + the rest): 12% is halfway
    // between 0% and 24%, and 0% minus 24% is 24% of the Pre-tax left.
    for (const k of ['roth', 'pretax', 'converting']) {
      const e = p.scenarios[k].endingAt;
      expect(e[0.12]).toBeCloseTo((e[0] + e[0.24]) / 2, 4);
    }
    const left = c.with.pretax.rows.at(-1).endBalances.pretax;
    expect(p.scenarios.converting.endingAt[0] - p.scenarios.converting.endingAt[0.24]).toBeCloseTo(0.24 * left, 4);
  }, 30000);

  it('no room to convert: the conversions scenario is Pre-tax itself', () => {
    // $50,000 pay: today's rate is 12%, and nothing is below it but 10%, which Social Security and the
    // Pre-tax withdrawals already fill at this spending.
    const p = threeWayPoint({ age: 25, income: 50000, balance: 0 }, Y);
    expect(p.savingsRate).toBe(0.1);
    expect(p.noConversions).toBe(true);
    expect(p.scenarios.converting.endingAt).toEqual(p.scenarios.pretax.endingAt);
  }, 30000);

  it('runs out at 10%: the savings rate goes up the steps to the first at which all three last', () => {
    // 45, $50,000 pay, nothing saved yet: at 10% each scenario runs out before 95.
    const point = { age: 45, income: 50000, balance: 0 };
    const at10 = toHouseholdV2(threeWayValues(point), Y);
    expect(lastsInAll(at10, compareOf(at10))).toBe(false);
    const p = threeWayPoint(point, Y);
    expect(p.raised).toBe(true);
    expect(p.unfunded).toBe(false);
    expect(THREE_WAY_SAVINGS_STEPS).toContain(p.savingsRate);
    expect(p.allRunOut).toBe(false);
    for (const k of ['roth', 'pretax', 'converting']) expect(p.scenarios[k].runsOut).toBe(false);
    // the step below it does not last
    const tries = [THREE_WAY_SAMPLE.savingsRate, ...THREE_WAY_SAVINGS_STEPS];
    const below = tries[tries.indexOf(p.savingsRate) - 1];
    const h = toHouseholdV2(threeWayValues(point, THREE_WAY_SAMPLE, below), Y);
    expect(lastsInAll(h, compareOf(h))).toBe(false);
  }, 60000);

  it('no step lasts: unfunded, run at the sample rate, and ranked by sustainable spending', () => {
    // No steps to try. Sustainable spending (2026): Roth 35,075, Pre-tax 36,164, with conversions
    // 35,887 (rounded). HAND CALC on those: Pre-tax is best; conversions are (36,164 - 35,887) / 36,164
    // = 0.77% behind, more than 0.5%, so Pre-tax wins outright, by 277 / 35,887 = 0.77%.
    const p = threeWayPoint({ age: 45, income: 50000, balance: 0 }, Y, THREE_WAY_SAMPLE, []);
    expect(p.unfunded).toBe(true);
    expect(p.savingsRate).toBe(0.1);
    expect(p.allRunOut).toBe(true);
    for (const k of ['roth', 'pretax', 'converting']) expect(p.scenarios[k].endingAt[0.24]).toBe(0);
    expect(p.scenarios.roth.sustainable).toBeCloseTo(35075, -1);
    expect(p.scenarios.pretax.sustainable).toBeCloseTo(36164, -1);
    expect(p.scenarios.converting.sustainable).toBeCloseTo(35887, -1);
    const r = threeWayRanking(p);
    expect(r.measure).toBe('sustainable');
    expect(r.winner).toBe('pretax');
    expect(r.lead).toBeCloseTo(0.0077, 3);
  }, 30000);
});

describe('the page address', () => {
  it('#/scenarios/three-way opens the three-scenario page; #/scenarios stays the Visualization page', () => {
    expect(routeFromHash(THREE_WAY_HASH)).toBe('threeWay');
    expect(routeFromHash('#/scenarios')).toBe('scenarios');
    expect(routeFromHash('#/scenarios/three-wayx')).toBe('app');
  });
});
