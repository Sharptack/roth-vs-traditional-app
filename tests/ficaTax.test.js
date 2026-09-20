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
