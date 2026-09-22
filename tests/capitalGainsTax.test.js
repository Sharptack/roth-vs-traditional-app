import { describe, it, expect } from 'vitest';
import { calculateCapitalGainsTax as cgTax } from '../src/lib/capitalGainsTax.js';
import { getStandardDeduction } from '../src/lib/taxCalculations.js';

const Y = 2025;
// Single 2025: standard deduction $15,750; LTCG 0% <= 48,350; 15% 48,350–533,400; 20% above.
const STD_SINGLE = getStandardDeduction('single', Y); // 15,750
// MFJ 2025: standard deduction $31,500; LTCG 0% <= 96,700; 15% 96,700–600,050; 20% above.
const STD_MFJ = getStandardDeduction('mfj', Y); // 31,500

describe('calculateCapitalGainsTax — Single 2025 (hand-computed)', () => {
  it('no ordinary income, small gain entirely inside the 0% bracket', () => {
    // ordinary taxable income = 0 (income 0 < deduction). Gains stack from 0.
    // total taxable = max(0, 0 + 20,000 - 15,750) = 4,250, all under 48,350 -> 0% -> $0 tax.
    expect(cgTax(0, 20000, STD_SINGLE, 'single', Y)).toBe(0);
  });

  it('gain large enough to fill the 0% bracket and spill into 15% (HAND CALC)', () => {
    // ordinary income 0: unused deduction 15,750 shelters the first 15,750 of gain.
    // gains-in-brackets start at ordinaryTaxableIncome = 0 and run to
    //   total taxable = max(0, 80,000 - 15,750) = 64,250.
    // 0% x 48,350 (the whole 0% bracket) + 15% x (64,250 - 48,350 = 15,900) = 2,385
    expect(cgTax(0, 80000, STD_SINGLE, 'single', Y)).toBeCloseTo(2385, 6);
  });

  it('ordinary income already fills the 0% bracket, so ALL gains are taxed at 15% (HAND CALC)', () => {
    // ordinary gross 60,000 -> ordinaryTaxableIncome = 60,000 - 15,750 = 44,250 (below 48,350,
    // so part of the 0% bracket is still open for the first sliver of gain).
    // total taxable = 44,250 + 30,000 = 74,250. Gains occupy [44,250, 74,250]:
    //   0% x (48,350 - 44,250 = 4,100) + 15% x (74,250 - 48,350 = 25,900) = 3,885
    expect(cgTax(60000, 30000, STD_SINGLE, 'single', Y)).toBeCloseTo(3885, 6);
  });

  it('ordinary income alone already exceeds the 0% threshold: all gains at 15%', () => {
    // ordinary gross 80,000 -> ordinaryTaxableIncome = 64,250 (already above 48,350).
    // gains occupy [64,250, 84,250], entirely in the 15% band -> 0.15 x 20,000 = 3,000
    expect(cgTax(80000, 20000, STD_SINGLE, 'single', Y)).toBeCloseTo(3000, 6);
  });

  it('a large gain spans all three brackets (HAND CALC)', () => {
    // ordinary gross 60,000 -> ordinaryTaxableIncome 44,250. Gain 600,000: total taxable
    //   = 44,250 + 600,000 = 644,250. Gains occupy [44,250, 644,250]:
    //   0% x (48,350 - 44,250 = 4,100)
    //   15% x (533,400 - 48,350 = 485,050)
    //   20% x (644,250 - 533,400 = 110,850) = 22,170
    //   total = 0 + 72,757.50 + 22,170 = 94,927.50
    expect(cgTax(60000, 600000, STD_SINGLE, 'single', Y)).toBeCloseTo(94927.5, 6);
  });

  it('is 0 for a zero or negative gain', () => {
    expect(cgTax(60000, 0, STD_SINGLE, 'single', Y)).toBe(0);
    expect(cgTax(60000, -100, STD_SINGLE, 'single', Y)).toBe(0);
  });
});

describe('calculateCapitalGainsTax — MFJ 2025 (hand-computed)', () => {
  it('no ordinary income, gain fills part of the 0% bracket and spills to 15%', () => {
    // total taxable = max(0, 120,000 - 31,500) = 88,500, all under 96,700 -> $0
    expect(cgTax(0, 120000, STD_MFJ, 'mfj', Y)).toBe(0);
  });

  it('gain spills past the MFJ 0% threshold (HAND CALC)', () => {
    // total taxable = max(0, 150,000 - 31,500) = 118,500.
    // 0% x 96,700 + 15% x (118,500 - 96,700 = 21,800) = 3,270
    expect(cgTax(0, 150000, STD_MFJ, 'mfj', Y)).toBeCloseTo(3270, 6);
  });
});

describe('calculateCapitalGainsTax — continuity and monotonicity', () => {
  it('is continuous across each bracket threshold', () => {
    for (const status of ['single', 'mfj']) {
      const std = getStandardDeduction(status, Y);
      for (const bump of [1]) {
        const a = cgTax(0, 48350 + std - bump, std, status === 'mfj' ? 'mfj' : 'single', Y);
        const b = cgTax(0, 48350 + std + bump, std, status === 'mfj' ? 'mfj' : 'single', Y);
        expect(Math.abs(b - a)).toBeLessThan(1);
      }
    }
  });

  it('is monotonic non-decreasing as the gain grows, for fixed ordinary income', () => {
    let previous = 0;
    for (let gain = 0; gain <= 700000; gain += 5000) {
      const tax = cgTax(50000, gain, STD_SINGLE, 'single', Y);
      expect(tax).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = tax;
    }
  });

  it('is monotonic non-decreasing as ordinary income grows, for a fixed gain', () => {
    let previous = 0;
    for (let ordinary = 0; ordinary <= 200000; ordinary += 5000) {
      const tax = cgTax(ordinary, 40000, STD_SINGLE, 'single', Y);
      expect(tax).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = tax;
    }
  });

  it('never exceeds 20% of the gain', () => {
    expect(cgTax(2000000, 50000, STD_SINGLE, 'single', Y)).toBeCloseTo(0.2 * 50000, 6);
  });

  it('rejects an unknown filing status', () => {
    expect(() => cgTax(10000, 10000, STD_SINGLE, 'hoh', Y)).toThrow(/filing status/i);
  });
});

describe('calculateCapitalGainsTax — 2026 (HAND CALC)', () => {
  it('single, threshold $49,450', () => {
    const std = getStandardDeduction('single', 2026); // 16,100
    // ordinary gross 70,000 -> ordinaryTaxableIncome 53,900 (already above 49,450 threshold)
    // gains occupy [53,900, 73,900], entirely 15% -> 3,000
    expect(cgTax(70000, 20000, std, 'single', 2026)).toBeCloseTo(3000, 6);
  });
});
