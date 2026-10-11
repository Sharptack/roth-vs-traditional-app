import { describe, it, expect } from 'vitest';
import {
  ownBenefitsByClaimAge,
  spousalTopUpMonthly,
  survivorFullRetirementAgeMonths,
  survivorAdjustmentFactor,
  survivorBenefitMonthly,
} from '../src/lib/socialSecurityClaiming.js';

// Hand-worked (round 2 phase 5, step a), worked out before running the code.

describe('own benefit at each claiming age (HAND CALC)', () => {
  it('born 1960 (full retirement age 67), PIA $2,000', () => {
    // 62: 60 months early = 36 x 5/9% (20%) + 24 x 5/12% (10%) = 30% off -> 70% -> 1,400
    // 63: 48 early = 20% + 12 x 5/12% (5%) = 25% -> 75% -> 1,500
    // 64: 36 early = 20% -> 80% -> 1,600
    // 65: 24 early = 24 x 5/9% = 13.333% -> 86.667% -> 1,733.33
    // 66: 12 early = 6.667% -> 93.333% -> 1,866.67
    // 67: 100% -> 2,000
    // 68: 12 x 2/3% = 8% -> 2,160;  69: 16% -> 2,320;  70: 24% -> 2,480
    const rows = ownBenefitsByClaimAge({ pia: 2000, birthYear: 1960 });
    expect(rows.map((r) => r.claimAge)).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70]);
    const expected = [1400, 1500, 1600, 1733.3333, 1866.6667, 2000, 2160, 2320, 2480];
    rows.forEach((r, i) => expect(r.monthly).toBeCloseTo(expected[i], 3));
    expect(rows[0].factor).toBeCloseTo(0.7, 10);
  });

  it('born 1957 (full retirement age 66 and 6 months), PIA $1,000', () => {
    // 62: 54 months early = 20% + 18 x 5/12% (7.5%) = 27.5% -> 725
    // 66: 6 early = 6 x 5/9% = 3.333% -> 966.67
    // 67: 6 late = 6 x 2/3% = 4% -> 1,040
    // 70: 42 late = 28% -> 1,280
    const rows = ownBenefitsByClaimAge({ pia: 1000, birthYear: 1957 });
    const at = (age) => rows.find((r) => r.claimAge === age).monthly;
    expect(at(62)).toBeCloseTo(725, 6);
    expect(at(66)).toBeCloseTo(966.6667, 3);
    expect(at(67)).toBeCloseTo(1040, 6);
    expect(at(70)).toBeCloseTo(1280, 6);
  });
});

describe('spousal top-up for a pair of claiming ages (HAND CALC)', () => {
  // A born 1960, PIA 2,000; B born 1962 (2 years younger), PIA 600, full retirement age 67.
  // B's excess = 50% x 2,000 - 600 = 400 a month.
  it('B claims at 62, A at 67: the top-up starts when A files (B is 65)', () => {
    // B is 65 when A is 67 -> start 65, 24 months early: 24 x 25/36% = 16.667% -> 83.333% x 400 = 333.33
    const r = spousalTopUpMonthly({ pia: 600, otherPia: 2000, birthYear: 1962, claimAge: 62, otherClaimAgeInOwnYears: 65 });
    expect(r.startAge).toBe(65);
    expect(r.monthly).toBeCloseTo(333.3333, 3);
  });
  it('both early: B at 62, A at 62 (B is 60 then): starts at 62', () => {
    // 60 months early: 36 x 25/36% = 25% + 24 x 5/12% = 10% -> 65% x 400 = 260
    const r = spousalTopUpMonthly({ pia: 600, otherPia: 2000, birthYear: 1962, claimAge: 62, otherClaimAgeInOwnYears: 60 });
    expect(r.startAge).toBe(62);
    expect(r.monthly).toBeCloseTo(260, 6);
  });
  it('no top-up when half the other PIA is not above their own', () => {
    expect(spousalTopUpMonthly({ pia: 1000, otherPia: 2000, birthYear: 1962, claimAge: 62, otherClaimAgeInOwnYears: 60 }).monthly).toBe(0);
  });
});

describe('survivor full retirement age and reduction (HAND CALC)', () => {
  it('survivor full retirement age by birth year (SSA table)', () => {
    expect(survivorFullRetirementAgeMonths(1939)).toBe(65 * 12);
    expect(survivorFullRetirementAgeMonths(1944)).toBe(65 * 12 + 10);
    expect(survivorFullRetirementAgeMonths(1950)).toBe(66 * 12);
    expect(survivorFullRetirementAgeMonths(1960)).toBe(66 * 12 + 8);
    expect(survivorFullRetirementAgeMonths(1962)).toBe(67 * 12);
  });
  it('71.5% at 60, straight-line to 100% at survivor full retirement age', () => {
    // Born 1960: survivor FRA 66y8m = 800 months; span from 60 = 80 months.
    expect(survivorAdjustmentFactor(60, 1960)).toBeCloseTo(0.715, 10);
    // At 62: 800 - 744 = 56 months early -> 28.5% x 56/80 = 19.95% -> 80.05%
    expect(survivorAdjustmentFactor(62, 1960)).toBeCloseTo(0.8005, 10);
    expect(survivorAdjustmentFactor(67, 1960)).toBe(1);
    // Before 60 is not possible: no benefit.
    expect(survivorAdjustmentFactor(59, 1960)).toBe(0);
  });
});

describe('survivor benefit (HAND CALC)', () => {
  // Deceased born 1960 (FRA 67), PIA 2,000. Survivor born 1962 (survivor FRA 67 = 804 months, span 84).
  const base = { deceasedPia: 2000, deceasedBirthYear: 1960, survivorBirthYear: 1962 };

  it('after an early claim (62 -> 1,400): limited to the larger of 1,400 and 82.5% of PIA (1,650)', () => {
    // Original benefit = PIA 2,000 (no credits). Limit = max(1,400, 1,650) = 1,650.
    // Survivor at 67: 2,000 x 100% = 2,000 -> limited to 1,650
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 62, deathAge: 75, survivorStartAge: 67 })).toBeCloseTo(1650, 6);
    // At 64: 804 - 768 = 36 early -> 28.5% x 36/84 = 12.2143% -> 87.7857% x 2,000 = 1,755.71 -> limited to 1,650
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 62, deathAge: 75, survivorStartAge: 64 })).toBeCloseTo(1650, 6);
    // At 60: 71.5% x 2,000 = 1,430 (under the limit)
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 62, deathAge: 75, survivorStartAge: 60 })).toBeCloseTo(1430, 6);
  });

  it('after a claim at 70: the delayed credits pass to the survivor, then the survivor reduction', () => {
    // Original benefit = 2,480. At 67: 2,480. At 60: 71.5% x 2,480 = 1,773.20
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 70, deathAge: 80, survivorStartAge: 67 })).toBeCloseTo(2480, 6);
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 70, deathAge: 80, survivorStartAge: 60 })).toBeCloseTo(1773.2, 6);
  });

  it('death before claiming: the PIA, plus the credits earned if past full retirement age', () => {
    // Died at 65 (before FRA), planned claim 70: original benefit = PIA 2,000
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 70, deathAge: 65, survivorStartAge: 67 })).toBeCloseTo(2000, 6);
    // Died at 68 before a claim at 70: 12 months of credits = 8% -> 2,160
    expect(survivorBenefitMonthly({ ...base, deceasedClaimAge: 70, deathAge: 68, survivorStartAge: 67 })).toBeCloseTo(2160, 6);
  });

  it('a PIA of 0 leaves no survivor benefit', () => {
    expect(survivorBenefitMonthly({ ...base, deceasedPia: 0, deceasedClaimAge: 67, deathAge: 80, survivorStartAge: 67 })).toBe(0);
  });
});
