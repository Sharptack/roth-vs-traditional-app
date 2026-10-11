import { describe, it, expect } from 'vitest';
import { applyClaimAge, claimingPeople, socialSecurityView } from '../src/lib/socialSecurityCalculator.js';
import { DEFAULT_HOUSEHOLD_VALUES } from '../src/lib/householdValues.js';

// The Social Security page from a household (phase 5, step d). The couple from
// socialSecurityLifetime.test.js: A born 1960, PIA 2,000, plan-to 80, claiming at 67; B born 1962,
// PIA 600, plan-to 90, claiming at 64. Their household total there, by hand: 766,400.
const person = (id, birthYear, planToAge, pia, claimAge) => ({
  id,
  birthYear,
  retirementAge: 60,
  planToAge,
  wages: 0,
  selfEmploymentIncome: 0,
  socialSecurity: { mode: 'pia', known: false, pia, benefit: NaN, claimAge },
});
const household = (discountRate = 0) => ({
  year: 2026,
  filingStatus: 'mfj',
  people: [person('p1', 1960, 80, 2000, 67), person('p2', 1962, 90, 600, 64)],
  calculators: { socialSecurity: { discountRate } },
});

describe('claimingPeople', () => {
  it('each person: PIA, plan-to age and the plan’s claiming age', () => {
    const ps = claimingPeople(household());
    expect(ps.map((p) => [p.pia, p.planToAge, p.planClaimAge])).toEqual([[2000, 80, 67], [600, 90, 64]]);
  });
  it('no plan-to age: the projection’s end age (95)', () => {
    const h = household();
    h.people[0].planToAge = null;
    expect(claimingPeople(h)[0].planToAge).toBe(95);
  });
});

describe('socialSecurityView', () => {
  const v = socialSecurityView(household());
  it('the plan’s household total is the hand-worked 766,400', () => {
    expect(v.plan.discountedTotal).toBeCloseTo(766400, 6);
  });
  it('each person’s table: the open claiming ages, the other held at the plan’s; the plan’s row matches', () => {
    expect(v.tables[0].rows.map((r) => r.claimAge)).toEqual([66, 67, 68, 69, 70]);
    const b64 = v.tables[1].rows.find((r) => r.claimAge === 64);
    expect(b64.inPlan).toBe(true);
    expect(b64.householdTotal).toBeCloseTo(766400, 6);
    // B's own at 64: 480 a month; own lifetime 155,520 (27 years)
    expect(b64.monthly).toBeCloseTo(480, 6);
    expect(b64.ownTotal).toBeCloseTo(155520, 6);
  });
  it('break-even ages: 62 vs 67, 67 vs 70, 62 vs 70 for the person with 62 still open', () => {
    // A is 66: from 66. B is 64: 64 vs 67 vs 70.
    expect(v.tables[0].breakEvens.map((b) => [b.earlyAge, b.lateAge])).toEqual([[66, 67], [67, 70], [66, 70]]);
    expect(v.tables[1].breakEvens.map((b) => [b.earlyAge, b.lateAge])).toEqual([[64, 67], [67, 70], [64, 70]]);
  });
  it('the grid for a couple, its best cell the largest', () => {
    expect(v.grid.cells).toHaveLength(5 * 7);
    expect(v.grid.best.discountedTotal).toBe(Math.max(...v.grid.cells.map((c) => c.discountedTotal)));
  });
  it('the discount rate is the household’s', () => {
    expect(socialSecurityView(household(0.03)).discountRate).toBe(0.03);
    expect(socialSecurityView(household(0.03)).plan.discountedTotal).toBeLessThan(766400);
  });
});

describe('applyClaimAge (Use in the plan)', () => {
  it('sets the Social Security row’s starting age', () => {
    const values = {
      ...DEFAULT_HOUSEHOLD_VALUES,
      incomes: [{ id: 'i1', owner: 'p1', type: 'socialSecurity', ssMode: 'pia', amount: '2000', fromAge: '67', toAge: '' }],
    };
    const next = applyClaimAge(values, 'p1', 70);
    expect(next.incomes).toEqual([{ ...values.incomes[0], fromAge: '70' }]);
  });
  it('with no row (estimated from earnings): adds an estimate row at that age', () => {
    const values = { ...DEFAULT_HOUSEHOLD_VALUES, incomes: [] };
    const next = applyClaimAge(values, 'p2', 68);
    expect(next.incomes).toHaveLength(1);
    expect(next.incomes[0]).toMatchObject({ owner: 'p2', type: 'socialSecurity', ssMode: 'estimate', fromAge: '68' });
  });
});

describe('claimingPlanEffect (HAND CALC)', async () => {
  const { claimingPlanEffect } = await import('../src/lib/socialSecurityCalculator.js');
  const { toHouseholdV2 } = await import('../src/lib/householdV2.js');
  // One person, 66 (born 1960), retired at 60, life expectancy 80, PIA 1,000, no savings.
  const D = DEFAULT_HOUSEHOLD_VALUES;
  const values = {
    ...D,
    people: D.people.map((p) => ({ ...p, age: '66', retirementAge: '60', planToAge: '80' })),
    incomes: [{ id: 'i1', owner: 'p1', type: 'socialSecurity', ssMode: 'pia', amount: '1000', fromAge: '66', toAge: '' }],
    contributions: [],
    accounts: [{ ...D.accounts[0], balance: '0' }],
  };
  const h = toHouseholdV2(values, 2026);
  it('claiming at 66: 93.333% x 1,000 x 12 = 11,200 a year, untaxed (half is 5,600, under 25,000): ~11,200 sustainable', () => {
    const [mine] = claimingPlanEffect(h, 0);
    expect(mine.rows.map((r) => r.claimAge)).toEqual([66, 67, 68, 69, 70]);
    const at66 = mine.rows[0];
    expect(at66.inPlan).toBe(true);
    expect(at66.sustainable).toBeGreaterThan(11199);
    expect(at66.sustainable).toBeLessThanOrEqual(11200);
    expect(at66.lifetimeTax).toBe(0);
  });
  it('claiming at 67 or later: nothing this year, so no steady spending is sustainable', () => {
    const [mine] = claimingPlanEffect(h, 0);
    for (const r of mine.rows.slice(1)) expect(r.sustainable).toBe(0);
  });
});

describe('survivalView (HAND CALC on a made-up table)', async () => {
  const { survivalView } = await import('../src/lib/socialSecurityCalculator.js');
  // A table where everyone has a 10% chance of dying each year from 60 on (0 before; none past 119).
  const qs = Array.from({ length: 120 }, (_, a) => (a >= 60 ? 0.1 : 0));
  const table = { male: qs, female: qs };
  const v = socialSecurityView(household());
  const s = survivalView(v, table);
  it('one age axis from the older person’s age now (A, 66) to 105', () => {
    expect(s.ages[0]).toBe(66);
    expect(s.ages.at(-1)).toBe(105);
  });
  it('A (66 now) at 70: 0.9^4 = 0.6561; B (64 now) at 70: 0.9^6 = 0.531441', () => {
    expect(s.series[0].points.find((p) => p.x === 70).y).toBeCloseTo(0.6561, 10);
    expect(s.series[1].points.find((p) => p.x === 70).y).toBeCloseTo(0.531441, 10);
    expect(s.series[0].points[0].y).toBe(1); // alive now
  });
  it('the chance of reaching each mark: A’s life expectancy 80 = 0.9^14', () => {
    const planTo = s.reach[0].marks.find((m) => m.kind === 'planTo');
    expect(planTo.age).toBe(80);
    expect(planTo.chance).toBeCloseTo(0.9 ** 14, 10);
    // a break-even age in months: B's 64 vs 67 break-even age, from B's 64
    const be = s.reach[1].marks.find((m) => m.kind === 'breakEven');
    expect(be.chance).toBeCloseTo(0.9 ** (Math.round((be.age - 64) * 12) / 12), 10);
  });
});
