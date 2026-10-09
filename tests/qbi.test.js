import { describe, it, expect } from 'vitest';
import { qbiDeduction } from '../src/lib/qbi.js';
import { calculateYearTax, calculateYearTaxTotals } from '../src/lib/yearTax.js';

// 2026 figures (Rev. Proc. 2025-32): single threshold $201,750, phase-in to $276,750; joint
// $403,500 to $553,500; at least $400 for $1,000 or more of QBI.
describe('qbiDeduction (basic rule)', () => {
  it('20% of QBI below the threshold, capped at 20% of taxable income less net capital gain', () => {
    // 20% × 50,000 = 10,000; cap 20% × (100,000 − 0) = 20,000 -> 10,000
    expect(qbiDeduction({ qbi: 50000, taxableIncome: 100000, filingStatus: 'single', year: 2026 }).deduction).toBeCloseTo(10000, 6);
    // with $20,000 of gains: cap 20% × (60,000 − 20,000) = 8,000 < 10,000 -> 8,000
    expect(qbiDeduction({ qbi: 50000, taxableIncome: 60000, netCapitalGain: 20000, filingStatus: 'single', year: 2026 }).deduction).toBeCloseTo(8000, 6);
  });

  it('shrinks in a straight line across the phase-in range (no W-2 wages or property)', () => {
    // halfway: (239,250 − 201,750) / 75,000 = 0.5 -> 20% × 200,000 × 0.5 = 20,000; cap 47,850
    const half = qbiDeduction({ qbi: 200000, taxableIncome: 239250, filingStatus: 'single', year: 2026 });
    expect(half.phaseIn).toBeCloseTo(0.5, 9);
    expect(half.deduction).toBeCloseTo(20000, 6);
    // joint, at the threshold: the full 20% (20% × 300,000 = 60,000; cap 80,700)
    expect(qbiDeduction({ qbi: 300000, taxableIncome: 403500, filingStatus: 'mfj', year: 2026 }).deduction).toBeCloseTo(60000, 6);
  });

  it('from 2026, at least $400 for $1,000 or more of QBI, never more than taxable income', () => {
    // past the phase-in: 0 -> the $400 minimum
    const past = qbiDeduction({ qbi: 250000, taxableIncome: 300000, filingStatus: 'single', year: 2026 });
    expect(past.deduction).toBe(400);
    expect(past.minimumApplied).toBe(true);
    // $1,500 of QBI, $1,000 taxable: 20% × 1,500 = 300, cap 200 -> minimum 400 (taxable income allows it)
    expect(qbiDeduction({ qbi: 1500, taxableIncome: 1000, filingStatus: 'single', year: 2026 }).deduction).toBe(400);
    expect(qbiDeduction({ qbi: 1500, taxableIncome: 300, filingStatus: 'single', year: 2026 }).deduction).toBe(300);
    // under $1,000 of QBI: no minimum (20% × 900 = 180)
    expect(qbiDeduction({ qbi: 900, taxableIncome: 50000, filingStatus: 'single', year: 2026 }).deduction).toBeCloseTo(180, 6);
    // 2025 had no minimum, and a $50,000 range: past $247,300 -> 0
    expect(qbiDeduction({ qbi: 250000, taxableIncome: 300000, filingStatus: 'single', year: 2025 }).deduction).toBe(0);
  });

  it('nothing without QBI or taxable income', () => {
    expect(qbiDeduction({ qbi: 0, taxableIncome: 50000, filingStatus: 'single', year: 2026 }).deduction).toBe(0);
    expect(qbiDeduction({ qbi: 5000, taxableIncome: 0, filingStatus: 'single', year: 2026 }).deduction).toBe(0);
  });
});

describe('the tax engine with the qbi option', () => {
  // Single, 2026, $100,000 of 1099 income and nothing else, worked by hand:
  //   net earnings 100,000 × 0.9235 = 92,350; SE tax 92,350 × 15.3% = 14,129.55; half = 7,064.775
  //   AGI = QBI = 100,000 − 7,064.775 = 92,935.225; taxable before QBI 92,935.225 − 16,100 = 76,835.225
  //   QBI: 20% × 92,935.225 = 18,587.045; cap 20% × 76,835.225 = 15,367.045 -> 15,367.045
  //   taxable 61,468.18: 10% × 12,400 + 12% × 38,000 + 22% × 11,068.18 = 1,240 + 4,560 + 2,435.00 = 8,235.00
  //   without QBI: 1,240 + 4,560 + 22% × 26,435.225 (5,815.75) = 11,615.75
  const params = { filingStatus: 'single', year: 2026, people: [{ wages: 0, selfEmploymentIncome: 100000 }] };

  it('takes the deduction and taxes the rest', () => {
    const r = calculateYearTaxTotals({ ...params, qbi: true });
    expect(r.lines.qualifiedBusinessIncome).toBeCloseTo(92935.225, 6);
    expect(r.lines.qbiDeduction).toBeCloseTo(15367.045, 6);
    expect(r.lines.taxableIncome).toBeCloseTo(61468.18, 6);
    expect(r.incomeTax).toBeCloseTo(8235.0, 2);
    expect(calculateYearTaxTotals(params).incomeTax).toBeCloseTo(11615.75, 2);
  });

  it('is off by default, and leaves W-2 wages alone', () => {
    expect(calculateYearTaxTotals(params).lines.qbiDeduction).toBe(0);
    const w2 = { filingStatus: 'single', year: 2026, people: [{ wages: 100000, selfEmploymentIncome: 0 }] };
    expect(calculateYearTaxTotals({ ...w2, qbi: true }).incomeTax).toBe(calculateYearTaxTotals(w2).incomeTax);
  });

  it('the next 1099 dollar is taxed less: the deduction grows with it', () => {
    // At the cap the deduction is 20% of taxable income, so a dollar more of taxable income adds 0.8 of a
    // dollar after QBI: 22% × 0.8 = 17.6% of the dollar's taxable part (after half SE tax: × 0.9293), ≈ 16.4%.
    const r = calculateYearTax({ ...params, qbi: true });
    const seHalf = 1 - 0.9235 * 0.153 / 2; // the share of a 1099 dollar left after the SE-tax deduction
    expect(r.marginalRates.selfEmploymentIncome.incomeTax).toBeCloseTo(0.22 * 0.8 * seHalf, 4);
  });
});

describe('the Roth comparison takes QBI on 1099 earnings (version 2 households)', () => {
  it('today: the same $8,235.00 as the engine, and a 17.6% rate on the next dollar', async () => {
    const { DEFAULT_HOUSEHOLD_VALUES: D, updateRow } = await import('../src/lib/householdValues.js');
    const { toHouseholdV2 } = await import('../src/lib/householdV2.js');
    const { householdToCompareInputs } = await import('../src/lib/household.js');
    const { compareRothVsTraditional } = await import('../src/lib/compare.js');
    // single, $100,000 of 1099 income, saving Roth (so nothing is deducted Pre-tax)
    let v = updateRow(D, 'incomes', 'i1', 'type', '1099');
    v = updateRow(v, 'contributions', 'c1', 'tax', 'roth');
    const r = compareRothVsTraditional(householdToCompareInputs(toHouseholdV2(v, 2026)));
    // as worked above: QBI deduction 15,367.045, taxable income 61,468.18, tax 8,235.00
    expect(r.retirementNeed.breakdown.qbiDeduction).toBeCloseTo(15367.045, 4);
    expect(r.current.taxableIncome).toBeCloseTo(61468.18, 4);
    expect(r.current.tax).toBeCloseTo(8235.0, 2);
    // the marginal rate today stays the bracket: taxable 61,468.18 is in 22%
    expect(r.current.marginalRate).toBe(0.22);
  });
});

// A 1099 row whose business doesn't qualify (decided 2026-10-09: a yes/no on each 1099 row).
// Worked by hand, single, 2026, $100,000 of 1099 income, $60,000 of it qualifying:
//   net SE earnings 100,000 × 0.9235 = 92,350 (under the $184,500 wage base)
//   SE tax 92,350 × 15.3% = 14,129.55; half deducted: 7,064.775
//   QBI = 60,000 × (1 − 7,064.775 / 100,000) = 55,761.135 (the qualifying share of net earnings)
//   AGI 92,935.225; taxable before QBI 92,935.225 − 16,100 = 76,835.225 (under $201,750)
//   tentative 20% × 55,761.135 = 11,152.227; limit 20% × 76,835.225 = 15,367.045 -> 11,152.227
//   All qualifying: tentative 18,587.045, capped at 15,367.045. None: 0.
describe('QBI on the qualifying share of 1099 income', () => {
  const tax = (people) => calculateYearTaxTotals({ filingStatus: 'single', year: 2026, people, qbi: true });
  it('a person with part of their 1099 income from a business that does not qualify', () => {
    expect(tax([{ age: 45, wages: 0, selfEmploymentIncome: 100000, qbiShare: 0.6 }]).lines.qbiDeduction).toBeCloseTo(11152.227, 2);
    expect(tax([{ age: 45, wages: 0, selfEmploymentIncome: 100000 }]).lines.qbiDeduction).toBeCloseTo(15367.045, 2);
    expect(tax([{ age: 45, wages: 0, selfEmploymentIncome: 100000, qbiShare: 0 }]).lines.qbiDeduction).toBe(0);
  });

  it('from the household: the yes/no on each 1099 row, in the tax calculator, the Roth comparison and the projection', async () => {
    const { toHouseholdV2 } = await import('../src/lib/householdV2.js');
    const { householdToYearTaxParams } = await import('../src/lib/taxCalculator.js');
    const { householdToCompareInputs } = await import('../src/lib/household.js');
    const { compareRothVsTraditional } = await import('../src/lib/compare.js');
    const { runProjection } = await import('../src/lib/projection.js');
    const { DEFAULT_HOUSEHOLD_VALUES: D } = await import('../src/lib/householdValues.js');
    const v = {
      ...D,
      incomes: [
        { ...D.incomes[0], id: 'i1', type: '1099', amount: '60000', qbi: 'yes' },
        { ...D.incomes[0], id: 'i2', type: '1099', amount: '40000', qbi: 'no' },
        D.incomes[1],
      ],
      contributions: [],
    };
    const h = toHouseholdV2(v, 2026);
    expect(h.people[0].qbiShare).toBeCloseTo(0.6, 12);
    const params = householdToYearTaxParams(h);
    expect(calculateYearTaxTotals(params).lines.qbiDeduction).toBeCloseTo(11152.227, 2);
    // the Roth comparison's tax today: the same deduction
    const r = compareRothVsTraditional({ ...householdToCompareInputs(h), skipBlend: true });
    expect(r.current.qbiDeduction).toBeCloseTo(11152.227, 2);
    // the projection's first year (working, no contributions)
    expect(runProjection(h).rows[0].incomeTax).toBeCloseTo(calculateYearTaxTotals(params).incomeTax, 6);
    // every row qualifying (the default): the full deduction
    const all = toHouseholdV2({ ...v, incomes: v.incomes.map((x) => ({ ...x, qbi: 'yes' })) }, 2026);
    expect(all.people[0].qbiShare).toBeUndefined();
    expect(calculateYearTaxTotals(householdToYearTaxParams(all)).lines.qbiDeduction).toBeCloseTo(15367.045, 2);
  });
});
