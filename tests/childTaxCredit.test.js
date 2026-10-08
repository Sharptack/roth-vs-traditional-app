import { describe, it, expect } from 'vitest';
import { childTaxCredit } from '../src/lib/childTaxCredit.js';
import { calculateYearTaxTotals } from '../src/lib/yearTax.js';

// 2026 (Rev. Proc. 2025-32 §3.05): $2,200 a child, up to $1,700 refundable (and 15% of earned income
// over $2,500); $500 an other dependent; less $50 per $1,000 (or part) of MAGI over $200,000 / $400,000.
const tax = (wages, filingStatus, extra) => calculateYearTaxTotals({ filingStatus, year: 2026, people: [{ wages }], ...extra });

describe('the child tax credit (2026, HAND CALC)', () => {
  it('comes off the tax in full when the tax is large enough', () => {
    // joint, 120,000: taxable 87,800 -> 2,480 + 12% × 63,000 (7,560) = 10,040; two children 4,400 -> 5,640
    expect(tax(120000, 'mfj').incomeTax).toBeCloseTo(10040, 6);
    const r = tax(120000, 'mfj', { children: 2 });
    expect(r.lines.childTaxCredit).toBe(4400);
    expect(r.incomeTax).toBeCloseTo(5640, 6);
  });

  it('phases out by $50 for each $1,000, or part of $1,000, over the threshold', () => {
    // joint, 410,500: 10,500 over -> 11 × 50 = 550; 2,200 − 550 = 1,650
    expect(tax(410500, 'mfj').incomeTax - tax(410500, 'mfj', { children: 1 }).incomeTax).toBeCloseTo(1650, 6);
    expect(childTaxCredit({ children: 1, magi: 410500, regularTax: 1e6, earnedIncome: 410500, filingStatus: 'mfj', year: 2026 }).phaseOut).toBe(550);
    // exactly 400,000: nothing off; 400,001: one part of $1,000 -> 50
    expect(childTaxCredit({ children: 1, magi: 400000, regularTax: 1e6, earnedIncome: 1, filingStatus: 'mfj', year: 2026 }).phaseOut).toBe(0);
    expect(childTaxCredit({ children: 1, magi: 400001, regularTax: 1e6, earnedIncome: 1, filingStatus: 'mfj', year: 2026 }).phaseOut).toBe(50);
  });

  it('pays out the unused part up to $1,700 a child and 15% of earned income over $2,500', () => {
    // single, 30,000: taxable 13,900 -> 1,240 + 180 = 1,420. Credit 4,400: 1,420 against the tax;
    // refundable min(2,980 left, 3,400, 15% × 27,500 = 4,125) = 2,980 -> income tax −2,980 (a refund)
    const r = tax(30000, 'single', { children: 2 });
    expect(r.lines.childTaxCreditRefundable).toBeCloseTo(2980, 6);
    expect(r.incomeTax).toBeCloseTo(-2980, 6);
    // single, 10,000, one child: no tax; refundable min(2,200, 1,700, 15% × 7,500 = 1,125) = 1,125
    expect(tax(10000, 'single', { children: 1 }).incomeTax).toBeCloseTo(-1125, 6);
  });

  it('other dependents: $500, never refundable', () => {
    // single, 60,000: taxable 43,900 -> 1,240 + 12% × 31,500 (3,780) = 5,020; less 500 = 4,520
    expect(tax(60000, 'single', { otherDependents: 1 }).incomeTax).toBeCloseTo(4520, 6);
    expect(tax(10000, 'single', { otherDependents: 1 }).incomeTax).toBe(0);
  });

  it('nothing without children or dependents (as before)', () => {
    expect(tax(120000, 'mfj').lines.childTaxCredit).toBe(0);
  });
});
