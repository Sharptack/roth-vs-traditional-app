import { describe, it, expect } from 'vitest';
import { calculateFica } from '../src/lib/ficaTax.js';

const Y = 2025;

describe('calculateFica (2025, HAND CALC)', () => {
  it('$100,000: 6.2% + 1.45% = 7.65% = $7,650', () => {
    // Social Security 6.2% x 100,000 = 6,200;  Medicare 1.45% x 100,000 = 1,450
    const r = calculateFica(100000, 'single', Y);
    expect(r.socialSecurity).toBeCloseTo(6200, 6);
    expect(r.medicare).toBeCloseTo(1450, 6);
    expect(r.additionalMedicare).toBe(0);
    expect(r.total).toBeCloseTo(7650, 6);
  });

  it('$200,000 single: Social Security stops at the $176,100 wage base', () => {
    // 6.2% x 176,100 = 10,918.20;  Medicare 1.45% x 200,000 = 2,900;
    // additional Medicare: 200,000 is not ABOVE the $200,000 threshold -> 0
    //  total = 13,818.20
    const r = calculateFica(200000, 'single', Y);
    expect(r.socialSecurity).toBeCloseTo(10918.2, 6);
    expect(r.total).toBeCloseTo(13818.2, 6);
  });

  it('$300,000 single: adds the 0.9% additional Medicare above $200,000', () => {
    // 10,918.20 + 1.45% x 300,000 (4,350) + 0.9% x 100,000 (900) = 16,168.20
    expect(calculateFica(300000, 'single', Y).total).toBeCloseTo(16168.2, 6);
  });

  it('$300,000 MFJ: additional Medicare threshold is $250,000', () => {
    // 10,918.20 + 4,350 + 0.9% x 50,000 (450) = 15,718.20
    expect(calculateFica(300000, 'mfj', Y).total).toBeCloseTo(15718.2, 6);
  });

  it('$0 income owes nothing', () => {
    expect(calculateFica(0, 'single', Y).total).toBe(0);
  });

  it('uses the newest data on file for later years', () => {
    expect(calculateFica(100000, 'single', 2031).total).toBeCloseTo(7650, 6);
  });

  it('rejects an unknown filing status', () => {
    expect(() => calculateFica(1, 'hoh', Y)).toThrow(/filing status/i);
  });
});

describe('calculateFica (2026, HAND CALC)', () => {
  it('$200,000 single: Social Security stops at the $184,500 wage base', () => {
    // 6.2% x 184,500 = 11,439;  Medicare 1.45% x 200,000 = 2,900;  additional 0
    //  total = 14,339
    expect(calculateFica(200000, 'single', 2026).total).toBeCloseTo(14339, 6);
  });
  it('$100,000 is 7.65% in 2026 too', () => {
    expect(calculateFica(100000, 'single', 2026).total).toBeCloseTo(7650, 6);
  });
});

import { calculateEmploymentTaxes } from '../src/lib/ficaTax.js';

describe('calculateEmploymentTaxes — 1099 / self-employment (2025 single, HAND CALC)', () => {
  const tax = (o) => calculateEmploymentTaxes({ filingStatus: 'single', year: 2025, ...o });

  it('W-2 only matches calculateFica', () => {
    expect(tax({ wages: 100000 }).total).toBeCloseTo(calculateFica(100000, 'single', 2025).total, 8);
    expect(tax({ wages: 100000 }).selfEmployment.tax).toBe(0);
  });

  it('all 1099, $100,000: 15.3% of 92.35% of earnings', () => {
    // net earnings = 100,000 x 0.9235 = 92,350
    // Social Security 12.4% x 92,350 = 11,451.40;  Medicare 2.9% x 92,350 = 2,678.15
    // SE tax = 14,129.55 (= 15.3% x 92,350);  deductible half = 7,064.775;  additional Medicare 0
    const r = tax({ selfEmploymentIncome: 100000 });
    expect(r.selfEmployment.netEarnings).toBeCloseTo(92350, 6);
    expect(r.selfEmployment.socialSecurity).toBeCloseTo(11451.4, 6);
    expect(r.selfEmployment.medicare).toBeCloseTo(2678.15, 6);
    expect(r.selfEmployment.tax).toBeCloseTo(14129.55, 6);
    expect(r.selfEmployment.deduction).toBeCloseTo(7064.775, 6);
    expect(r.total).toBeCloseTo(14129.55, 6);
  });

  it('$60,000 W-2 + $40,000 1099', () => {
    // W-2: 6.2% x 60,000 = 3,720 + 1.45% x 60,000 = 870
    // 1099: net = 40,000 x 0.9235 = 36,940;  wage-base room = 176,100 - 60,000 = 116,100 (plenty)
    //   12.4% x 36,940 = 4,580.56;  2.9% x 36,940 = 1,071.26;  SE tax = 5,651.82;  half = 2,825.91
    // total = 3,720 + 870 + 5,651.82 = 10,241.82
    const r = tax({ wages: 60000, selfEmploymentIncome: 40000 });
    expect(r.selfEmployment.tax).toBeCloseTo(5651.82, 6);
    expect(r.selfEmployment.deduction).toBeCloseTo(2825.91, 6);
    expect(r.total).toBeCloseTo(10241.82, 6);
  });

  it('W-2 wages use up wage-base room, so less Social Security is owed on the 1099 income', () => {
    // W-2 $150,000: 6.2% = 9,300;  1.45% = 2,175
    // 1099 $100,000: net 92,350;  room = 176,100 - 150,000 = 26,100
    //   Social Security 12.4% x 26,100 = 3,236.40;  Medicare 2.9% x 92,350 = 2,678.15;  SE tax 5,914.55
    //   half = 2,957.275
    // Additional Medicare: 0.9% x (150,000 + 92,350 - 200,000 = 42,350) = 381.15
    // total = 9,300 + 2,175 + 3,236.40 + 2,678.15 + 381.15 = 17,770.70
    const r = tax({ wages: 150000, selfEmploymentIncome: 100000 });
    expect(r.selfEmployment.socialSecurity).toBeCloseTo(3236.4, 6);
    expect(r.selfEmployment.deduction).toBeCloseTo(2957.275, 6);
    expect(r.additionalMedicare).toBeCloseTo(381.15, 6);
    expect(r.total).toBeCloseTo(17770.7, 6);
  });

  it('all 1099, $250,000: Social Security stops at the wage base and Additional Medicare applies', () => {
    // net = 230,875;  Social Security 12.4% x 176,100 = 21,836.40;  Medicare 2.9% x 230,875 = 6,695.375
    // Additional Medicare 0.9% x (230,875 - 200,000 = 30,875) = 277.875
    // total = 28,809.65;  deductible half of SE tax = (21,836.40 + 6,695.375) / 2 = 14,265.8875
    const r = tax({ selfEmploymentIncome: 250000 });
    expect(r.total).toBeCloseTo(28809.65, 6);
    expect(r.selfEmployment.deduction).toBeCloseTo(14265.8875, 6);
  });

  it('W-2 wages already over the wage base: only Medicare on the 1099 income', () => {
    // W-2 $200,000: 10,918.20 + 2,900;  1099 $50,000: net 46,175, room 0
    //   Medicare 2.9% x 46,175 = 1,339.075;  Additional 0.9% x (200,000 + 46,175 - 200,000) = 415.575
    // total = 10,918.20 + 2,900 + 1,339.075 + 415.575 = 15,572.85
    const r = tax({ wages: 200000, selfEmploymentIncome: 50000 });
    expect(r.selfEmployment.socialSecurity).toBe(0);
    expect(r.total).toBeCloseTo(15572.85, 6);
  });

  it('owes nothing under $400 of net earnings', () => {
    // 400 x 0.9235 = 369.40 < 400
    expect(tax({ selfEmploymentIncome: 400 }).total).toBe(0);
    // 1,000 x 0.9235 = 923.50 -> 15.3% = 141.2955
    expect(tax({ selfEmploymentIncome: 1000 }).total).toBeCloseTo(141.2955, 6);
  });

  it('2026: same rates, higher wage base ($184,500)', () => {
    const r = calculateEmploymentTaxes({ selfEmploymentIncome: 250000, filingStatus: 'single', year: 2026 });
    // Social Security 12.4% x 184,500 = 22,878;  + 6,695.375 + 277.875 = 29,851.25
    expect(r.total).toBeCloseTo(29851.25, 6);
  });

  it('MFJ uses the $250,000 Additional Medicare threshold', () => {
    const r = calculateEmploymentTaxes({ selfEmploymentIncome: 250000, filingStatus: 'mfj', year: 2025 });
    // net 230,875 < 250,000 -> no additional Medicare; total = 21,836.40 + 6,695.375 = 28,531.775
    expect(r.additionalMedicare).toBe(0);
    expect(r.total).toBeCloseTo(28531.775, 6);
  });
});
