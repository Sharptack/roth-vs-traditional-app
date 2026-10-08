import { describe, it, expect } from 'vitest';
import { catchUpMustBeRoth, phasedOut, rothIraLimit, traditionalIraDeduction } from '../src/lib/iraRules.js';

// 2026 (IR-2025-111): IRA limit $7,500, catch-up 50+ $1,100. Roth IRA phase-out $153,000-$168,000
// single, $242,000-$252,000 joint. Traditional deduction, covered: $81,000-$91,000 single,
// $129,000-$149,000 joint; not covered, spouse covered: $242,000-$252,000.
describe('the IRS phase-out reduction', () => {
  it('scales the limit by the share of the range left, up to the next $10, at least $200', () => {
    const r = { from: 153000, to: 168000 };
    expect(phasedOut(7500, 153000, r)).toBe(7500);
    // 7,500 × 8,000 / 15,000 = 4,000 exactly
    expect(phasedOut(7500, 160000, r)).toBe(4000);
    // 7,500 × 6,766 / 15,000 = 3,383 -> up to 3,390
    expect(phasedOut(7500, 161234, r)).toBe(3390);
    // 7,500 × 100 / 15,000 = 50 -> the $200 minimum
    expect(phasedOut(7500, 167900, r)).toBe(200);
    expect(phasedOut(7500, 168000, r)).toBe(0);
  });
});

describe('Roth IRA contributions', () => {
  it('phase out by income, with the catch-up included in the limit', () => {
    expect(rothIraLimit({ magi: 100000, filingStatus: 'single', year: 2026, age: 40 })).toMatchObject({ allowed: 7500, status: 'full' });
    expect(rothIraLimit({ magi: 160000, filingStatus: 'single', year: 2026, age: 40 })).toMatchObject({ allowed: 4000, status: 'reduced' });
    // age 55: 7,500 + 1,100 = 8,600; joint at 247,000: 8,600 × 5,000 / 10,000 = 4,300
    expect(rothIraLimit({ magi: 247000, filingStatus: 'mfj', year: 2026, age: 55 })).toMatchObject({ allowed: 4300, limit: 8600 });
    expect(rothIraLimit({ magi: 252000, filingStatus: 'mfj', year: 2026, age: 55 })).toMatchObject({ allowed: 0, status: 'none' });
    // 2025's range ($150,000-$165,000): at 165,000 nothing is left
    expect(rothIraLimit({ magi: 165000, filingStatus: 'single', year: 2025, age: 40 }).allowed).toBe(0);
  });
});

describe('Traditional IRA deductions', () => {
  it('phase out for someone covered by a workplace plan', () => {
    // single, covered, 85,000: 7,500 × 6,000 / 10,000 = 4,500
    expect(traditionalIraDeduction({ magi: 85000, filingStatus: 'single', year: 2026, age: 40, covered: true }).deductible).toBe(4500);
    // joint, covered, 139,000: 7,500 × 10,000 / 20,000 = 3,750
    expect(traditionalIraDeduction({ magi: 139000, filingStatus: 'mfj', year: 2026, age: 40, covered: true }).deductible).toBe(3750);
    expect(traditionalIraDeduction({ magi: 91000, filingStatus: 'single', year: 2026, age: 40, covered: true }).status).toBe('none');
  });

  it('phase out higher for someone whose spouse is covered, and never when no one is', () => {
    // joint, spouse covered, 250,000: 7,500 × 2,000 / 10,000 = 1,500
    expect(traditionalIraDeduction({ magi: 250000, filingStatus: 'mfj', year: 2026, age: 40, covered: false, spouseCovered: true }).deductible).toBe(1500);
    expect(traditionalIraDeduction({ magi: 900000, filingStatus: 'mfj', year: 2026, age: 40, covered: false }).deductible).toBe(7500);
    expect(traditionalIraDeduction({ magi: 900000, filingStatus: 'single', year: 2026, age: 40, covered: false, spouseCovered: true })).toMatchObject({ deductible: 7500, range: null });
  });
});

describe('the Roth catch-up rule (SECURE 2.0)', () => {
  it('applies from 2026 above $150,000 of prior-year FICA wages', () => {
    expect(catchUpMustBeRoth({ priorYearWages: 150000, year: 2026 })).toBe(false);
    expect(catchUpMustBeRoth({ priorYearWages: 150001, year: 2026 })).toBe(true);
    expect(catchUpMustBeRoth({ priorYearWages: 400000, year: 2025 })).toBe(false);
  });
});
