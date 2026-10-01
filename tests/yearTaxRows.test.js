import { describe, it, expect } from 'vitest';
import { calculateYearTax } from '../src/lib/yearTax.js';
import { bracketSlices, yearTaxRows } from '../src/lib/yearTaxRows.js';

const Y = 2026;
const rowsFor = (params) => {
  const r = calculateYearTax(params);
  return { r, rows: yearTaxRows(params, r), get: (key) => yearTaxRows(params, r).find((x) => x.key === key) };
};

describe('yearTaxRows (2026, HAND CALC)', () => {
  it('wages plus gains, with NIIT: the rows walk from income to total tax', () => {
    // the engine's NIIT case: wages 220,000, gains 50,000 single
    // ordinary brackets: 1,240 / 4,560 / 12,166 / 23,058 / 680 (32% on 2,125)
    // gains: 15% on 50,000 (203,900 -> 253,900) = 7,500; NIIT 1,900; payroll 14,809
    const params = { filingStatus: 'single', year: Y, people: [{ wages: 220000 }], income: { preferentialIncome: 50000 } };
    const { rows, get } = rowsFor(params);
    expect(get('agi').value).toBe(270000);
    expect(get('taxableIncome').value).toBe(253900);
    const ordinary = rows.filter((x) => x.key.startsWith('ordinary') && x.kind === 'bracket');
    expect(ordinary.map((x) => [x.rate, x.amount])).toEqual([
      [0.1, 12400], [0.12, 38000], [0.22, 55300], [0.24, 96075], [0.32, 2125],
    ]);
    expect(ordinary.map((x) => Math.round(x.value))).toEqual([1240, 4560, 12166, 23058, 680]);
    const gains = rows.filter((x) => x.kind === 'bracket' && x.key.startsWith('gains'));
    expect(gains.map((x) => [x.rate, x.from, x.to, x.value])).toEqual([[0.15, 203900, 253900, 7500]]);
    expect(get('niit').value).toBeCloseTo(1900, 6);
    expect(get('payrollTax').value).toBeCloseTo(14809, 6);
    expect(get('totalTax').value).toBeCloseTo(65913, 6);
  });

  it('gains split across the 0% and 15% brackets', () => {
    // pension 40,000 -> ordinary taxable 23,900; gains 40,000 stack 23,900 -> 63,900
    // 0% on 23,900 -> 49,450 (25,550), 15% on 49,450 -> 63,900 (14,450 -> 2,167.50)
    const { rows } = rowsFor({ filingStatus: 'single', year: Y, income: { ordinaryIncome: 40000, preferentialIncome: 40000 } });
    expect(rows.filter((x) => x.kind === 'bracket' && x.key.startsWith('gains')).map((x) => [x.rate, x.amount, x.value])).toEqual([
      [0, 25550, 0],
      [0.15, 14450, 2167.5],
    ]);
  });

  it('bracket rows always add up to the engine totals', () => {
    for (const filingStatus of ['single', 'mfj']) {
      for (const wages of [0, 60000, 300000]) {
        for (const ordinaryIncome of [0, 25000, 120000]) {
          for (const preferentialIncome of [0, 15000, 200000]) {
            for (const socialSecurity of [0, 40000]) {
              const params = { filingStatus, year: Y, people: [{ wages, age: 66 }], income: { ordinaryIncome, preferentialIncome, socialSecurity }, rateShift: 0.01 };
              const { r, rows } = rowsFor(params);
              const sum = (prefix) => rows.filter((x) => x.kind === 'bracket' && x.key.startsWith(prefix)).reduce((a, x) => a + x.value, 0);
              expect(sum('ordinary')).toBeCloseTo(r.ordinaryTax, 8);
              expect(sum('gains')).toBeCloseTo(r.capitalGainsTax, 8);
            }
          }
        }
      }
    }
  });

  it('bracketSlices splits a range across brackets', () => {
    const b = [{ rate: 0.1, upTo: 100 }, { rate: 0.2, upTo: 200 }, { rate: 0.3, upTo: Infinity }];
    expect(bracketSlices(50, 250, b).map((s) => [s.rate, s.from, s.to])).toEqual([[0.1, 50, 100], [0.2, 100, 200], [0.3, 200, 250]]);
    expect(bracketSlices(0, 0, b)).toEqual([]);
  });
});
