import { describe, it, expect } from 'vitest';
import { receivedAt, toHouseholdV2, validateHouseholdV2 } from '../src/lib/householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES, setIncludeSpouse, newPerson } from '../src/lib/householdValues.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold } from '../src/lib/household.js';
import { householdToYearTaxParams } from '../src/lib/taxCalculator.js';
import { householdToPensionInputs } from '../src/lib/pensionCalculator.js';

const Y = 2026;
const D = DEFAULT_HOUSEHOLD_VALUES;
const v2 = (overrides) => ({ ...D, ...overrides });
const income = (id, owner, type, amount, fromAge = '', toAge = '', treatment = 'ordinary', more = {}) => ({ id, owner, type, treatment, amount, fromAge, toAge, ssMode: 'estimate', cola: '0', survivorShare: '0', ...more });
const contribution = (id, owner, tax, account, amount) => ({ id, owner, tax, account, amount });
const couple = (overrides) => v2({ filingStatus: 'mfj', includeSpouse: 'yes', people: [newPerson('p1'), newPerson('p2', { age: '33', retirementAge: '62' })], ...overrides });

describe('toHouseholdV2', () => {
  it("the default values give version 1's default household", () => {
    const h2 = toHouseholdV2(D, Y);
    const h1 = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
    expect(h2.version).toBe(2);
    // version 2 adds the QBI deduction on 1099 earnings (round 2 phase 1) and tax drag on taxable money
    // (phase 2: 1.3% dividends, taxed at 15%: single, $100,000 of wages is in the 15% capital-gains
    // bracket); otherwise the same
    expect(householdToCompareInputs(h2)).toEqual({
      ...householdToCompareInputs(h1),
      qualifiedBusinessIncome: true,
      taxableDividends: { yield: 0.013, taxRate: 0.15 },
    });
    expect(householdToYearTaxParams(h2)).toEqual({ ...householdToYearTaxParams(h1), qbi: true });
    // no pension row: nothing for the pension calculator (version 1 always had its example offer)
    expect(h2.calculators.pension).toBeNull();
    expect(h2.pensions).toEqual([]);
    expect(h2.calculators.projection).toEqual(h1.calculators.projection);
    expect(h2.calculators.conversion).toEqual(h1.calculators.conversion);
    // and survivor years' spending (phase 2), which version 1 never reaches (no plan-to ages), and the
    // dividends on taxable accounts (tax drag, phase 2)
    expect(h2.assumptions).toEqual({ ...h1.assumptions, qualifiedBusinessIncome: true, snapshotAtLastRetirement: true, survivorSpending: 0.8, dividendYield: 0.013 });
    expect(h2.spending).toEqual(h1.spending);
  });

  it("counts each earnings row received at the person's age this year (HAND CALC)", () => {
    // age 52 in 2026 (birth year 1974):
    //   W-2 120,000, no ages ............. counts
    //   W-2  30,000 from 55 .............. not yet
    //   1099 20,000 from 50 through 52 ... counts (52 is its last year)
    //   1099  5,000 through 51 ........... ended
    // wages 120,000; 1099 20,000; gross 140,000
    const h = toHouseholdV2(
      v2({
        people: [newPerson('p1', { age: '52', retirementAge: '62' })],
        incomes: [
          income('i1', 'p1', 'w2', '120000'),
          income('i2', 'p1', 'w2', '30000', '55'),
          income('i3', 'p1', '1099', '20,000', '50', '52'),
          income('i4', 'p1', '1099', '5000', '', '51'),
        ],
      }),
      Y,
    );
    expect(h.people[0]).toMatchObject({ birthYear: 1974, wages: 120000, selfEmploymentIncome: 20000 });
    const c = householdToCompareInputs(h);
    expect([c.grossIncome, c.selfEmploymentIncome, c.currentAge]).toEqual([140000, 20000, 52]);
  });

  it('a birthdate gives the exact birth year; the age used is the age reached this year', () => {
    // born 1990-11-20: 35 on 2026-10-07, but 36 by the end of 2026 -> birth year 1990, age 36,
    // so a row from 36 counts this year
    const h = toHouseholdV2(
      v2({
        people: [newPerson('p1', { ageEntry: 'birthdate', birthDate: '1990-11-20', age: '35' })],
        incomes: [income('i1', 'p1', 'w2', '90000'), income('i2', 'p1', 'w2', '10000', '36')],
      }),
      Y,
    );
    expect(h.people[0]).toMatchObject({ birthYear: 1990, birthDate: '1990-11-20', wages: 100000 });
    expect(householdToCompareInputs(h).currentAge).toBe(36);
  });

  it("puts this year's other income in the tax calculator, by kind; Social Security from each benefit (HAND CALC)", () => {
    // other ordinary 5,000; other tax-exempt 2,000; interest 3,000 + spouse's 1,000 = 4,000;
    // qualified 8,000; an interest row from 70 doesn't count yet.
    // The spouse, 66 (born 1960, full retirement age 67), claims a PIA of 1,250 at 66: 12 months
    // early, x (1 - 12 x 5/9%) = 0.933333 -> 1,250 x 12 x 0.933333 = 14,000 this year.
    const values = couple({
      people: [newPerson('p1'), newPerson('p2', { age: '66', retirementAge: '66' })],
      incomes: [
        income('i1', 'p1', 'w2', '100000'),
        income('i2', 'p1', 'other', '5000'),
        income('i3', 'p1', 'other', '2000', '', '', 'taxExempt'),
        income('i4', 'p1', 'other', '3000', '', '', 'interest'),
        income('i5', 'p2', 'other', '1000', '', '', 'interest'),
        income('i6', 'p1', 'other', '8000', '', '', 'qualified'),
        income('i7', 'p2', 'socialSecurity', '1250', '66', '', 'ordinary', { ssMode: 'pia' }),
        income('i8', 'p1', 'other', '9000', '70', '', 'interest'),
      ],
    });
    const h = toHouseholdV2(values, Y);
    expect(h.calculators.tax).toEqual({
      ordinaryIncome: 5000,
      investmentOrdinaryIncome: 4000,
      preferentialIncome: 8000,
      taxExemptIncome: 2000,
    });
    expect(householdToYearTaxParams(h).income.socialSecurity).toBeCloseTo(14000, 6);
    expect(h.people.map((p) => p.wages)).toEqual([100000, 0]);
    // without the spouse, their rows are left out
    const single = toHouseholdV2({ ...values, includeSpouse: 'no' }, Y);
    expect(single.calculators.tax.investmentOrdinaryIncome).toBe(3000);
    expect(householdToYearTaxParams(single).income.socialSecurity).toBe(0);
  });

  it("Social Security rows: each person's own; none = no benefit of their own; one per person", () => {
    const h = toHouseholdV2(D, Y);
    expect(h.people[0].socialSecurity).toMatchObject({ mode: 'estimate', pia: null, claimAge: null });
    const none = toHouseholdV2(v2({ incomes: [income('i1', 'p1', 'w2', '100000')] }), Y);
    expect(none.people[0].socialSecurity).toMatchObject({ mode: 'pia', pia: 0 });
    expect(householdToCompareInputs(none).earners[0].pia).toBe(0);
    const two = toHouseholdV2(v2({ incomes: [...D.incomes, income('i3', 'p1', 'socialSecurity', '')] }), Y);
    expect(validateHouseholdV2(two)).toEqual(['Enter one Social Security row for you.']);
  });

  it('pension rows: in the pension calculator (its owner first), the tax this year and the Roth comparison (HAND CALC)', () => {
    // You 35; the spouse 66 with a pension of 2,000 a month since 62, no COLA, 2.5% inflation:
    // paid now, so 24,000 this year (today's dollars).
    const values = couple({
      people: [newPerson('p1'), newPerson('p2', { age: '66', retirementAge: '62' })],
      incomes: [income('i1', 'p1', 'w2', '100000'), income('i2', 'p2', 'pension', '2000', '62', '', 'ordinary', { survivorShare: '0.5' })],
      calculators: { ...D.calculators, pension: { lumpSum: '250000' } },
    });
    const h = toHouseholdV2(values, Y);
    expect(h.pensions).toEqual([{ owner: 'p2', monthly: 2000, startAge: 62, cola: 0, survivorShare: 0.5 }]);
    expect(h.calculators.tax.ordinaryIncome).toBeCloseTo(24000, 8);
    expect(h.calculators.pension).toMatchObject({ owner: 'p2', lumpSum: 250000, monthly: 2000, startAge: 62, survivorShare: 0.5 });
    // the pension calculator sees the spouse as the owner, you as the survivor (35 now -> 31 at 62)
    expect(householdToPensionInputs(h)).toMatchObject({ lumpSum: 250000, monthly: 2000, startAge: 62, survivorShare: 0.5, spouseAgeAtStart: 31 });
    // the Roth comparison's snapshot: you retire at 65, 30 years on (the spouse 96): the pension is
    // 24,000 / 1.025^30 = 24,000 / 2.097568 = 11,441.84 in today's dollars
    expect(householdToCompareInputs(h).pensionIncome).toBeCloseTo(11441.84, 1);
  });

  it("the projection runs until the last person's plan-to age", () => {
    // you 35 to 95 (2086); the spouse 33 to 95 (2088): you'd be 97 then
    expect(toHouseholdV2(couple({}), Y).calculators.projection.endAge).toBe(97);
    expect(toHouseholdV2(couple({ people: [newPerson('p1', { planToAge: '90' }), newPerson('p2', { age: '33', planToAge: '85' })] }), Y).calculators.projection.endAge).toBe(90);
    expect(toHouseholdV2(D, Y).calculators.projection.endAge).toBe(95);
  });

  it('adds up each person\'s Roth and Pre-tax contributions, with their own types (HAND CALC)', () => {
    // p1: Roth 401(k) 15,000 + 5,000 = 20,000 (the household's type: Roth, 401(k))
    // p2: Pre-tax IRA 6,000 (their own type and account type)
    // a taxable 10,000 row isn't Roth vs. Pre-tax: left out; total savings 26,000
    const h = toHouseholdV2(
      couple({
        contributions: [
          contribution('c1', 'p1', 'roth', '401k', '15000'),
          contribution('c2', 'p1', 'roth', '401k', '5000'),
          contribution('c3', 'p2', 'pretax', 'ira', '6000'),
          contribution('c4', 'p1', 'taxable', '401k', '10000'),
        ],
      }),
      Y,
    );
    expect(h.futureContributions).toEqual({
      currentType: 'roth',
      accountType: '401k',
      contributions: [
        { owner: 'p1', amount: 20000 },
        { owner: 'p2', amount: 6000, currentType: 'pretax', accountType: 'ira' },
      ],
    });
    expect(householdToCompareInputs(h).savings).toBe(26000);
    expect(h.contributionRows).toHaveLength(4);
    expect(validateHouseholdV2(h)).toEqual([]);
  });

  it('a person with no contributions saves $0; a spouse taken out takes their rows, not their accounts', () => {
    const values = couple({
      accounts: [
        { id: 'a1', owner: 'p1', type: 'pretax', balance: '100000', basisShare: '0.5' },
        { id: 'a2', owner: 'p2', type: 'taxable', balance: '50000', basisShare: '0.2' },
      ],
      contributions: [contribution('c1', 'p2', 'roth', 'ira', '7000')],
    });
    const both = toHouseholdV2(values, Y);
    // p1 has no Roth/Pre-tax rows: the household type falls back to Pre-tax 401(k)
    expect(both.futureContributions.contributions).toEqual([
      { owner: 'p1', amount: 0 },
      { owner: 'p2', amount: 7000, currentType: 'roth', accountType: 'ira' },
    ]);
    const without = toHouseholdV2(setIncludeSpouse(values, false), Y);
    expect(without.people).toHaveLength(1);
    expect(without.futureContributions.contributions).toEqual([{ owner: 'p1', amount: 0 }]);
    expect(without.accounts[1]).toEqual({ id: 'a2', owner: 'p1', type: 'taxable', balance: 50000, basisShare: 0.2 });
  });

  it('carries the new person fields and the debts', () => {
    const h = toHouseholdV2(
      v2({
        people: [newPerson('p1', { sex: 'female', planToAge: '97', socialSecurity: { mode: 'pia', pia: '2,850', claimAge: '67' } })],
        liabilities: [{ id: 'l1', kind: 'mortgage', balance: '280000', rate: '0.065', payment: '2100' }],
      }),
      Y,
    );
    expect(h.people[0]).toMatchObject({ sex: 'female', planToAge: 97, socialSecurity: { mode: 'pia', pia: 2850, claimAge: 67 } });
    expect(h.liabilities).toEqual([{ id: 'l1', kind: 'mortgage', balance: 280000, rate: 0.065, payment: 2100 }]);
  });
});

describe('receivedAt', () => {
  it('includes both ages; a blank age has no limit on that side', () => {
    const row = { fromAge: 50, toAge: 52 };
    expect([49, 50, 52, 53].map((a) => receivedAt(row, a))).toEqual([false, true, true, false]);
    expect(receivedAt({ fromAge: null, toAge: null }, NaN)).toBe(true);
    expect(receivedAt({ fromAge: 50, toAge: null }, NaN)).toBe(false);
  });
});

describe('validateHouseholdV2', () => {
  it('checks the version 2 rows and person fields', () => {
    const h = toHouseholdV2(
      v2({
        people: [newPerson('p1', { ageEntry: 'birthdate', birthDate: '1990-02-30', socialSecurity: { mode: 'pia', pia: '', claimAge: '' } })],
        incomes: [income('i1', 'p1', 'w2', '-5'), income('i2', 'p1', 'interest', '100', '70', '65')],
        contributions: [contribution('c1', 'p1', 'roth', '401k', '1000'), contribution('c2', 'p1', 'pretax', 'ira', '1000')],
        liabilities: [{ id: 'l1', kind: 'car', balance: '-1', rate: '0.05', payment: '400' }],
      }),
      Y,
    );
    expect(validateHouseholdV2(h)).toEqual([
      'Enter your birthdate as a full date.',
      'Enter your monthly Social Security benefit at full retirement age (PIA).',
      "Income amounts can't be negative.",
      "An income's last age can't be before its first.",
      'For now, your contributions need one type (Roth or Pre-tax) and one account type.',
      "Debts' balances, rates and payments can't be negative.",
    ]);
    expect(validateHouseholdV2(toHouseholdV2(D, Y))).toEqual([]);
  });
});

describe('employer contributions reach the calculators (phase 2)', () => {
  it('a 100% match on the first 4% of pay: $4,000 a year for 30 years, in the Roth comparison', () => {
    // the default household: 35, retiring at 65, W-2 $100,000, $10,000 Pre-tax to a 401(k)
    const values = { ...D, contributions: [{ ...D.contributions[0], employer: 'match', matchRate: '1', matchUpTo: '0.04' }] };
    const h = toHouseholdV2(values, Y);
    expect(h.contributionRows[0].employer).toEqual({ type: 'match', matchRate: 1, matchUpTo: 0.04 });
    expect(householdToCompareInputs(h).employerContributions).toEqual([{ amount: 4000, years: 30 }]);
    // a flat amount; and none adds nothing
    const flat = { ...D, contributions: [{ ...D.contributions[0], employer: 'flat', employerAmount: '6,000' }] };
    expect(householdToCompareInputs(toHouseholdV2(flat, Y)).employerContributions).toEqual([{ amount: 6000, years: 30 }]);
    expect(householdToCompareInputs(toHouseholdV2(D, Y)).employerContributions).toBeUndefined();
  });
});
