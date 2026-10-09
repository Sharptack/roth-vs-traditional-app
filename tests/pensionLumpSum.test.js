import { describe, it, expect } from 'vitest';
import { toHouseholdV2, validateHouseholdV2 } from '../src/lib/householdV2.js';
import { householdToCompareInputs } from '../src/lib/household.js';
import { householdToYearTaxParams } from '../src/lib/taxCalculator.js';
import { runProjection } from '../src/lib/projection.js';
import { DEFAULT_HOUSEHOLD_VALUES as D, NEW_PENSION, addRow, cleanHouseholdValues, moveLumpSumToRow, setPersonField, updateRow } from '../src/lib/householdValues.js';

// A pension taken as a lump sum in the plan (decided 2026-10-09): the payments are dropped and the
// lump sum is rolled over to a Pre-tax IRA at the pension's start age.
const withPension = (age, election) => {
  let v = setPersonField(D, 'p1', 'age', String(age), '2026-10-09');
  v = addRow(v, 'incomes', { type: 'pension', ...NEW_PENSION, election });
  return v;
};

describe('a pension taken as a lump sum', () => {
  it('starting later: no payments, a rollover at the start age; starting now or past: a Pre-tax account today', () => {
    const later = toHouseholdV2(withPension(60, 'lumpSum'), 2026);
    expect(later.pensions).toEqual([]);
    expect(later.rollovers).toEqual([{ owner: 'p1', age: 65, amount: 300000 }]);
    expect(later.accounts.map((a) => a.id)).toEqual(['a1']);
    expect(householdToYearTaxParams(later).income.ordinaryIncome).toBe(0);
    const past = toHouseholdV2(withPension(66, 'lumpSum'), 2026);
    expect(past.rollovers).toEqual([]);
    expect(past.accounts.at(-1)).toEqual({ id: 'lump-i3', owner: 'p1', type: 'pretax', balance: 300000 });
    // monthly (the default): paid, as before; the pension calculator still weighs the row either way
    const monthly = toHouseholdV2(withPension(66, 'monthly'), 2026);
    expect(monthly.pensions).toHaveLength(1);
    expect(monthly.rollovers).toEqual([]);
    expect(householdToYearTaxParams(monthly).income.ordinaryIncome).toBeCloseTo(21600, 6); // 12 x 1,800, started at 65
    expect(later.calculators.pension).toMatchObject({ lumpSum: 300000, monthly: 1800, startAge: 65, election: 'lumpSum' });
  });

  it('the Roth comparison counts it as Pre-tax money today, discounted at the return', () => {
    // age 60, rolled over at 65, 7% return: 300,000 / 1.07^5 = 213,895.85; plus the $100,000 account
    const inputs = householdToCompareInputs(toHouseholdV2(withPension(60, 'lumpSum'), 2026));
    expect(inputs.otherPretaxBalance).toBeCloseTo(100000 + 300000 / 1.07 ** 5, 4);
    expect(300000 / 1.07 ** 5).toBeCloseTo(213895.85, 2);
  });

  it('the projection rolls it over at the start of the year the owner reaches the start age (HAND CALC)', () => {
    // a retiree aged 70, nothing saved, need 0, 10% return; $100,000 rolled over at 72:
    //   end of 72: 100,000 x 1.1 = 110,000; at 73 (born 1956, RMDs from 73) the RMD is
    //   110,000 / 26.5 = 4,150.94, taken first; end of 73: (110,000 - 4,150.94) x 1.1 = 116,433.96
    const h = {
      version: 2,
      year: 2026,
      filingStatus: 'single',
      people: [{ id: 'p1', birthYear: 1956, retirementAge: 65, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
      accounts: [],
      rollovers: [{ owner: 'p1', age: 72, amount: 100000 }],
      futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
      spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
      calculators: {},
      assumptions: { returnRate: 0.1, inflationRate: 0, ageDeductions: false, surplus: 'spend' },
    };
    const { rows } = runProjection(h, { endAge: 73 });
    expect(rows.map((r) => r.endBalances.pretax)).toEqual([0, 0, expect.closeTo(110000, 6), expect.closeTo(116433.96, 2)]);
    expect(rows[2].rmd).toBe(0);
    expect(rows[3].rmd).toBeCloseTo(4150.94, 2);
  });

  it('checks: a lump sum taken needs an amount', () => {
    const v = updateRow(withPension(60, 'lumpSum'), 'incomes', 'i3', 'lumpSum', '');
    expect(validateHouseholdV2(toHouseholdV2(v, 2026))).toContain('Enter the lump sum offered to take it in the plan.');
  });

  it('older saves: the calculator\'s lump sum moves onto the first pension row', () => {
    let v = addRow(D, 'incomes', { type: 'pension', ...NEW_PENSION, lumpSum: '' });
    v = { ...v, calculators: { ...v.calculators, pension: { lumpSum: '250000' } } };
    expect(moveLumpSumToRow(v).incomes[2].lumpSum).toBe('250000');
    expect(cleanHouseholdValues(JSON.parse(JSON.stringify(v))).incomes[2].lumpSum).toBe('250000');
    // a row with its own is left alone; no pension, nothing to do
    expect(moveLumpSumToRow(updateRow(v, 'incomes', 'i3', 'lumpSum', '1')).incomes[2].lumpSum).toBe('1');
    expect(moveLumpSumToRow(D)).toBe(D);
  });
});
