import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOUSEHOLD_VALUES,
  NEW_PENSION,
  activePeople,
  isLegacyV2,
  migrateLegacyV2,
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
    expect(p1.planToAge).toBe(PROJECTION_DEFAULT_VALUES.projEndAge);
    // one W-2 income row and a Social Security row (estimated, claimed at retirement), one Pre-tax
    // 401(k) contribution row, one Pre-tax account
    const blank = { treatment: 'ordinary', fromAge: '', toAge: '', ssMode: 'estimate', cola: '0', survivorShare: '0' };
    expect(D.incomes).toEqual([
      { id: 'i1', owner: 'p1', type: 'w2', amount: v1.grossIncome, ...blank },
      { id: 'i2', owner: 'p1', type: 'socialSecurity', amount: '', ...blank, fromAge: v1.claimAge },
    ]);
    expect(D.contributions).toEqual([{ id: 'c1', owner: 'p1', tax: v1.currentType, account: v1.accountType, amount: v1.savings }]);
    expect(D.accounts).toEqual(v1.accounts);
    expect(D.liabilities).toEqual([]);
    expect(D.spending).toEqual({ debtPayments: v1.debtPayments, otherExpenses: v1.otherExpenses, retirementLifestyle: v1.retirementLifestyle });
    for (const k of Object.keys(D.assumptions)) expect(D.assumptions[k]).toBe(v1[k]);
    expect(D.calculators.projection).toEqual({
      heirTaxRate: PROJECTION_DEFAULT_VALUES.projHeirTaxRate,
      strategy: PROJECTION_DEFAULT_VALUES.projStrategy,
    });
    expect(D.calculators.conversion.amount).toBe(CONVERSION_DEFAULT_VALUES.convAmount);
    // no pension row; the lump-sum offer waits for one (a new pension row starts at the old example offer)
    const p = PENSION_DEFAULT_VALUES;
    expect(D.calculators.pension).toEqual({ lumpSum: p.penLumpSum });
    expect(NEW_PENSION).toEqual({ amount: p.penMonthly, fromAge: p.penStartAge, cola: p.penCola, survivorShare: p.penSurvivor });
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

  it('sets the other person fields', () => {
    const v = setPersonField(D, 'p1', 'sex', 'female', '2026-10-07');
    expect(v.people[0].sex).toBe('female');
  });
});

describe('spouse and rows', () => {
  it('a spouse counts only when filing jointly and included, and keeps their details when taken out', () => {
    let v = setIncludeSpouse(D, true);
    expect(v.people.map((p) => p.id)).toEqual(['p1', 'p2']);
    // a new spouse comes with a Social Security row (estimated)
    expect(v.incomes.filter((r) => r.type === 'socialSecurity').map((r) => r.owner)).toEqual(['p1', 'p2']);
    expect(activePeople(v).map((p) => p.id)).toEqual(['p1']); // still filing single
    v = { ...v, filingStatus: 'mfj' };
    expect(activePeople(v).map((p) => p.id)).toEqual(['p1', 'p2']);
    v = setPersonField(v, 'p2', 'age', '41', '2026-10-07');
    v = setIncludeSpouse(v, false);
    expect(activePeople(v).map((p) => p.id)).toEqual(['p1']);
    v = setIncludeSpouse(v, true);
    expect(v.people[1].age).toBe('41');
    expect(v.incomes.filter((r) => r.owner === 'p2')).toHaveLength(1); // not a second row
  });

  it('adds, updates and removes rows, each with an id no other row has', () => {
    expect(newRowId([{ id: 'i1' }, { id: 'i2' }], 'i')).toBe('i3');
    expect(newRowId([{ id: 'i2' }], 'i')).toBe('i3');
    let v = addRow(D, 'incomes', { owner: 'p2', type: '1099' });
    expect(v.incomes[2]).toEqual({ id: 'i3', owner: 'p2', type: '1099', treatment: 'ordinary', amount: '', fromAge: '', toAge: '', ssMode: 'estimate', cola: '0', survivorShare: '0' });
    v = addRow(v, 'liabilities');
    expect(v.liabilities).toEqual([{ id: 'l1', kind: 'mortgage', balance: '', rate: '', payment: '' }]);
    v = updateRow(v, 'incomes', 'i3', 'amount', '30000');
    expect(v.incomes[2].amount).toBe('30000');
    v = removeRow(v, 'incomes', 'i1');
    expect(v.incomes.map((r) => r.id)).toEqual(['i2', 'i3']);
    expect(D.incomes).toHaveLength(2);
  });

  it("sets a group's field or a calculator's own input", () => {
    let v = setGroupField(D, 'assumptions', 'returnRate', '0.05');
    v = setGroupField(v, 'calculators.pension', 'lumpSum', '250000');
    expect(v.assumptions.returnRate).toBe('0.05');
    expect(v.calculators.pension.lumpSum).toBe('250000');
    expect(v.calculators.conversion.amount).toBe('50000');
    expect(D.assumptions.returnRate).toBe('0.07');
  });
});

describe('the first version 2 layout converts (migrateLegacyV2)', () => {
  // As saved or linked before the inputs page was regrouped (2026-10-08).
  const legacy = {
    ...D,
    filingStatus: 'mfj',
    includeSpouse: 'yes',
    people: [
      { id: 'p1', ageEntry: 'age', age: '67', birthDate: '', sex: '', retirementAge: '65', planToAge: '95', socialSecurity: { mode: 'estimate', pia: '', claimAge: '' } },
      { id: 'p2', ageEntry: 'age', age: '60', birthDate: '', sex: '', retirementAge: '62', planToAge: '95', socialSecurity: { mode: 'pia', pia: '1800', claimAge: '67' } },
    ],
    incomes: [
      { id: 'i1', owner: 'p2', type: 'w2', treatment: 'ordinary', amount: '50000', fromAge: '', toAge: '' },
      { id: 'i2', owner: 'p1', type: 'interest', treatment: 'ordinary', amount: '3000', fromAge: '', toAge: '' },
      { id: 'i3', owner: 'p1', type: 'qualified', treatment: 'ordinary', amount: '8000', fromAge: '', toAge: '' },
      { id: 'i4', owner: 'p1', type: 'socialSecurity', treatment: 'ordinary', amount: '24,000', fromAge: '67', toAge: '67' },
    ],
    calculators: {
      projection: { endAge: '92', heirTaxRate: '0.3', strategy: 'fill12' },
      conversion: { amount: '40000' },
      pension: { lumpSum: '400000', monthly: '2500', startAge: '65', cola: '0', survivorShare: '0.5', endAge: '90', spouseEndAge: '90' },
    },
  };

  it('Social Security, the other income kinds, the end age and a typed pension offer (HAND CALC)', () => {
    expect(isLegacyV2(legacy)).toBe(true);
    const v = migrateLegacyV2(legacy, 2026);
    expect(isLegacyV2(v)).toBe(false);
    expect(v.people.map((p) => [p.id, p.planToAge, p.socialSecurity])).toEqual([['p1', '92', undefined], ['p2', '95', undefined]]);
    const brief = v.incomes.map(({ id, owner, type, treatment, ssMode, amount, fromAge }) => [id, owner, type, type === 'other' ? treatment : ssMode, amount, fromAge]);
    // You, 67 (born 1959, full retirement age 66 and 10 months), received 24,000 this year with an
    // estimated benefit: a PIA claimed at 67, 2 months late (x 1 + 2 x 2/3% = 1.013333):
    //   24,000 / 12 / 1.013333 = 1,973.68 a month
    expect(brief.slice(0, 3)).toEqual([
      ['i1', 'p2', 'w2', 'estimate', '50000', ''],
      ['i2', 'p1', 'other', 'interest', '3000', ''],
      ['i3', 'p1', 'other', 'qualified', '8000', ''],
    ]);
    expect(brief[3].slice(0, 4)).toEqual(['i4', 'p1', 'socialSecurity', 'pia']);
    expect(Number(brief[3][4])).toBeCloseTo(1973.684211, 5);
    expect(brief[3][5]).toBe('67');
    // the spouse's entered PIA, as entered
    expect(brief[4]).toEqual(['i5', 'p2', 'socialSecurity', 'pia', '1800', '67']);
    // the typed pension offer: a pension row for you; the lump sum stays with the calculator
    expect(v.incomes[5]).toMatchObject({ id: 'i6', owner: 'p1', type: 'pension', amount: '2500', fromAge: '65', cola: '0', survivorShare: '0.5' });
    expect(v.calculators).toEqual({ projection: { heirTaxRate: '0.3', strategy: 'fill12' }, conversion: { amount: '40000' }, pension: { lumpSum: '400000' } });
  });

  it('an offer left at the example defaults adds no pension', () => {
    const v = migrateLegacyV2({ ...legacy, calculators: { ...legacy.calculators, pension: { lumpSum: '300000', monthly: '1800', startAge: '65', cola: '0', survivorShare: '0', endAge: '90', spouseEndAge: '90' } } }, 2026);
    expect(v.incomes.some((r) => r.type === 'pension')).toBe(false);
  });
});
