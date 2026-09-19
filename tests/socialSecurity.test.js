import { describe, it, expect } from 'vitest';
import {
  calculatePIA,
  claimingAdjustmentFactor,
  estimateSocialSecurityBenefit,
  getFullRetirementAgeMonths,
} from '../src/lib/socialSecurity.js';

const B1 = 1226;
const B2 = 7391;
const Y = 2025;

describe('calculatePIA — bend-point formula (HAND CALC, 2025 bend points)', () => {
  it('AIME below the first bend point: 90%', () => {
    expect(calculatePIA(1000, B1, B2)).toBeCloseTo(900, 6);
  });
  it('AIME in the second tier', () => {
    // 90% x 1,226 = 1,103.40;  32% x (5,000 - 1,226 = 3,774) = 1,207.68  -> 2,311.08
    expect(calculatePIA(5000, B1, B2)).toBeCloseTo(2311.08, 6);
  });
  it('AIME above the second bend point', () => {
    // 1,103.40 + 32% x (7,391 - 1,226 = 6,165) = 1,972.80 + 15% x (8,000 - 7,391 = 609) = 91.35
    //  -> 3,167.55
    expect(calculatePIA(8000, B1, B2)).toBeCloseTo(3167.55, 6);
  });
  it('is continuous at each bend point', () => {
    expect(calculatePIA(B1 + 0.01, B1, B2) - calculatePIA(B1, B1, B2)).toBeCloseTo(0.0032, 5);
    expect(calculatePIA(B2 + 0.01, B1, B2) - calculatePIA(B2, B1, B2)).toBeCloseTo(0.0015, 5);
  });
  it('is 0 for AIME of 0', () => {
    expect(calculatePIA(0, B1, B2)).toBe(0);
  });
});

describe('getFullRetirementAgeMonths', () => {
  it('follows the SSA birth-year table', () => {
    expect(getFullRetirementAgeMonths(1937)).toBe(65 * 12);
    expect(getFullRetirementAgeMonths(1950)).toBe(66 * 12);
    expect(getFullRetirementAgeMonths(1955)).toBe(66 * 12 + 2);
    expect(getFullRetirementAgeMonths(1959)).toBe(66 * 12 + 10);
    expect(getFullRetirementAgeMonths(1960)).toBe(67 * 12);
    expect(getFullRetirementAgeMonths(1995)).toBe(67 * 12);
  });
});

describe('claimingAdjustmentFactor (HAND CALC)', () => {
  it('is 1 at full retirement age', () => {
    expect(claimingAdjustmentFactor(0)).toBe(1);
  });
  it('early: 5/9 of 1% per month for the first 36 months', () => {
    expect(claimingAdjustmentFactor(-12)).toBeCloseTo(1 - 12 * (5 / 9) / 100, 8); // 0.93333
    expect(claimingAdjustmentFactor(-36)).toBeCloseTo(0.8, 8); // 20% cut
  });
  it('early beyond 36 months: 5/12 of 1% per additional month', () => {
    // claim at 62 with FRA 67 = 60 months early: 20% + 24 x 5/12% = 30% cut
    expect(claimingAdjustmentFactor(-60)).toBeCloseTo(0.7, 8);
  });
  it('late: 8% per year (2/3 of 1% per month)', () => {
    expect(claimingAdjustmentFactor(12)).toBeCloseTo(1.08, 8);
    expect(claimingAdjustmentFactor(36)).toBeCloseTo(1.24, 8); // 67 -> 70
  });
});

describe('estimateSocialSecurityBenefit (HAND CALC)', () => {
  // Age 35 in 2025 -> born 1990 -> FRA 67.
  const base = { annualIncome: 60000, currentAge: 35, year: Y };

  it('claiming at FRA (67): PIA x 12', () => {
    // AIME = 60,000 / 12 = 5,000 -> PIA 2,311.08 -> x 12 = 27,732.96
    const r = estimateSocialSecurityBenefit({ ...base, retirementAge: 67 });
    expect(r.aime).toBeCloseTo(5000, 6);
    expect(r.pia).toBeCloseTo(2311.08, 6);
    expect(r.fullRetirementAge).toBe(67);
    expect(r.adjustmentFactor).toBe(1);
    expect(r.annualBenefit).toBeCloseTo(27732.96, 4);
  });

  it('claiming at 62: 30% reduction', () => {
    // 2,311.08 x 0.70 x 12 = 19,413.07
    const r = estimateSocialSecurityBenefit({ ...base, retirementAge: 62 });
    expect(r.annualBenefit).toBeCloseTo(19413.07, 1);
  });

  it('claiming at 70: 24% credit', () => {
    // 2,311.08 x 1.24 x 12 = 34,388.87
    const r = estimateSocialSecurityBenefit({ ...base, retirementAge: 70 });
    expect(r.annualBenefit).toBeCloseTo(34388.87, 1);
  });

  it('retiring before 62 still claims at 62 (earliest possible)', () => {
    const early = estimateSocialSecurityBenefit({ ...base, retirementAge: 55 });
    expect(early.claimingAge).toBe(62);
    expect(early.annualBenefit).toBeCloseTo(19413.07, 1);
  });

  it('retiring after 70 still claims at 70 (credits stop)', () => {
    const late = estimateSocialSecurityBenefit({ ...base, retirementAge: 75 });
    expect(late.claimingAge).toBe(70);
    expect(late.annualBenefit).toBeCloseTo(34388.87, 1);
  });

  it('caps income at the taxable wage base ($176,100)', () => {
    // AIME = 176,100 / 12 = 14,675 -> 1,103.40 + 1,972.80 + 15% x (14,675 - 7,391 = 7,284) = 1,092.60
    //  -> PIA 4,168.80
    const r = estimateSocialSecurityBenefit({ ...base, annualIncome: 300000, retirementAge: 67 });
    expect(r.aime).toBeCloseTo(14675, 6);
    expect(r.pia).toBeCloseTo(4168.8, 6);
    expect(r.annualBenefit).toBeCloseTo(50025.6, 4);
  });

  it('uses the birth year implied by age for full retirement age', () => {
    // Age 70 in 2025 -> born 1955 -> FRA 66y2m
    const r = estimateSocialSecurityBenefit({ annualIncome: 60000, currentAge: 70, retirementAge: 71, year: Y });
    expect(r.fullRetirementAge).toBeCloseTo(66 + 2 / 12, 8);
  });

  it('a person with zero income gets zero', () => {
    expect(estimateSocialSecurityBenefit({ ...base, annualIncome: 0, retirementAge: 67 }).annualBenefit).toBe(0);
  });

  it('is progressive: benefit rises with income but replaces a smaller share of it', () => {
    const low = estimateSocialSecurityBenefit({ ...base, annualIncome: 30000, retirementAge: 67 });
    const high = estimateSocialSecurityBenefit({ ...base, annualIncome: 120000, retirementAge: 67 });
    expect(high.annualBenefit).toBeGreaterThan(low.annualBenefit);
    expect(high.annualBenefit / 120000).toBeLessThan(low.annualBenefit / 30000);
  });
});
