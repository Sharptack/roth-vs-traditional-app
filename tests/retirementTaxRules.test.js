import { describe, it, expect } from 'vitest';
import { calculateRetirementTax } from '../src/lib/retirementTaxStack.js';
import { explainFullTax } from '../src/lib/taxBreakdown.js';
import { compareRothVsTraditional } from '../src/lib/compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';

const Y = 2026;
const RULES = [
  { thresholdScale: 1, rateShift: 0, ages: [] }, // neutral
  { thresholdScale: 0.55, rateShift: 0, ages: [] }, // ~24 years of 2.5% inflation
  { thresholdScale: 1, rateShift: 0.03, ages: [] },
  { thresholdScale: 0.6, rateShift: 0, ages: [67] },
  { thresholdScale: 0.6, rateShift: 0, ages: [66, 70] },
  { thresholdScale: 0.95, rateShift: 0, ages: [66, 70], calendarYear: 2028 }, // senior deduction on
];

describe('calculateRetirementTax with taxRules (the single-year engine)', () => {
  it('neutral rules give the same tax as today, to the cent', () => {
    for (const filingStatus of ['single', 'mfj']) {
      for (const pretax of [0, 20000, 90000, 300000]) {
        for (const ss of [0, 30000, 50000]) {
          const base = { pretaxWithdrawal: pretax, taxableWithdrawal: 30000, taxableGainShare: 0.6, ssBenefit: ss, filingStatus, year: Y };
          expect(calculateRetirementTax({ ...base, taxRules: RULES[0] }).totalTax).toBeCloseTo(calculateRetirementTax(base).totalTax, 8);
        }
      }
    }
  });

  it('explainFullTax shows the same tax as calculateRetirementTax under every rule set', () => {
    for (const taxRules of RULES) {
      for (const filingStatus of ['single', 'mfj']) {
        for (const pretax of [0, 20000, 90000, 300000]) {
          for (const taxable of [0, 40000, 400000]) {
            for (const ss of [0, 30000, 50000]) {
              const stack = { pretaxWithdrawal: pretax, taxableWithdrawal: taxable, taxableGainShare: 0.7, ssBenefit: ss, filingStatus, year: Y, taxRules };
              const t = calculateRetirementTax(stack);
              const e = explainFullTax(stack);
              expect(e.taxableSS).toBeCloseTo(t.taxableSS, 8);
              expect(e.standardDeduction).toBeCloseTo(t.standardDeduction, 8);
              expect(e.ordinaryTax).toBeCloseTo(t.ordinaryTax, 8);
              expect(e.capitalGainsTax).toBeCloseTo(t.capitalGainsTax, 8);
              expect(e.niit).toBeCloseTo(t.niit, 8);
              expect(e.totalTax).toBeCloseTo(t.totalTax, 8);
            }
          }
        }
      }
    }
  });
});

describe('compare.js with retirementTaxRules', () => {
  const cases = [
    {},
    { grossIncome: '60000', otherPretaxBalance: '400000' },
    { grossIncome: '250000', savings: '40000', otherTaxableBalance: '300000' },
    { filingStatus: 'mfj', grossIncome: '150000', currentAge: '50', otherPretaxBalance: '900000' },
  ];

  it('neutral rules reproduce the result', () => {
    for (const c of cases) {
      const inputs = toCompareInputs({ ...DEFAULT_FORM_VALUES, ...c }, Y);
      const a = compareRothVsTraditional(inputs);
      const b = compareRothVsTraditional({ ...inputs, retirementTaxRules: RULES[0] });
      expect(b.rates.effectiveRetirement).toBeCloseTo(a.rates.effectiveRetirement, 10);
      expect(b.rates.taxSavedNow).toBeCloseTo(a.rates.taxSavedNow, 10);
      expect(b.annuity.pretax.totalAfterTaxIncome).toBeCloseTo(a.annuity.pretax.totalAfterTaxIncome, 6);
      expect(b.portfolio.pretax.impliedWithdrawalRate).toBeCloseTo(a.portfolio.pretax.impliedWithdrawalRate, 8);
      expect(b.blend.best.rothShare).toBe(a.blend.best.rothShare);
    }
  });

  it('under real rules the rates still equal the exact dollar comparison: (X - e) x W', () => {
    for (const taxRules of RULES.slice(1)) {
      for (const c of cases) {
        const r = compareRothVsTraditional({ ...toCompareInputs({ ...DEFAULT_FORM_VALUES, ...c }, Y), retirementTaxRules: taxRules });
        const diff = r.portfolio.pretax.atBaseline.afterTaxIncome - r.portfolio.roth.atBaseline.afterTaxIncome;
        expect((r.rates.taxSavedNow - r.rates.effectiveRetirement) * r.sideAware.accountWithdrawal).toBeCloseTo(diff, 4);
      }
    }
  });

  // Total tax only: the INCREMENTAL rate on the account withdrawal can move either way. Found
  // 2026-10-01: at the defaults, shrinking thresholds take it from 24.4% to 20.9%, because more
  // Social Security is already taxable before the withdrawal, so the withdrawal no longer sits
  // in the phase-in band (1.85x the bracket rate). The total bill still rises.
  it("inflation never lowers the total retirement tax; the age deductions never raise it", () => {
    for (const c of cases) {
      const inputs = toCompareInputs({ ...DEFAULT_FORM_VALUES, ...c }, Y);
      const total = (rules) => compareRothVsTraditional({ ...inputs, retirementTaxRules: rules }).sideAware.stacks.preTaxWorld.totalTax;
      const today = compareRothVsTraditional(inputs).sideAware.stacks.preTaxWorld.totalTax;
      expect(total({ thresholdScale: 0.55 })).toBeGreaterThanOrEqual(today - 1e-6);
      expect(total({ ages: [65] })).toBeLessThanOrEqual(today + 1e-6);
    }
  });
});
