import { describe, it, expect } from 'vitest';
import { calculateTaxableSocialSecurity as taxableSS } from '../src/lib/socialSecurityTax.js';

const Y = 2025;

// Single thresholds: $25,000 / $34,000 (band width $9,000; 50% tier max $4,500)
// MFJ thresholds:    $32,000 / $44,000 (band width $12,000; 50% tier max $6,000)

describe('calculateTaxableSocialSecurity — Single (hand-computed)', () => {
  it('0% taxable at or below the lower threshold', () => {
    // combined = 10,000 + 0.5 x 20,000 = 20,000 < 25,000
    expect(taxableSS(10000, 20000, 'single', Y)).toBe(0);
    // combined exactly 25,000: 15,000 + 10,000
    expect(taxableSS(15000, 20000, 'single', Y)).toBe(0);
  });

  it('phase-in tier: 50% of the excess over the lower threshold', () => {
    // combined = 20,000 + 10,000 = 30,000; excess = 5,000; 50% = 2,500 (cap 10,000)
    expect(taxableSS(20000, 20000, 'single', Y)).toBeCloseTo(2500, 6);
  });

  it('phase-in tier is capped at 50% of the benefit', () => {
    // SS 4,000: combined = 30,000 + 2,000 = 32,000; 50% x 7,000 = 3,500; cap 50% x 4,000 = 2,000
    expect(taxableSS(30000, 4000, 'single', Y)).toBeCloseTo(2000, 6);
  });

  it('exactly at the upper threshold: full 50% tier ($4,500), nothing from the 85% tier', () => {
    // SS 20,000: other 24,000 -> combined 34,000. 50% x 9,000 = 4,500
    expect(taxableSS(24000, 20000, 'single', Y)).toBeCloseTo(4500, 6);
  });

  it('85% tier (HAND CALC)', () => {
    // SS 20,000, other 30,000: combined = 40,000
    //   50%-tier part = min(50% x 9,000, 50% x 20,000) = 4,500
    //   85%-tier part = 85% x (40,000 - 34,000)        = 5,100
    //   sum = 9,600; cap = 85% x 20,000 = 17,000  ->  9,600
    expect(taxableSS(30000, 20000, 'single', Y)).toBeCloseTo(9600, 6);
  });

  it('85% tier: real IRS worksheet uses $4,500 (half of the $9,000 band), not $6,000 (HAND CALC)', () => {
    // SS 24,000, other 40,000: combined = 52,000; over upper = 18,000
    //   4,500 + 85% x 18,000 (=15,300) = 19,800; cap 85% x 24,000 = 20,400  ->  19,800
    // (Using $6,000 for the first term would give 21,300 -> capped at 20,400. Wrong.)
    expect(taxableSS(40000, 24000, 'single', Y)).toBeCloseTo(19800, 6);
  });

  it('85% tier: the 50% part is capped by half the benefit when the benefit is small', () => {
    // SS 4,000, other 40,000: combined = 42,000
    //   min(4,500, 50% x 4,000 = 2,000) = 2,000; 85% x 8,000 = 6,800 -> 8,800
    //   cap 85% x 4,000 = 3,400 -> 3,400
    expect(taxableSS(40000, 4000, 'single', Y)).toBeCloseTo(3400, 6);
  });

  it('never taxes more than 85% of the benefit', () => {
    // SS 20,000, other 100,000 -> caps at 17,000
    expect(taxableSS(100000, 20000, 'single', Y)).toBeCloseTo(17000, 6);
    expect(taxableSS(5000000, 20000, 'single', Y)).toBeCloseTo(17000, 6);
  });
});

describe('calculateTaxableSocialSecurity — MFJ (hand-computed)', () => {
  it('uses the $32,000 / $44,000 thresholds', () => {
    // SS 30,000, other 25,000: combined = 40,000; 50% x (40,000 - 32,000) = 4,000
    expect(taxableSS(25000, 30000, 'mfj', Y)).toBeCloseTo(4000, 6);
    // combined = 17,000 + 15,000 = 32,000 exactly -> 0
    expect(taxableSS(17000, 30000, 'mfj', Y)).toBe(0);
  });

  it('85% tier (HAND CALC)', () => {
    // SS 30,000, other 40,000: combined = 55,000
    //   min(50% x 12,000 = 6,000, 15,000) = 6,000; 85% x (55,000 - 44,000) = 9,350
    //   sum = 15,350; cap 85% x 30,000 = 25,500  ->  15,350
    expect(taxableSS(40000, 30000, 'mfj', Y)).toBeCloseTo(15350, 6);
  });
});

describe('calculateTaxableSocialSecurity — phase-in marginal effect', () => {
  it('each extra dollar of other income adds $0.50 of taxable SS in the 50% tier', () => {
    const a = taxableSS(20000, 20000, 'single', Y);
    const b = taxableSS(20001, 20000, 'single', Y);
    expect(b - a).toBeCloseTo(0.5, 6);
  });

  it('each extra dollar adds $0.85 of taxable SS in the 85% tier', () => {
    const a = taxableSS(30000, 20000, 'single', Y);
    const b = taxableSS(30001, 20000, 'single', Y);
    expect(b - a).toBeCloseTo(0.85, 6);
  });

  it('adds nothing further once the 85% cap is hit', () => {
    const a = taxableSS(100000, 20000, 'single', Y);
    const b = taxableSS(100001, 20000, 'single', Y);
    expect(b - a).toBe(0);
  });

  it('is continuous at both thresholds', () => {
    const eps = 0.01;
    // lower threshold: other income 15,000 (combined 25,000) with SS 20,000
    expect(Math.abs(taxableSS(15000 + eps, 20000, 'single', Y) - taxableSS(15000, 20000, 'single', Y))).toBeLessThan(0.01);
    // upper threshold: other income 24,000 (combined 34,000)
    expect(Math.abs(taxableSS(24000 + eps, 20000, 'single', Y) - taxableSS(24000, 20000, 'single', Y))).toBeLessThan(0.01);
  });

  it('is monotonic non-decreasing in other income', () => {
    let previous = 0;
    for (let other = 0; other <= 150000; other += 500) {
      const t = taxableSS(other, 30000, 'single', Y);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });
});

describe('calculateTaxableSocialSecurity — edge cases', () => {
  it('is 0 with no benefit', () => {
    expect(taxableSS(100000, 0, 'single', Y)).toBe(0);
  });
  it('treats negative other income as zero', () => {
    expect(taxableSS(-5000, 20000, 'single', Y)).toBe(taxableSS(0, 20000, 'single', Y));
  });
  it('works for years beyond the data (thresholds are fixed by law)', () => {
    expect(taxableSS(30000, 20000, 'single', 2040)).toBeCloseTo(9600, 6);
  });
  it('rejects an unknown filing status', () => {
    expect(() => taxableSS(1, 1, 'hoh', Y)).toThrow(/filing status/i);
  });
});
