// An entered PIA (the version 2 household, round 2 phase 0): the benefit at the claiming age, and
// the spousal top-up from both PIAs.
import { describe, it, expect } from 'vitest';
import { benefitFromPIA, estimateHouseholdSocialSecurity } from '../src/lib/socialSecurity.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES, newPerson } from '../src/lib/householdValues.js';
import { describeHousehold } from '../src/lib/householdText.js';
import { runProjection } from '../src/lib/projection.js';

const Y = 2026;

describe('benefitFromPIA (HAND CALC)', () => {
  // Age 62 in 2026 -> born 1964 -> full retirement age 67 (804 months).
  it('claimed at 62: 60 months early, 36 x 5/9% + 24 x 5/12% = 20% + 10% = 30% less', () => {
    // 2,400 x 0.70 = 1,680 a month = 20,160 a year
    const r = benefitFromPIA({ pia: 2400, currentAge: 62, retirementAge: 62, year: Y });
    expect(r.adjustmentFactor).toBeCloseTo(0.7, 12);
    expect(r.monthlyBenefit).toBeCloseTo(1680, 9);
    expect(r.annualBenefit).toBeCloseTo(20160, 9);
    expect(r.fullRetirementAge).toBe(67);
  });

  it('claimed at 70: 36 months late, 36 x 2/3% = 24% more; past 70 counts as 70', () => {
    // 2,400 x 1.24 = 2,976 a month = 35,712 a year
    expect(benefitFromPIA({ pia: 2400, currentAge: 62, retirementAge: 70, year: Y }).annualBenefit).toBeCloseTo(35712, 9);
    expect(benefitFromPIA({ pia: 2400, currentAge: 62, retirementAge: 72, year: Y }).annualBenefit).toBeCloseTo(35712, 9);
  });
});

describe('estimateHouseholdSocialSecurity with entered PIAs (HAND CALC)', () => {
  // p1 age 62 (born 1964), p2 age 60 (born 1966); both have full retirement age 67.
  const earner = (pia, currentAge, claimAge) => ({ earnings: 0, currentAge, claimAge, knowsSocialSecurity: false, pia });

  it('both at 67: own benefits from the PIAs, and half of p1 over p2 as a spousal top-up', () => {
    // p1: 3,000 x 12 = 36,000.  p2: 1,000 x 12 = 12,000.
    // p2's excess: 0.5 x 3,000 - 1,000 = 500 a month. p1 claims at 67, when p2 is 65; p2 claims
    // at 67, so the spousal part starts at 67, at full retirement age: factor 1 -> 6,000 a year.
    // household 36,000 + 12,000 + 6,000 = 54,000
    const r = estimateHouseholdSocialSecurity({ earners: [earner(3000, 62, 67), earner(1000, 60, 67)], year: Y });
    expect(r.people[0].annualBenefit).toBeCloseTo(36000, 9);
    expect(r.people[1].spousalTopUp).toBeCloseTo(6000, 9);
    expect(r.annualBenefit).toBeCloseTo(54000, 9);
    expect(r.estimated).toBe(false); // entered, not worked out from earnings
  });

  it('p2 claims at 64: own benefit reduced, spousal part from 65 (when p1 claims) reduced too', () => {
    // own: 36 months early -> 1 - 20% = 0.8 -> 800 a month = 9,600 a year
    // spousal starts at max(64, 65) = 65: 24 months early -> 1 - 24 x 25/36% = 0.833333...
    //   500 x 0.833333 = 416.6667 a month = 5,000 a year
    // p2 = 14,600; household 36,000 + 14,600 = 50,600
    const r = estimateHouseholdSocialSecurity({ earners: [earner(3000, 62, 67), earner(1000, 60, 64)], year: Y });
    expect(r.people[1].ownBenefit).toBeCloseTo(9600, 9);
    expect(r.people[1].spousalStartAge).toBe(65);
    expect(r.people[1].spousalTopUp).toBeCloseTo(5000, 9);
    expect(r.annualBenefit).toBeCloseTo(50600, 9);
  });

  it('an entered PIA and an estimate together: the estimate still gets its top-up', () => {
    // p2 has no earnings: estimated PIA 0, so the top-up is the whole 0.5 x 3,000 = 1,500 a month
    // at 67 = 18,000 a year; household 36,000 + 18,000 = 54,000
    const r = estimateHouseholdSocialSecurity({
      earners: [earner(3000, 62, 67), { earnings: 0, currentAge: 60, claimAge: 67, knowsSocialSecurity: false }],
      year: Y,
    });
    expect(r.people[1].pia).toBe(0);
    expect(r.people[1].spousalTopUp).toBeCloseTo(18000, 9);
    expect(r.annualBenefit).toBeCloseTo(54000, 9);
    expect(r.estimated).toBe(true);
  });
});

describe('an entered PIA through the household', () => {
  const values = {
    ...DEFAULT_HOUSEHOLD_VALUES,
    people: [newPerson('p1', { age: '62', retirementAge: '67', socialSecurity: { mode: 'pia', pia: '2400', claimAge: '' } })],
  };
  const household = toHouseholdV2(values, Y);

  it('the Roth comparison uses it (one person, claimed at retirement, 67 = full retirement age)', () => {
    // 2,400 x 12 = 28,800
    const inputs = householdToCompareInputs(household);
    expect(inputs.earners[0].pia).toBe(2400);
    const r = compareRothVsTraditional({ ...inputs, skipBlend: true });
    expect(r.valid).toBe(true);
    expect(r.socialSecurity.annualBenefit).toBeCloseTo(28800, 9);
  });

  it('a blank PIA is an error', () => {
    const blank = toHouseholdV2({ ...values, people: [{ ...values.people[0], socialSecurity: { mode: 'pia', pia: '', claimAge: '' } }] }, Y);
    const r = compareRothVsTraditional({ ...householdToCompareInputs(blank), skipBlend: true });
    expect(r.errors).toContain("Enter each person's monthly Social Security benefit at full retirement age (PIA).");
  });

  it('the projection pays it from 67', () => {
    const rows = runProjection(household, { need: 0 }).rows;
    const at = (age) => rows.find((row) => row.ages[0] === age);
    expect(at(66).socialSecurity).toBe(0);
    expect(at(67).socialSecurity).toBeCloseTo(28800, 9);
  });

  it('Copy summary says it was entered as a PIA', () => {
    expect(describeHousehold(household).join('\n')).toContain('You, Social Security: $2,400 a month at full retirement age (PIA, entered), claimed at retirement');
  });
});
