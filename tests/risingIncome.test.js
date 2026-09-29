import { describe, it, expect } from 'vitest';
import { compareWithRisingIncome } from '../src/lib/risingIncome.js';
import { runScenarioPoint } from '../src/lib/scenarios.js';

const base = {
  currentAge: 25,
  raiseAge: 35,
  retirementAge: 65,
  savingsRate: 0.1,
  returnRate: 0.07,
  year: 2026,
};

describe('compareWithRisingIncome', () => {
  // Hand-verified (2026, single). $20,000 today, $100,000 from age 35, 10% saved throughout,
  // the later savings all Pre-tax.
  //  Today: taxable 20,000 - 16,100 = 3,900 -> 10% bracket, t = 0.10. Saves $2,000/yr for 10 years:
  //    Pre-tax $2,000, Roth $2,000 x 0.9 = $1,800 (same take-home cost).
  //    Grown: FVA(10 yrs) = (1.07^10 - 1)/0.07 = 13.816448, then x 1.07^30 = 7.612255
  //    W = 4% x 2,000 x 13.816448 x 7.612255 = 8,413.95; RW = 0.9 x W = 7,572.55.
  //  Later: $10,000/yr Pre-tax for 30 years: 10,000 x (1.07^30 - 1)/0.07 = 944,607.86; 4% = 37,784.31.
  //  Social Security: average earnings (10 x 20,000 + 30 x 100,000) / 40 = 80,000; AIME 6,666.67;
  //    PIA 0.9 x 1,286 + 0.32 x (6,666.67 - 1,286) = 2,879.21; born 2001 -> FRA 67, claiming at 65 =
  //    24 months early -> x (1 - 24 x 5/9 %) = 0.866667; annual 2,879.21 x 0.866667 x 12 = 29,943.82.
  //  Stack without W: combined 37,784.31 + 14,971.91 = 52,756.22 -> taxable SS
  //    min(0.85 x 29,943.82, 0.85 x (52,756.22 - 34,000) + 4,500) = 20,442.79;
  //    taxable income 37,784.31 + 20,442.79 - 16,100 = 42,127.10; tax 1,240 + 12% x 29,727.10 = 4,807.25.
  //  With W: pretax 46,198.26; taxable SS capped at 85% = 25,452.25; taxable income 55,550.51;
  //    tax 1,240 + 4,560 + 22% x 5,150.51 = 6,933.11.
  //  Extra tax 2,125.86 -> e = 2,125.86 / 8,413.95 = 25.27%. Pre-tax keeps 6,288.09, Roth 7,572.55:
  //    Roth ahead by 1,284.46 / 6,288.09 = 20.43%, although today's rate is only 10%.
  it('$20k now, $100k from 35, later savings Pre-tax: Roth wins (hand-verified)', () => {
    const r = compareWithRisingIncome({ ...base, incomeNow: 20000, incomeLater: 100000 });
    expect(r.detail.marginalRate).toBe(0.1);
    expect(r.detail.averageEarnings).toBe(80000);
    expect(r.detail.ssBenefit).toBeCloseTo(29943.82, 1);
    expect(r.detail.other.pretaxGross).toBeCloseTo(37784.31, 1);
    expect(r.taxSavedNow).toBeCloseTo(0.1, 10);
    expect(r.effectiveRetirement).toBeCloseTo(0.252659, 5);
    expect(r.rothAfterTax).toBeCloseTo(7572.55, 1);
    expect(r.pretaxAfterTax).toBeCloseTo(6288.09, 1);
    expect(r.advantagePct).toBeCloseTo(20.427, 2);
    expect(r.winner).toBe('roth');
  });

  // Same, but the later savings are all Roth: only Social Security (29,943.82) is under W.
  //  Without W: combined 14,971.91 < 25,000 -> no tax. With W = 8,413.95: combined 23,385.86,
  //  still < 25,000 -> taxable SS 0; taxable income 8,413.95 - 16,100 < 0 -> no tax. e = 0,
  //  so Pre-tax keeps all 8,413.95 vs. Roth's 7,572.55: Pre-tax ahead, Roth -10% (= -t).
  it('the same raise with the later savings held Roth: Pre-tax wins (hand-verified)', () => {
    const r = compareWithRisingIncome({ ...base, incomeNow: 20000, incomeLater: 100000, laterRothShare: 1 });
    expect(r.effectiveRetirement).toBe(0);
    expect(r.pretaxAfterTax).toBeCloseTo(8413.95, 1);
    expect(r.advantagePct).toBeCloseTo(-10, 8);
    expect(r.winner).toBe('pretax');
  });

  it('with no raise before retirement it reproduces the calculator exactly', () => {
    for (const income of [25000, 75000, 150000, 300000]) {
      const r = compareWithRisingIncome({ ...base, raiseAge: 65, incomeNow: income, incomeLater: 999999 });
      const c = runScenarioPoint(
        {
          filingStatus: 'single',
          selfEmploymentIncome: 0,
          debtPayments: 0,
          otherExpenses: 0,
          currentType: 'pretax',
          accountType: '401k',
          knowsSocialSecurity: false,
          socialSecurityBenefit: 0,
          returnRate: 0.07,
          retirementLifestyle: 1,
          otherPretaxBalance: 0,
          otherRothBalance: 0,
          otherTaxableBalance: 0,
          currentAge: 25,
          retirementAge: 65,
        },
        { grossIncome: income, savings: income * 0.1 },
        2026,
      );
      expect(r.rothAfterTax).toBeCloseTo(c.rothAfterTax, 6);
      expect(r.pretaxAfterTax).toBeCloseTo(c.pretaxAfterTax, 6);
      expect(r.gap).toBeCloseTo(c.gap, 10);
      expect(r.overLimit).toBe(c.overLimit);
    }
  });

  it('keeps the rate identity: gap x W = Pre-tax minus Roth after-tax income', () => {
    for (const incomeLater of [20000, 60000, 150000, 300000, 500000]) {
      // incomeNow 300,000 puts today's savings over the IRS limit, so the taxable side accounts count too.
      for (const laterRothShare of [0, 0.5, 1]) {
        for (const incomeNow of [40000, 300000]) {
        const r = compareWithRisingIncome({ ...base, incomeNow, incomeLater, laterRothShare });
        expect(r.gap * r.detail.accountWithdrawal).toBeCloseTo(r.pretaxAfterTax - r.rothAfterTax, 6);
        }
      }
    }
  });

  it('rejects a raise at or before today', () => {
    expect(() => compareWithRisingIncome({ ...base, raiseAge: 25, incomeNow: 20000, incomeLater: 100000 })).toThrow();
  });
});
