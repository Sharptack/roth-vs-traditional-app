import { describe, it, expect } from 'vitest';
import { ABOUT_EVEN, atRetirement, fundedStatus, lastRetirementYear, throughRetirement } from '../src/lib/funding.js';
import { runProjection } from '../src/lib/projection.js';

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
