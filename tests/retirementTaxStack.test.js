import { describe, it, expect } from 'vitest';
import { calculateRetirementTax } from '../src/lib/retirementTaxStack.js';

const Y = 2025;

// Cost basis: only the GAIN part of a taxable-account withdrawal is taxed (and
// counts toward Social Security combined income); the basis part comes back tax-free.
// 2025 single: $15,750 standard deduction; 0% capital-gains bracket up to $48,350 of taxable income.
describe('calculateRetirementTax — taxable-account cost basis', () => {
  it('50% basis halves the gain that is taxed (HAND CALC)', () => {
    // Pre-tax 60,000; taxable withdrawal 20,000 at 50% gains -> 10,000 of gain.
    // ordinary taxable = 60,000 - 15,750 = 44,250
    //   tax = 10% x 11,925 + 12% x (44,250 - 11,925) = 1,192.50 + 3,879.00 = 5,071.50
    // gains stack on 44,250: 48,350 - 44,250 = 4,100 at 0%, 5,900 at 15% = 885.00
    const r = calculateRetirementTax({ pretaxWithdrawal: 60000, taxableWithdrawal: 20000, taxableGainShare: 0.5, filingStatus: 'single', year: Y });
    expect(r.ordinaryTax).toBeCloseTo(5071.5, 2);
    expect(r.capitalGains).toBeCloseTo(10000, 6);
    expect(r.capitalGainsTax).toBeCloseTo(885, 2);
    expect(r.totalTax).toBeCloseTo(5956.5, 2);
    // all gains (the default): 20,000 -> 4,100 at 0%, 15,900 at 15% = 2,385
    const all = calculateRetirementTax({ pretaxWithdrawal: 60000, taxableWithdrawal: 20000, filingStatus: 'single', year: Y });
    expect(all.capitalGainsTax).toBeCloseTo(2385, 2);
  });

  it('only the gain counts toward Social Security combined income (HAND CALC)', () => {
    // SS 20,000; taxable withdrawal 20,000 at 50% gains -> 10,000 of other income.
    // combined = 10,000 + 20,000 / 2 = 20,000 < 25,000 -> no SS taxed.
    // All gains: combined = 20,000 + 10,000 = 30,000 -> taxable SS = 0.5 x (30,000 - 25,000) = 2,500.
    const half = calculateRetirementTax({ taxableWithdrawal: 20000, taxableGainShare: 0.5, ssBenefit: 20000, filingStatus: 'single', year: Y });
    expect(half.taxableSS).toBe(0);
    const all = calculateRetirementTax({ taxableWithdrawal: 20000, ssBenefit: 20000, filingStatus: 'single', year: Y });
    expect(all.taxableSS).toBeCloseTo(2500, 6);
  });
});
