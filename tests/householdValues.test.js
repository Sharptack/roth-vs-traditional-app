import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOUSEHOLD_VALUES,
  activePeople,
  addRow,
  ageOn,
  isoDate,
  newRowId,
  parseBirthDate,
  refreshAges,
  removeRow,
  setGroupField,
  setIncludeSpouse,
  setPersonField,
  updateRow,
} from '../src/lib/householdValues.js';
import { PREVIEW_DEFAULT_VALUES, PROJECTION_DEFAULT_VALUES } from '../src/lib/household.js';
import { PENSION_DEFAULT_VALUES } from '../src/lib/pensionCalculator.js';
import { CONVERSION_DEFAULT_VALUES } from '../src/lib/conversionCalculator.js';

const D = DEFAULT_HOUSEHOLD_VALUES;

describe('version 2 household values: defaults', () => {
  it("are version 1's defaults, row by row", () => {
    const v1 = PREVIEW_DEFAULT_VALUES;
    const [p1] = D.people;
    expect(D.version).toBe(2);
    expect([D.filingStatus, D.includeSpouse]).toEqual([v1.filingStatus, v1.includeSpouse]);
    expect([p1.age, p1.retirementAge]).toEqual([v1.currentAge, v1.retirementAge]);
    expect(p1.socialSecurity).toEqual({ mode: 'estimate', pia: '', claimAge: v1.claimAge });
    // one W-2 income row, one Pre-tax 401(k) contribution row, one Pre-tax account
    expect(D.incomes).toEqual([{ id: 'i1', owner: 'p1', type: 'w2', treatment: 'ordinary', amount: v1.grossIncome, fromAge: '', toAge: '' }]);
    expect(D.contributions).toEqual([{ id: 'c1', owner: 'p1', tax: v1.currentType, account: v1.accountType, amount: v1.savings }]);
    expect(D.accounts).toEqual(v1.accounts);
    expect(D.liabilities).toEqual([]);
    expect(D.spending).toEqual({ debtPayments: v1.debtPayments, otherExpenses: v1.otherExpenses, retirementLifestyle: v1.retirementLifestyle });
    for (const k of Object.keys(D.assumptions)) expect(D.assumptions[k]).toBe(v1[k]);
    expect(D.calculators.projection).toEqual({
      endAge: PROJECTION_DEFAULT_VALUES.projEndAge,
      heirTaxRate: PROJECTION_DEFAULT_VALUES.projHeirTaxRate,
      strategy: PROJECTION_DEFAULT_VALUES.projStrategy,
    });
    expect(D.calculators.conversion.amount).toBe(CONVERSION_DEFAULT_VALUES.convAmount);
    const p = PENSION_DEFAULT_VALUES;
    expect(D.calculators.pension).toEqual({
      lumpSum: p.penLumpSum,
      monthly: p.penMonthly,
      startAge: p.penStartAge,
      cola: p.penCola,
      survivorShare: p.penSurvivor,
      endAge: p.penEndAge,
      spouseEndAge: p.penSpouseEndAge,
    });
  });
});

describe('age and birthdate (HAND CALC)', () => {
  it('reads only real dates', () => {
    expect(parseBirthDate('1990-10-08')).toEqual({ year: 1990, month: 10, day: 8 });
    expect(parseBirthDate('2001-02-29')).toBeNull(); // 2001 is not a leap year
    expect(parseBirthDate('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseBirthDate('1990-13-01')).toBeNull();
    expect(parseBirthDate('10/08/1990')).toBeNull();
    expect(parseBirthDate('')).toBeNull();
  });

  it('counts whole years, one more on the birthday itself', () => {
    // born 1990-10-08: on 2026-10-07 the birthday hasn't come -> 2026 - 1990 - 1 = 35; on 10-08 -> 36
    expect(ageOn('1990-10-08', '2026-10-07')).toBe(35);
    expect(ageOn('1990-10-08', '2026-10-08')).toBe(36);
    // born 1961-01-15: on 2026-10-07 the birthday has passed -> 65
    expect(ageOn('1961-01-15', '2026-10-07')).toBe(65);
    // born 2000-02-29: in 2026 (no Feb 29) the birthday counts from March 1 -> 25 on 02-28, 26 on 03-01
    expect(ageOn('2000-02-29', '2026-02-28')).toBe(25);
    expect(ageOn('2000-02-29', '2026-03-01')).toBe(26);
    expect(ageOn('nonsense', '2026-03-01')).toBeNull();
  });

  it('formats a date as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('typing a birthdate sets the age; typing an age clears the birthdate', () => {
    const today = '2026-10-07';
    let v = setPersonField(D, 'p1', 'birthDate', '1961-01-15', today);
    expect(v.people[0]).toMatchObject({ ageEntry: 'birthdate', birthDate: '1961-01-15', age: '65' });
    v = setPersonField(v, 'p1', 'age', '40', today);
    expect(v.people[0]).toMatchObject({ ageEntry: 'age', birthDate: '', age: '40' });
    // a birthdate still being typed leaves the age blank
    v = setPersonField(v, 'p1', 'birthDate', '1961-01', today);
    expect(v.people[0]).toMatchObject({ ageEntry: 'birthdate', age: '' });
    expect(D.people[0].age).toBe('35'); // the defaults are never changed in place
  });

  it("brings a birthdate's age up to date; an age typed alone stays as typed", () => {
    let v = setPersonField(D, 'p1', 'birthDate', '1990-10-08', '2026-10-07'); // 35
    v = setIncludeSpouse({ ...v, filingStatus: 'mfj' }, true);
    v = setPersonField(v, 'p2', 'age', '50', '2026-10-07');
    const later = refreshAges(v, '2027-10-08');
    expect(later.people.map((p) => p.age)).toEqual(['37', '50']);
  });

  it("sets Social Security fields and the other person fields", () => {
    let v = setPersonField(D, 'p1', 'socialSecurity.mode', 'pia', '2026-10-07');
    v = setPersonField(v, 'p1', 'socialSecurity.pia', '2400', '2026-10-07');
    v = setPersonField(v, 'p1', 'sex', 'female', '2026-10-07');
    expect(v.people[0].socialSecurity).toEqual({ mode: 'pia', pia: '2400', claimAge: '' });
    expect(v.people[0].sex).toBe('female');
  });
});

describe('spouse and rows', () => {
  it('a spouse counts only when filing jointly and included, and keeps their details when taken out', () => {
    let v = setIncludeSpouse(D, true);
    expect(v.people.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(activePeople(v).map((p) => p.id)).toEqual(['p1']); // still filing single
    v = { ...v, filingStatus: 'mfj' };
    expect(activePeople(v).map((p) => p.id)).toEqual(['p1', 'p2']);
    v = setPersonField(v, 'p2', 'age', '41', '2026-10-07');
    v = setIncludeSpouse(v, false);
    expect(activePeople(v).map((p) => p.id)).toEqual(['p1']);
    v = setIncludeSpouse(v, true);
    expect(v.people[1].age).toBe('41');
  });

  it('adds, updates and removes rows, each with an id no other row has', () => {
    expect(newRowId([{ id: 'i1' }, { id: 'i2' }], 'i')).toBe('i3');
    expect(newRowId([{ id: 'i2' }], 'i')).toBe('i3');
    let v = addRow(D, 'incomes', { owner: 'p2', type: '1099' });
    expect(v.incomes[1]).toEqual({ id: 'i2', owner: 'p2', type: '1099', treatment: 'ordinary', amount: '', fromAge: '', toAge: '' });
    v = addRow(v, 'liabilities');
    expect(v.liabilities).toEqual([{ id: 'l1', kind: 'mortgage', balance: '', rate: '', payment: '' }]);
    v = updateRow(v, 'incomes', 'i2', 'amount', '30000');
    expect(v.incomes[1].amount).toBe('30000');
    v = removeRow(v, 'incomes', 'i1');
    expect(v.incomes.map((r) => r.id)).toEqual(['i2']);
    expect(D.incomes).toHaveLength(1);
  });

  it("sets a group's field or a calculator's own input", () => {
    let v = setGroupField(D, 'assumptions', 'returnRate', '0.05');
    v = setGroupField(v, 'calculators.pension', 'cola', '0.02');
    expect(v.assumptions.returnRate).toBe('0.05');
    expect(v.calculators.pension.cola).toBe('0.02');
    expect(v.calculators.pension.lumpSum).toBe('300000');
    expect(D.assumptions.returnRate).toBe('0.07');
  });
});
