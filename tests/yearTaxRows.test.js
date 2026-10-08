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

  it('the ordinary subtotal shows only when something sits between it and federal income tax', () => {
    // wages 60,000 single: taxable 60,000 - 16,100 = 43,900; 1,240 + 12% x 31,500 (3,780) = 5,020
    const wagesOnly = rowsFor({ filingStatus: 'single', year: Y, people: [{ wages: 60000 }] });
    expect(wagesOnly.get('ordinaryTax')).toBeUndefined();
    expect(wagesOnly.get('incomeTax').value).toBeCloseTo(5020, 6);
    // with gains, ordinary and federal income tax differ, so both lines stay
    const withGains = rowsFor({ filingStatus: 'single', year: Y, people: [{ wages: 60000 }], income: { preferentialIncome: 10000 } });
    expect(withGains.get('ordinaryTax').value).toBeCloseTo(5020, 6);
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

  it('Social Security: provisional income and the taxable part, then AGI and the deductions', () => {
    // single, 67: pension 40,000, benefits 30,000
    //   provisional 40,000 + 15,000 = 55,000; taxable SS min(25,500, 85% × 21,000 + 4,500 = 22,350) = 22,350 (74.5%)
    //   AGI 62,350; deductions 16,100 + 2,050 + 6,000 = 24,150; taxable 38,200
    const { rows, get } = rowsFor({ filingStatus: 'single', year: Y, people: [{ age: 67 }], income: { ordinaryIncome: 40000, socialSecurity: 30000 } });
    expect(get('provisional').value).toBe(55000);
    expect(get('taxableSocialSecurity').value).toBeCloseTo(22350, 6);
    expect(get('taxableSocialSecurity').label).toContain('74.5% of the benefits');
    expect(get('agi').value).toBeCloseTo(62350, 6);
    expect(get('magi').value).toBeCloseTo(62350, 6);
    expect(['standardDeduction', 'additional65', 'senior'].map((k) => get(k).value)).toEqual([16100, 2050, 6000]);
    expect(get('taxableIncome').value).toBeCloseTo(38200, 6);
    // rows that don't apply are left out
    for (const k of ['wages', 'wagesPayroll', 'gainsHeading', 'nii', 'niit', 'itemized', 'qbi', 'payrollTax']) expect(rows.find((x) => x.key === k), k).toBeUndefined();
  });

  it('payroll tax sits beside the earned income; itemized and QBI deductions when taken', () => {
    // wages 100,000: FICA 6,200 + 1,450 = 7,650
    const w = rowsFor({ filingStatus: 'single', year: Y, people: [{ wages: 100000 }], itemizedDeductions: 30000 });
    expect(w.get('wagesPayroll').value).toBeCloseTo(7650, 6);
    expect(w.get('wagesPayroll').kind).toBe('tax');
    expect(w.get('itemized').value).toBe(30000);
    expect(w.get('standardDeduction')).toBeUndefined();
    expect(w.rows.find((x) => x.key === 'ssHeading')).toBeUndefined();
    // the $100,000 1099 case (qbi.test.js): SE tax 14,129.55, QBI deduction 15,367.045
    const se = rowsFor({ filingStatus: 'single', year: Y, people: [{ selfEmploymentIncome: 100000 }], qbi: true });
    expect(se.get('sePayroll').value).toBeCloseTo(14129.55, 6);
    expect(se.get('qbi').value).toBeCloseTo(15367.045, 6);
    expect(se.get('totalTax').value).toBeCloseTo(8235.0 + 14129.55, 2);
  });

  it('bracketSlices splits a range across brackets', () => {
    const b = [{ rate: 0.1, upTo: 100 }, { rate: 0.2, upTo: 200 }, { rate: 0.3, upTo: Infinity }];
    expect(bracketSlices(50, 250, b).map((s) => [s.rate, s.from, s.to])).toEqual([[0.1, 50, 100], [0.2, 100, 200], [0.3, 200, 250]]);
    expect(bracketSlices(0, 0, b)).toEqual([]);
  });
});
