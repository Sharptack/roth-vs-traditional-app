import { describe, it, expect } from 'vitest';
import { ABOUT_EVEN, atRetirement, contributionsWith, fundedStatus, lastRetirementYear, savingsNeeded, throughRetirement } from '../src/lib/funding.js';
import { runProjection } from '../src/lib/projection.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES } from '../src/lib/householdValues.js';

const Y = 2026;

// One person, 60, retiring at 62, wages $100,000, saving $10,000 a year as Roth into a $500,000 Roth
// account; 5% return, no inflation, no Social Security, no dividends: no tax on anything after work.
function saver({ endAge = 64 } = {}) {
  return {
    version: 1,
    year: Y,
    filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - 60, retirementAge: 62, wages: 100000, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [{ id: 'a1', owner: 'p1', type: 'roth', balance: 500000 }],
    futureContributions: { currentType: 'roth', accountType: '401k', contributions: [{ owner: 'p1', amount: 10000 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: { projection: { endAge } },
    assumptions: { returnRate: 0.05, inflationRate: 0, ageDeductions: false },
  };
}

describe('fundedStatus', () => {
  it('within 5% of the need is about even', () => {
    expect(ABOUT_EVEN).toBe(0.05);
    expect(fundedStatus(0.94)).toBe('under');
    expect(fundedStatus(0.95)).toBe('even');
    expect(fundedStatus(1.05)).toBe('even');
    expect(fundedStatus(1.06)).toBe('over');
    expect(fundedStatus(null)).toBe(null);
  });
});

describe('lastRetirementYear', () => {
  it('the first year no one works, no earlier than this year', () => {
    const h = saver();
    expect(lastRetirementYear(h)).toBe(2028);
    h.people.push({ ...h.people[0], id: 'p2', birthYear: Y - 55, retirementAge: 65 }); // retires 2036
    expect(lastRetirementYear(h)).toBe(2036);
    expect(lastRetirementYear({ ...saver(), people: [{ ...saver().people[0], retirementAge: 50 }] })).toBe(2026);
  });
});

describe('The two measures (HAND CALC, no tax, no Social Security)', () => {
  // Balances: 2026 (60) 500,000 x 1.05 + 10,000 = 535,000; 2027 (61) 535,000 x 1.05 + 10,000 = 571,750.
  // 2028 (62), retired: 571,750 at the start of the year.
  it('measure 1: 4% of the balance at the last retirement, after tax (none here)', () => {
    // 4% x 571,750 = 22,870 a year, against a $40,000 need: 57.175%, underfunded
    const m = atRetirement(saver(), 40000);
    expect(m.year).toBe(2028);
    expect(m.ages).toEqual([62]);
    expect(m.balances.total).toBeCloseTo(571750, 6);
    expect(m.withdrawals.total).toBeCloseTo(22870, 6);
    expect(m.totalTax).toBe(0);
    expect(m.income).toBeCloseTo(22870, 6);
    expect(m.need).toBe(40000);
    expect(m.funded).toBeCloseTo(0.57175, 9);
    expect(m.status).toBe('under');
  });

  it('measure 2: what the resources allow to the end of the plan (an annuity due)', () => {
    // Three years (62 to 64), drawn at the start of each, 5% return, nothing left:
    //   S x (1 + 1/1.05 + 1/1.05^2) = 571,750; 1 + 0.952380952 + 0.907029478 = 2.859410431
    //   S = 571,750 / 2.859410431 = 199,953.81 (the search stops within $1 below)
    // against $40,000: 499.9%, overfunded
    const m = throughRetirement(saver(), 40000);
    expect(m.sustainable).toBeLessThanOrEqual(199953.81);
    expect(m.sustainable).toBeGreaterThan(199953.81 - 1.01);
    expect(m.funded).toBeCloseTo(m.sustainable / 40000, 12);
    expect(m.status).toBe('over');
  });

  it('a couple: before the last retirement the plan runs as it stands (the 4% only once no one works)', () => {
    const h = { ...saver(), filingStatus: 'mfj' };
    h.people = [...h.people, { ...h.people[0], id: 'p2', birthYear: Y - 55, retirementAge: 65, wages: 80000 }];
    h.futureContributions = { ...h.futureContributions, contributions: [...h.futureContributions.contributions, { owner: 'p2', amount: 5000 }] };
    const m = atRetirement(h, 60000);
    expect(m.year).toBe(2036);
    const plan = runProjection(h, { need: 60000, endAge: 70 }).rows;
    expect(m.balances.total).toBeCloseTo(plan.find((r) => r.year === 2035).endBalances.total, 6);
    expect(m.withdrawals.total).toBeCloseTo(0.04 * m.balances.total, 6);
  });

  it('a need of $0 has no funded level', () => {
    expect(atRetirement(saver(), 0).funded).toBe(null);
    expect(throughRetirement(saver(), 0).status).toBe(null);
  });
});

describe('contributionsWith: the extra savings spread across the rows', () => {
  it('in proportion to today\'s amounts; less, down to none', () => {
    const h = saver();
    h.people.push({ ...h.people[0], id: 'p2' });
    h.futureContributions.contributions = [{ owner: 'p1', amount: 10000 }, { owner: 'p2', amount: 5000, currentType: 'pretax' }];
    // 15,000 + 6,000 = 21,000: x 1.4 each
    expect(contributionsWith(h, 6000)).toEqual([
      { owner: 'p1', amount: 14000, type: 'roth' },
      { owner: 'p2', amount: 7000, type: 'pretax' },
    ]);
    expect(contributionsWith(h, -20000).map((c) => c.amount)).toEqual([0, 0]);
  });

  it('no savings in the rows: to a taxable account, split by pay', () => {
    const h = saver();
    h.futureContributions.contributions = [{ owner: 'p1', amount: 0 }];
    h.people = [{ ...h.people[0], wages: 60000 }, { ...h.people[0], id: 'p2', wages: 40000 }];
    expect(contributionsWith(h, 10000)).toEqual([
      { owner: 'p1', amount: 0, type: 'roth' },
      { owner: 'p1', amount: 6000, type: 'taxable' },
      { owner: 'p2', amount: 4000, type: 'taxable' },
    ]);
  });
});

describe('savingsNeeded (HAND CALC, no tax: Roth, and taxable money at 0% gains)', () => {
  // Saving C a year for two years at 5%: B = 500,000 x 1.05^2 + 1.05 C + C = 551,250 + 2.05 C at 62.
  // (Over the Roth 401(k) limit the excess goes to a taxable account; its gains stay in the 0%
  // capital-gains bracket, under the standard deduction even, so nothing is taxed either way.)
  it('measure 1: 4% of B = the need', () => {
    // need 25,000 -> B = 625,000 -> C = 73,750 / 2.05 = 35,975.61 -> extra 25,975.61, up to 25,976
    const s = savingsNeeded(saver(), 25000, { measure: 'atRetirement' });
    expect(s.reachable).toBe(true);
    expect(s.extra).toBe(25976);
    expect(s.planned).toBe(10000);
    expect(s.total).toBe(35976);
    expect(s.pay).toBe(100000);
    expect(s.extraShareOfPay).toBeCloseTo(0.25976, 9);
    expect(s.totalShareOfPay).toBeCloseTo(0.35976, 9);
    // rerun: lands on the target; a dollar less doesn't
    expect(atRetirement(saver(), 25000, { contributions: contributionsWith(saver(), s.extra) }).funded).toBeGreaterThanOrEqual(1);
    expect(atRetirement(saver(), 25000, { contributions: contributionsWith(saver(), s.extra - 1) }).funded).toBeLessThan(1);
  });

  it('measure 2: sustainable spending = the need', () => {
    // need 250,000 for three years (an annuity due): B = 250,000 x 2.859410431 = 714,852.61
    //   -> C = 163,602.61 / 2.05 = 79,806.15 -> extra 69,806.15
    const s = savingsNeeded(saver(), 250000, { measure: 'throughRetirement' });
    expect(Math.abs(s.extra - 69806.15)).toBeLessThan(1.5);
    const rerun = throughRetirement(saver(), 250000, { contributions: contributionsWith(saver(), s.extra) });
    expect(rerun.sustainable).toBeGreaterThan(250000 - 1);
    expect(throughRetirement(saver(), 250000, { contributions: contributionsWith(saver(), s.extra - 2) }).sustainable).toBeLessThan(250000);
  });

  it('a target other than 100%', () => {
    // 80% of 25,000 = 20,000 -> B = 500,000: met saving nothing (551,250 at C = 0) -> extra -10,000
    expect(savingsNeeded(saver(), 25000, { target: 0.8 }).extra).toBe(-10000);
    // 120% -> 30,000 -> B = 750,000 -> C = 198,750 / 2.05 = 96,951.22 -> extra 86,951.22, up to 86,952
    expect(savingsNeeded(saver(), 25000, { target: 1.2 }).extra).toBe(86952);
  });

  it('already retired: met, or out of reach (no working years to save in)', () => {
    const h = saver();
    h.people[0].retirementAge = 60; // 4% of 500,000 = 20,000
    expect(savingsNeeded(h, 15000).extra).toBe(-10000);
    const out = savingsNeeded(h, 40000);
    expect(out.reachable).toBe(false);
    expect(out.extra).toBe(null);
    expect(savingsNeeded(h, 0)).toBe(null);
  });
});

describe('savingsNeeded on the default household (tax, Social Security, a Pre-tax 401(k))', () => {
  // The phase's test: each solved amount, rerun, lands on its target (and a few dollars less doesn't).
  it('each measure, rerun, lands on its target', () => {
    const h = toHouseholdV2(DEFAULT_HOUSEHOLD_VALUES, 2026);
    const need = 120000; // above what today's savings support on either measure
    for (const [measure, run] of [['atRetirement', atRetirement], ['throughRetirement', throughRetirement]]) {
      const s = savingsNeeded(h, need, { measure });
      expect(s.reachable).toBe(true);
      expect(s.extra).toBeGreaterThan(-s.planned);
      const level = (extra) => run(h, need, { contributions: contributionsWith(h, extra) }).funded;
      expect(level(s.extra)).toBeGreaterThanOrEqual(measure === 'atRetirement' ? 1 : 1 - 1 / need); // (the search stops within $1)
      expect(level(s.extra - 3)).toBeLessThan(1);
    }
  });
});
