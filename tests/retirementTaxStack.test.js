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

// NIIT (3.8%) on taxable-account gains once MAGI passes $200,000 Single / $250,000 MFJ.
// MAGI = Pre-tax withdrawals + taxable Social Security + gains (Roth and cost basis excluded).
describe('calculateRetirementTax — Net Investment Income Tax', () => {
  it('adds 3.8% on gains above the threshold, on top of capital-gains tax (HAND CALC)', () => {
    // Pre-tax 200,000; taxable withdrawal 60,000 at 50% gains -> 30,000 of gain.
    // ordinary taxable = 200,000 - 15,750 = 184,250, already past the 0% gains bracket (48,350)
    //   -> all 30,000 of gain at 15% = 4,500
    // MAGI = 200,000 + 30,000 = 230,000 -> excess 30,000; NII 30,000 -> 3.8% x 30,000 = 1,140
    const r = calculateRetirementTax({ pretaxWithdrawal: 200000, taxableWithdrawal: 60000, taxableGainShare: 0.5, filingStatus: 'single', year: Y });
    expect(r.magi).toBeCloseTo(230000, 6);
    expect(r.capitalGainsTax).toBeCloseTo(4500, 2);
    expect(r.niit).toBeCloseTo(1140, 2);
    expect(r.totalTax).toBeCloseTo(r.ordinaryTax + 4500 + 1140, 2);
  });

  it('a bigger Pre-tax withdrawal exposes a fixed gain to NIIT (HAND CALC)', () => {
    // gains 30,000 (all-gain withdrawal)
    // Pre-tax 150,000: MAGI 180,000 < 200,000 -> 0
    // Pre-tax 190,000: MAGI 220,000 -> excess 20,000 < 30,000 -> 3.8% x 20,000 = 760
    const low = calculateRetirementTax({ pretaxWithdrawal: 150000, taxableWithdrawal: 30000, filingStatus: 'single', year: Y });
    const high = calculateRetirementTax({ pretaxWithdrawal: 190000, taxableWithdrawal: 30000, filingStatus: 'single', year: Y });
    expect(low.niit).toBe(0);
    expect(high.niit).toBeCloseTo(760, 2);
  });

  it('taxable Social Security counts toward MAGI (HAND CALC)', () => {
    // Pre-tax 180,000; gains 20,000; SS 40,000.
    // combined = 200,000 + 20,000 = 220,000, far past 34,000 -> taxable SS = 85% x 40,000 = 34,000
    // MAGI = 180,000 + 34,000 + 20,000 = 234,000 -> excess 34,000; NII 20,000 -> 3.8% x 20,000 = 760
    // (without SS, MAGI would be 200,000 -> no NIIT)
    const r = calculateRetirementTax({ pretaxWithdrawal: 180000, taxableWithdrawal: 20000, ssBenefit: 40000, filingStatus: 'single', year: Y });
    expect(r.taxableSS).toBeCloseTo(34000, 6);
    expect(r.magi).toBeCloseTo(234000, 6);
    expect(r.niit).toBeCloseTo(760, 2);
    const noSS = calculateRetirementTax({ pretaxWithdrawal: 180000, taxableWithdrawal: 20000, filingStatus: 'single', year: Y });
    expect(noSS.niit).toBe(0);
  });

  it('returned cost basis is not in MAGI', () => {
    // Pre-tax 190,000; taxable 100,000 at 10% gains -> 10,000 gain; MAGI 200,000 -> 0
    const r = calculateRetirementTax({ pretaxWithdrawal: 190000, taxableWithdrawal: 100000, taxableGainShare: 0.1, filingStatus: 'single', year: Y });
    expect(r.magi).toBeCloseTo(200000, 6);
    expect(r.niit).toBe(0);
  });
});
