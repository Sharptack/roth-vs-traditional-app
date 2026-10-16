import { describe, it, expect } from 'vitest';
import { DEFAULT_HOUSEHOLD_VALUES } from '../src/lib/householdValues.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { socialSecurityInYear } from '../src/lib/projection.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';

// Someone already retired, Social Security estimated from earnings (decided 2026-10-16): the
// estimate reads the W-2 / 1099 rows of the work they left, not this year's (none, or part-time).
const Y = 2026;
const row = DEFAULT_HOUSEHOLD_VALUES.incomes[0];
const values = (incomes, person = {}) => ({
  ...DEFAULT_HOUSEHOLD_VALUES,
  people: [{ ...DEFAULT_HOUSEHOLD_VALUES.people[0], ageEntry: 'age', age: '70', retirementAge: '65', ...person }],
  incomes: [...incomes.map((r, i) => ({ ...row, id: `i${i + 1}`, ...r })), { ...row, id: 'ss', type: 'socialSecurity', ssMode: 'estimate', amount: '' }],
});
const w2 = (amount, ages = {}) => ({ type: 'w2', amount: String(amount), fromAge: '', toAge: '', ...ages });
const ssOf = (v) => socialSecurityInYear(toHouseholdV2(v, Y), 0);

// HAND CALC (2026 bend points 1,286 / 7,749): $100,000 -> AIME 8,333.33; PIA = 0.9 x 1,286 (1,157.40)
// + 0.32 x 6,463 (2,068.16) + 0.15 x 584.33 (87.65) = 3,313.21. Born 1956: full retirement age 66 and
// 4 months; claimed at retirement, 65 = 16 months early, 16 x 5/9% = 8.889% off: 3,018.70 a month,
// 36,224.43 a year.
const BENEFIT_100K = 3313.21 * (1 - (16 * 5) / 9 / 100) * 12;

describe('Social Security estimate for someone retired (2026, HAND CALC)', () => {
  it('a W-2 row with blank ages (it ended at retirement): its $100,000 sets the benefit', () => {
    expect(BENEFIT_100K).toBeCloseTo(36224.43, 1);
    expect(ssOf(values([w2(100000)]))).toBeCloseTo(BENEFIT_100K, 1);
  });

  it('a row that ended at a set age counts the same; 1099 earnings count as net earnings', () => {
    expect(ssOf(values([w2(100000, { toAge: '60' })]))).toBeCloseTo(BENEFIT_100K, 1);
    // $50,000 W-2 + $54,141.53 of 1099 x 0.9235 = 50,000 + 50,000 = the same $100,000 covered
    expect(ssOf(values([w2(50000), { type: '1099', amount: '54141.53', fromAge: '', toAge: '' }]))).toBeCloseTo(BENEFIT_100K, 0);
  });

  it('part-time pay in retirement does not set the benefit; the job left does', () => {
    // a $20,000 part-time row now (from 66) beside the $100,000 job that ended at 65
    expect(ssOf(values([w2(100000), w2(20000, { fromAge: '66', toAge: '75' })]))).toBeCloseTo(BENEFIT_100K, 1);
  });

  it('only a row that has not started yet, or none: no earnings to estimate from, $0 as before', () => {
    expect(ssOf(values([w2(20000, { fromAge: '72', toAge: '75' })]))).toBe(0);
    expect(ssOf(values([]))).toBe(0);
  });

  it('still working: this year\'s earnings, unchanged', () => {
    // age 60, retiring at 65, $100,000: the household has no pastEarnings, so nothing moves
    expect(toHouseholdV2(values([w2(100000)], { age: '60' }), Y).people[0].pastEarnings).toBeUndefined();
  });

  it('the Roth page reads the same earnings for its estimate (a couple: one working, one retired)', () => {
    // you 60, retiring at 65, $80,000 now; your spouse 70, retired at 65, a $100,000 job that ended.
    // Your spouse: BENEFIT_100K (PIA 3,313.21). You: AIME 6,666.67, PIA 1,157.40 + 0.32 x 5,380.67
    // = 2,879.21; half of either PIA is below the other's own, so no spousal top-up either way.
    const v = values([w2(80000)], { age: '60' });
    const couple = {
      ...v,
      filingStatus: 'mfj',
      includeSpouse: 'yes',
      people: [...v.people, { ...v.people[0], id: 'p2', age: '70', retirementAge: '65' }],
      incomes: [...v.incomes, { ...row, id: 'i9', owner: 'p2', ...w2(100000) }, { ...row, id: 'ss2', owner: 'p2', type: 'socialSecurity', ssMode: 'estimate', amount: '' }],
    };
    const inputs = householdToCompareInputs(toHouseholdV2(couple, Y));
    expect(inputs.earners[1].pastEarnings).toEqual({ wages: 100000, selfEmploymentIncome: 0 });
    expect(inputs.earners[0].pastEarnings).toBeUndefined();
    const ss = compareRothVsTraditional(inputs).socialSecurity;
    expect(ss.people[1].ownBenefit).toBeCloseTo(BENEFIT_100K, 1);
    expect(ss.people[1].spousalTopUp ?? 0).toBe(0);
    expect(ssOf(couple)).toBeCloseTo(BENEFIT_100K, 1); // this year: only your spouse has claimed
  });
});
