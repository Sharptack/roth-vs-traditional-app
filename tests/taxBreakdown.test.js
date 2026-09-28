import { describe, it, expect } from 'vitest';
import { explainFullTax } from '../src/lib/taxBreakdown.js';
import { calculateRetirementTax } from '../src/lib/retirementTaxStack.js';

// 2025 single: standard deduction $15,750; ordinary brackets 10% to $11,925, 12% to
// $48,475, 22% to $103,350; LTCG brackets 0% to $48,350, then 15% to $533,400; NIIT
// 3.8% above $200,000 MAGI.
describe('explainFullTax', () => {
  it('HAND CALC: ordinary income only, spanning three brackets', () => {
    // Pre-tax withdrawal 80,000, no SS, no taxable account.
    //   ordinary taxable income = 80,000 - 15,750 = 64,250
    //   10% x 11,925 = 1,192.50
    //   12% x (48,475 - 11,925 = 36,550) = 4,386.00
    //   22% x (64,250 - 48,475 = 15,775) = 3,470.50
    //   total = 9,049.00
    const r = explainFullTax({ pretaxWithdrawal: 80000, filingStatus: 'single', year: 2025 });
    expect(r.ordinaryTaxableIncome).toBeCloseTo(64250, 6);
    expect(r.ordinaryRows).toEqual([
      { rate: 0.1, from: 0, to: 11925, amount: 11925, tax: 1192.5 },
      { rate: 0.12, from: 11925, to: 48475, amount: 36550, tax: 4386 },
      { rate: 0.22, from: 48475, to: 64250, amount: 15775, tax: 3470.5 },
    ]);
    expect(r.ordinaryTax).toBeCloseTo(9049, 6);
    expect(r.capitalGainsTax).toBe(0);
    expect(r.niit).toBe(0);
    expect(r.totalTax).toBeCloseTo(9049, 6);
  });

  it('HAND CALC: capital gains stacked on top of ordinary income, split across the 0% and 15% brackets', () => {
    // Pre-tax withdrawal 40,000, taxable-account withdrawal 30,000 (all gain).
    //   ordinary taxable income = 40,000 - 15,750 = 24,250
    //   ordinary tax = 1,192.50 + 12% x (24,250 - 11,925 = 12,325 -> 1,479.00) = 2,671.50
    //   gains stack from 24,250 to 24,250+30,000 = 54,250:
    //     0% bracket: 24,250 to 48,350 = 24,100 x 0% = 0
    //     15% bracket: 48,350 to 54,250 = 5,900 x 15% = 885.00
    //   total = 2,671.50 + 885.00 = 3,556.50
    const r = explainFullTax({
      pretaxWithdrawal: 40000,
      taxableWithdrawal: 30000,
      taxableGainShare: 1,
      filingStatus: 'single',
      year: 2025,
    });
    expect(r.ordinaryTax).toBeCloseTo(2671.5, 6);
    expect(r.gainsRows).toEqual([
      { rate: 0, from: 24250, to: 48350, amount: 24100, tax: 0 },
      { rate: 0.15, from: 48350, to: 54250, amount: 5900, tax: 885 },
    ]);
    expect(r.capitalGainsTax).toBeCloseTo(885, 6);
    expect(r.totalTax).toBeCloseTo(3556.5, 6);
  });

  it('HAND CALC: Social Security phase-in and NIIT together', () => {
    // Pre-tax withdrawal 180,000, taxable-account withdrawal 60,000 (all gain), SS benefit 30,000.
    //   combined income for SS = (180,000 + 60,000) + 15,000 = 255,000, well above the upper
    //   threshold ($34,000 single), so 85% of the benefit is taxable: 0.85 x 30,000 = 25,500
    //   grossOrdinaryIncome = 180,000 + 25,500 = 205,500
    //   ordinaryTaxableIncome = 205,500 - 15,750 = 189,750 (within the 24% bracket, upTo 197,300)
    //   MAGI = 205,500 + 60,000 = 265,500; NIIT base = min(60,000, 265,500 - 200,000 = 65,500) = 60,000
    //   NIIT = 3.8% x 60,000 = 2,280
    const r = explainFullTax({
      pretaxWithdrawal: 180000,
      taxableWithdrawal: 60000,
      taxableGainShare: 1,
      ssBenefit: 30000,
      filingStatus: 'single',
      year: 2025,
    });
    expect(r.taxableSS).toBeCloseTo(25500, 6);
    expect(r.ordinaryTaxableIncome).toBeCloseTo(189750, 6);
    expect(r.magi).toBeCloseTo(265500, 6);
    expect(r.niitBase).toBeCloseTo(60000, 6);
    expect(r.niit).toBeCloseTo(2280, 6);
  });

  it('only cost basis, no gain: no capital-gains tax, whole withdrawal untaxed and out of combined income', () => {
    const r = explainFullTax({
      pretaxWithdrawal: 0,
      taxableWithdrawal: 50000,
      taxableGainShare: 0,
      filingStatus: 'single',
      year: 2025,
    });
    expect(r.capitalGains).toBe(0);
    expect(r.taxableBasis).toBe(50000);
    expect(r.capitalGainsTax).toBe(0);
    expect(r.totalTax).toBe(0);
  });

  it('AGREES WITH calculateRetirementTax on totalTax across a grid of inputs (same math, decomposed)', () => {
    let checked = 0;
    for (const filingStatus of ['single', 'mfj']) {
      for (const year of [2025, 2026]) {
        for (const pretaxWithdrawal of [0, 40000, 180000, 400000]) {
          for (const taxableWithdrawal of [0, 30000, 100000]) {
            for (const taxableGainShare of [0, 0.5, 1]) {
              for (const ssBenefit of [0, 30000]) {
                const inputs = { pretaxWithdrawal, taxableWithdrawal, taxableGainShare, ssBenefit, filingStatus, year };
                const full = explainFullTax(inputs);
                const totals = calculateRetirementTax(inputs);
                expect(Math.abs(full.totalTax - totals.totalTax)).toBeLessThan(0.005);
                expect(Math.abs(full.ordinaryTax - totals.ordinaryTax)).toBeLessThan(0.005);
                expect(Math.abs(full.capitalGainsTax - totals.capitalGainsTax)).toBeLessThan(0.005);
                expect(Math.abs(full.niit - totals.niit)).toBeLessThan(0.005);
                checked++;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});
