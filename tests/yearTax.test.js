import { describe, it, expect } from 'vitest';
import { calculateYearTax } from '../src/lib/yearTax.js';
import { calculateRetirementTax } from '../src/lib/retirementTaxStack.js';
import { calculateTaxFromGross } from '../src/lib/taxCalculations.js';
import { calculateEmploymentTaxes } from '../src/lib/ficaTax.js';

const Y = 2026;
// 2026 single: standard deduction 16,100; brackets 10% to 12,400, 12% to 50,400, 22% to 105,700,
// 24% to 201,775, 32% to 256,225. Capital gains single: 0% to 49,450, 15% to 545,500.
// Social Security single thresholds 25,000 / 34,000. NIIT single 200,000.

describe('calculateYearTax (2026, HAND CALC)', () => {
  it('W-2 only: $100,000 single', () => {
    // payroll 6.2% + 1.45% = 7,650
    // taxable 100,000 - 16,100 = 83,900
    // tax 10% x 12,400 (1,240) + 12% x 38,000 (4,560) + 22% x 33,500 (7,370) = 13,170
    // effective 13,170 / 100,000 = 13.17%; bracket room 105,700 - 83,900 = 21,800
    // next $100 of wages: 22% income tax, + 7.65% payroll = 29.65%
    const r = calculateYearTax({ filingStatus: 'single', year: Y, people: [{ wages: 100000 }] });
    expect(r.payrollTax).toBeCloseTo(7650, 6);
    expect(r.lines.ordinaryTaxableIncome).toBe(83900);
    expect(r.incomeTax).toBeCloseTo(13170, 6);
    expect(r.totalTax).toBeCloseTo(20820, 6);
    expect(r.effectiveRate).toBeCloseTo(0.1317, 10);
    expect(r.bracketRoom.ordinary).toEqual({ rate: 0.22, room: 21800, nextRate: 0.24 });
    expect(r.marginalRates.wages.incomeTax).toBeCloseTo(0.22, 9);
    expect(r.marginalRates.wages.total).toBeCloseTo(0.2965, 9);
  });

  it('a retiree in the Social Security phase-in: the next Pre-tax dollar is taxed at 1.85 x 10%', () => {
    // SS 30,000, Pre-tax withdrawal 20,000. Combined income 20,000 + 15,000 = 35,000 > 34,000.
    // 50% tier min(0.5 x 9,000, 15,000) = 4,500; 85% tier 0.85 x 1,000 = 850 -> taxable SS 5,350
    // ordinary 20,000 + 5,350 = 25,350; taxable 9,250 -> tax 925
    // +$100 withdrawal: +85 of SS becomes taxable -> +185 taxable, all at 10% -> 18.5%
    const r = calculateYearTax({ filingStatus: 'single', year: Y, income: { ordinaryIncome: 20000, socialSecurity: 30000 } });
    expect(r.lines.taxableSocialSecurity).toBeCloseTo(5350, 6);
    expect(r.incomeTax).toBeCloseTo(925, 6);
    expect(r.payrollTax).toBe(0);
    expect(r.marginalRates.ordinaryIncome.incomeTax).toBeCloseTo(0.185, 9);
  });

  it('a working retiree: wages plus Social Security (aged 66, so the age deductions apply)', () => {
    // wages 40,000 -> payroll 3,060. SS 24,000: combined 40,000 + 12,000 = 52,000
    // 50% tier 4,500; 85% tier 0.85 x 18,000 = 15,300 -> 19,800 (cap 0.85 x 24,000 = 20,400)
    // AGI 59,800 (< 75,000, so the full senior deduction): 16,100 + 2,050 + 6,000 = 24,150
    // taxable 59,800 - 24,150 = 35,650 -> 1,240 + 12% x 23,250 (2,790) = 4,030; total 7,090
    const r = calculateYearTax({
      filingStatus: 'single',
      year: Y,
      people: [{ age: 66, wages: 40000 }],
      income: { socialSecurity: 24000 },
    });
    expect(r.lines.taxableSocialSecurity).toBeCloseTo(19800, 6);
    expect(r.lines.standardDeduction).toBe(24150);
    expect(r.incomeTax).toBeCloseTo(4030, 6);
    expect(r.totalTax).toBeCloseTo(7090, 6);
  });

  it('qualified dividends in the 0% bracket', () => {
    // pension 30,000 -> ordinary taxable 13,900 -> 1,240 + 12% x 1,500 (180) = 1,420
    // dividends 20,000 stack from 13,900 to 33,900, all under 49,450 -> 0%
    // capital-gains room 49,450 - 33,900 = 15,550; no NIIT (AGI 50,000)
    const r = calculateYearTax({ filingStatus: 'single', year: Y, income: { ordinaryIncome: 30000, preferentialIncome: 20000 } });
    expect(r.ordinaryTax).toBeCloseTo(1420, 6);
    expect(r.capitalGainsTax).toBe(0);
    expect(r.niit).toBe(0);
    expect(r.bracketRoom.capitalGains).toEqual({ rate: 0, room: 15550, nextRate: 0.15 });
    expect(r.marginalRates.preferentialIncome.incomeTax).toBe(0);
  });

  it('NIIT on wages plus gains', () => {
    // wages 220,000: SS 6.2% x 184,500 (11,439) + Medicare 1.45% x 220,000 (3,190)
    //   + Additional Medicare 0.9% x 20,000 (180) = 14,809
    // ordinary taxable 203,900: 1,240 + 4,560 + 22% x 55,300 (12,166) + 24% x 96,075 (23,058)
    //   + 32% x 2,125 (680) = 41,704
    // gains 50,000 stack 203,900 -> 253,900, all at 15% -> 7,500
    // NIIT: MAGI 270,000, 70,000 over; NII 50,000 -> 3.8% x 50,000 = 1,900
    // income tax 51,104; total 65,913
    const r = calculateYearTax({
      filingStatus: 'single',
      year: Y,
      people: [{ wages: 220000 }],
      income: { preferentialIncome: 50000 },
    });
    expect(r.payrollTax).toBeCloseTo(14809, 6);
    expect(r.ordinaryTax).toBeCloseTo(41704, 6);
    expect(r.capitalGainsTax).toBeCloseTo(7500, 6);
    expect(r.niit).toBeCloseTo(1900, 6);
    expect(r.incomeTax).toBeCloseTo(51104, 6);
    expect(r.totalTax).toBeCloseTo(65913, 6);
  });

  it('inflation: with thresholds shrinking, more Social Security is taxable over time', () => {
    // The phase-in case, 20 years out at 2.5%: scale s = 1 / 1.025^20 = 1 / 1.6386164...
    // thresholds 25,000s / 34,000s. Combined income 35,000 (still above the upper threshold).
    // taxable SS = 0.5 x 9,000s + 0.85 x (35,000 - 34,000s)  [under the 85% cap of 25,500]
    //   s = 0.6102709: 2,746.22 + 0.85 x 14,250.79 (12,113.17) = 14,859.39  (vs 5,350 today)
    const s = 1 / 1.025 ** 20;
    const r = calculateYearTax({
      filingStatus: 'single',
      year: Y,
      income: { ordinaryIncome: 20000, socialSecurity: 30000 },
      thresholdScale: s,
    });
    expect(s).toBeCloseTo(0.6102709, 7);
    expect(r.lines.taxableSocialSecurity).toBeCloseTo(14859.39, 1);
    const today = calculateYearTax({ filingStatus: 'single', year: Y, income: { ordinaryIncome: 20000, socialSecurity: 30000 } });
    expect(r.lines.taxableSocialSecurity).toBeGreaterThan(today.lines.taxableSocialSecurity);
  });

  it('inflation shrinks the NIIT and Additional Medicare thresholds too', () => {
    // wages 180,000 + gains 20,000 single, scale 0.8: NIIT threshold 160,000, MAGI 200,000
    //   -> 3.8% x min(20,000, 40,000) = 760 (none at scale 1: MAGI is not above 200,000)
    // Additional Medicare threshold 160,000 -> 0.9% x 20,000 = 180
    const params = { filingStatus: 'single', year: Y, people: [{ wages: 180000 }], income: { preferentialIncome: 20000 } };
    expect(calculateYearTax(params).niit).toBe(0);
    const r = calculateYearTax({ ...params, thresholdScale: 0.8 });
    expect(r.niit).toBeCloseTo(760, 6);
    expect(r.payroll.additionalMedicare).toBeCloseTo(180, 6);
  });

  it('a tax-law what-if: ordinary rates 3 points higher', () => {
    // the $100,000 case: 13,170 + 3% x 83,900 (2,517) = 15,687; bracket rate 25%
    const r = calculateYearTax({ filingStatus: 'single', year: Y, people: [{ wages: 100000 }], rateShift: 0.03 });
    expect(r.ordinaryTax).toBeCloseTo(15687, 6);
    expect(r.ordinaryBracketRate).toBeCloseTo(0.25, 12);
  });

  it('under the standard deduction: 0% now, and the room left is the unused deduction', () => {
    const r = calculateYearTax({ filingStatus: 'single', year: Y, income: { ordinaryIncome: 10000 } });
    expect(r.incomeTax).toBe(0);
    expect(r.ordinaryBracketRate).toBe(0);
    expect(r.bracketRoom.ordinary).toEqual({ rate: 0, room: 6100, nextRate: 0.1 });
  });
});

describe('age deductions (2026, HAND CALC)', () => {
  const tax = (people, ordinaryIncome, filingStatus = 'single', year = Y) =>
    calculateYearTax({ filingStatus, year, people, income: { ordinaryIncome } });

  it('single, 67, $60,000 pension: + $2,050 and the full $6,000', () => {
    // deduction 16,100 + 2,050 + 6,000 = 24,150; taxable 35,850 -> 1,240 + 12% x 23,450 (2,814) = 4,054
    const r = tax([{ age: 67 }], 60000);
    expect(r.lines.additional65Deduction).toBe(2050);
    expect(r.lines.seniorDeduction).toBe(6000);
    expect(r.incomeTax).toBeCloseTo(4054, 6);
  });

  it('single, 70, $100,000: the senior deduction is phased down by 6% of the excess over $75,000', () => {
    // 6,000 - 6% x 25,000 = 4,500; deduction 16,100 + 2,050 + 4,500 = 22,650
    // taxable 77,350 -> 1,240 + 4,560 + 22% x 26,950 (5,929) = 11,729
    const r = tax([{ age: 70 }], 100000);
    expect(r.lines.seniorDeduction).toBeCloseTo(4500, 6);
    expect(r.incomeTax).toBeCloseTo(11729, 6);
  });

  it('married, both 66, $190,000: each $6,000 loses 6% of the excess over $150,000', () => {
    // each 6,000 - 6% x 40,000 = 3,600 -> 7,200; additional 2 x 1,650 = 3,300
    // deduction 32,200 + 3,300 + 7,200 = 42,700; taxable 147,300
    // MFJ: 10% x 24,800 (2,480) + 12% x 76,000 (9,120) + 22% x 46,500 (10,230) = 21,830
    const r = tax([{ age: 66 }, { age: 66 }], 190000, 'mfj');
    expect(r.lines.seniorDeduction).toBeCloseTo(7200, 6);
    expect(r.lines.additional65Deduction).toBe(3300);
    expect(r.incomeTax).toBeCloseTo(21830, 6);
  });

  it('only those 65 or older count, and the senior deduction ends after 2028', () => {
    expect(tax([{ age: 64 }], 60000).lines.standardDeduction).toBe(16100);
    expect(tax([{ age: 66 }, { age: 60 }], 60000, 'mfj').lines.additional65Deduction).toBe(1650);
    // 2029 (2026 data): 16,100 + 2,050 = 18,150; taxable 41,850 -> 1,240 + 12% x 29,450 (3,534) = 4,774
    const later = tax([{ age: 67 }], 60000, 'single', 2029);
    expect(later.lines.seniorDeduction).toBe(0);
    expect(later.incomeTax).toBeCloseTo(4774, 6);
  });
});

describe('calculateYearTax agrees with the existing engines to the cent', () => {
  it('retirement years: calculateRetirementTax', () => {
    let checked = 0;
    for (const filingStatus of ['single', 'mfj']) {
      for (const year of [2025, 2026]) {
        for (const pretax of [0, 8000, 30000, 75000, 160000, 400000]) {
          for (const gains of [0, 5000, 40000, 250000]) {
            for (const ss of [0, 18000, 36000, 60000]) {
              const old = calculateRetirementTax({ pretaxWithdrawal: pretax, taxableWithdrawal: gains, ssBenefit: ss, filingStatus, year });
              const r = calculateYearTax({
                filingStatus,
                year,
                income: { ordinaryIncome: pretax, preferentialIncome: gains, socialSecurity: ss },
              });
              expect(r.lines.taxableSocialSecurity).toBeCloseTo(old.taxableSS, 8);
              expect(r.ordinaryTax).toBeCloseTo(old.ordinaryTax, 8);
              expect(r.capitalGainsTax).toBeCloseTo(old.capitalGainsTax, 8);
              expect(r.niit).toBeCloseTo(old.niit, 8);
              expect(r.incomeTax).toBeCloseTo(old.totalTax, 8);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBe(384);
  });

  it('working years: calculateTaxFromGross + calculateEmploymentTaxes', () => {
    let checked = 0;
    for (const filingStatus of ['single', 'mfj']) {
      for (const year of [2025, 2026]) {
        for (const gross of [10000, 45000, 100000, 210000, 600000]) {
          for (const se of [0, 300, 30000]) {
            for (const deferral of [0, 7000, 23500]) {
              const pay = calculateEmploymentTaxes({ wages: gross - se, selfEmploymentIncome: se, filingStatus, year });
              const old = calculateTaxFromGross(gross, filingStatus, year, pay.selfEmployment.deduction + deferral);
              const r = calculateYearTax({
                filingStatus,
                year,
                people: [{ wages: gross - se, selfEmploymentIncome: se }],
                pretaxDeferrals: deferral,
              });
              expect(r.payrollTax).toBeCloseTo(pay.total, 8);
              expect(r.incomeTax).toBeCloseTo(old.tax, 8);
              expect(r.lines.ordinaryTaxableIncome).toBeCloseTo(old.taxableIncome, 8);
              expect(r.ordinaryBracketRate).toBe(old.marginalRate);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBe(180);
  });
});
