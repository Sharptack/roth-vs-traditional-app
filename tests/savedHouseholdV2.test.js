// Saved households in version 2 (round 2 phase 0): what is stored, what comes back, and version 1
// saves opening as version 2.
import { describe, it, expect } from 'vitest';
import { caseFromValues, caseFromValuesV2, sameSavedHouseholdV2, valuesV2FromCase } from '../src/lib/savedHousehold.js';
import { DEFAULT_HOUSEHOLD_VALUES, MAX_ROWS, addRow, cleanHouseholdValues, newPerson, setIncludeSpouse } from '../src/lib/householdValues.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { upgradeHouseholdValues } from '../src/lib/householdUpgrade.js';
import { V1_HOUSEHOLDS } from './fixtures/householdV1.js';
import { YEAR, pinsFor, pinsForV2 } from './fixtures/householdPins.js';

const couple = {
  ...setIncludeSpouse({ ...DEFAULT_HOUSEHOLD_VALUES, filingStatus: 'mfj' }, true),
  people: [
    newPerson('p1', { ageEntry: 'birthdate', birthDate: '1970-03-14', age: '56', sex: 'male', socialSecurity: { mode: 'pia', pia: '3100', claimAge: '68' } }),
    newPerson('p2', { age: '54', retirementAge: '60', sex: 'female' }),
  ],
  incomes: [
    { id: 'i1', owner: 'p1', type: 'w2', treatment: 'ordinary', amount: '150,000', fromAge: '', toAge: '' },
    { id: 'i9', owner: 'p2', type: 'other', treatment: 'taxExempt', amount: '4000', fromAge: '55', toAge: '59' },
  ],
  contributions: [
    { id: 'c1', owner: 'p1', tax: 'roth', account: '401k', amount: '24000' },
    { id: 'c4', owner: 'p2', tax: 'pretax', account: 'ira', amount: '7000' },
  ],
  liabilities: [{ id: 'l1', kind: 'mortgage', balance: '310000', rate: '0.0625', payment: '2400' }],
};
const json = (x) => JSON.parse(JSON.stringify(x));
const noIds = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) && k !== 'people' ? x.map(({ id, ...rest }) => rest) : x]));

describe('saved households in version 2: what is stored', () => {
  it('round-trips the values (row ids are renumbered; the same household comes back)', () => {
    const back = valuesV2FromCase(json(caseFromValuesV2(couple)), YEAR);
    expect(noIds(back)).toEqual(noIds(couple));
    expect(back.incomes.map((r) => r.id)).toEqual(['i1', 'i2']);
    const h = (v) => ({ ...toHouseholdV2(v, YEAR), incomes: undefined, contributionRows: undefined, liabilities: undefined });
    expect(h(back)).toEqual(h(couple));
  });

  it('cleans what comes back: unknown keys, wrong types, bad choices, bad rows', () => {
    const back = cleanHouseholdValues(
      json({
        version: 2,
        evil: '<script>',
        filingStatus: 'married',
        includeSpouse: true,
        people: [
          { id: 'p1', age: 40, sex: 'other', ageEntry: 'guess', socialSecurity: { mode: 'magic', pia: '9'.repeat(200) }, extra: 1 },
          { id: 'p3', age: '20' },
        ],
        incomes: [
          { owner: 'p1', type: 'w2', amount: '50000', treatment: 'weird', extra: 'x' },
          { owner: 'p9', type: 'w2', amount: '1' },
          { owner: 'p1', type: 'lottery', amount: '1' },
          'not a row',
        ],
        contributions: [{ owner: 'p1', tax: 'roth', account: '403b', amount: '1' }],
        accounts: [],
        liabilities: [{ kind: 'mortgage', balance: { $gt: 0 } }],
        spending: { debtPayments: '100', hack: 'x' },
        assumptions: 'nope',
        calculators: { pension: { lumpSum: '1' }, rocket: {} },
      }),
    );
    expect(back.evil).toBeUndefined();
    expect([back.filingStatus, back.includeSpouse]).toEqual(['single', 'no']);
    expect(back.people).toHaveLength(1); // p3 isn't a person
    expect(back.people[0]).toMatchObject({ age: '35', sex: '', ageEntry: 'age', socialSecurity: { mode: 'estimate' } });
    expect(back.people[0].socialSecurity.pia).toHaveLength(64);
    expect(back.people[0].extra).toBeUndefined();
    expect(back.incomes).toEqual([{ id: 'i1', owner: 'p1', type: 'w2', treatment: 'ordinary', amount: '50000', fromAge: '', toAge: '' }]);
    expect(back.contributions).toEqual([]); // 403(b) isn't an account type yet
    expect(back.accounts).toEqual(DEFAULT_HOUSEHOLD_VALUES.accounts); // never starts empty
    expect(back.liabilities).toEqual([{ id: 'l1', kind: 'mortgage', balance: '', rate: '', payment: '' }]);
    expect(back.spending).toEqual({ ...DEFAULT_HOUSEHOLD_VALUES.spending, debtPayments: '100' });
    expect(back.assumptions).toEqual(DEFAULT_HOUSEHOLD_VALUES.assumptions);
    expect(back.calculators.pension.lumpSum).toBe('1');
    expect(back.calculators.rocket).toBeUndefined();
    expect(cleanHouseholdValues(JSON.parse('{"__proto__":{"polluted":true},"version":2}')).polluted).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });

  it('caps each list', () => {
    let v = DEFAULT_HOUSEHOLD_VALUES;
    for (let i = 0; i < 70; i += 1) v = addRow(v, 'incomes', { amount: '1' });
    expect(caseFromValuesV2(v).incomes).toHaveLength(MAX_ROWS);
  });

  it('the largest household that can be stored fits under the database cap (100,000 characters)', () => {
    // Every list full, every value at its 64-character limit: about 47,000 characters as JSON
    // (Postgres prints jsonb with a space after each ':' and ',', so leave room for that).
    const s = 'x'.repeat(64);
    const rows = (row) => Array.from({ length: MAX_ROWS }, () => row);
    const largest = caseFromValuesV2({
      ...DEFAULT_HOUSEHOLD_VALUES,
      people: ['p1', 'p2'].map((id) => ({ id, ageEntry: 'birthdate', age: s, birthDate: s, sex: 'female', retirementAge: s, planToAge: s, socialSecurity: { mode: 'pia', pia: s, claimAge: s } })),
      incomes: rows({ owner: 'p2', type: 'socialSecurity', treatment: 'taxExempt', amount: s, fromAge: s, toAge: s }),
      contributions: rows({ owner: 'p2', tax: 'taxable', account: '401k', amount: s }),
      accounts: rows({ owner: 'p2', type: 'taxable', balance: s, basisShare: s }),
      liabilities: rows({ kind: 'creditCard', balance: s, rate: s, payment: s }),
    });
    expect(JSON.stringify(largest).length).toBeLessThan(70000);
  });

  it("refuses something that isn't a saved household", () => {
    for (const junk of [null, 'x', [], { version: 3 }, { fields: 'x' }]) expect(valuesV2FromCase(junk, YEAR)).toBeNull();
  });

  it('marks unsaved changes, ignoring row ids', () => {
    expect(sameSavedHouseholdV2(couple, null)).toBe(false);
    expect(sameSavedHouseholdV2(couple, valuesV2FromCase(json(caseFromValuesV2(couple)), YEAR))).toBe(true);
    expect(sameSavedHouseholdV2({ ...couple, filingStatus: 'single' }, couple)).toBe(false);
  });
});

describe('a version 1 save opens as version 2', () => {
  // One test per household: each runs every calculator twice.
  for (const name of ['mfjSpouse', 'singleEverything', 'spouseRemoved']) {
    it(`${name}: converted, with the same results`, () => {
      const stored = json(caseFromValues(V1_HOUSEHOLDS[name]));
      const opened = valuesV2FromCase(stored, YEAR);
      expect(opened.version).toBe(2);
      const v1 = pinsFor(V1_HOUSEHOLDS[name]);
      const v2 = pinsForV2(opened, { qbi: false }); // QBI (round 2 phase 1) left out, as in version 1
      // version 1's known-benefit inputs are carried as a PIA instead (householdUpgrade.test.js)
      for (const p of [v1, v2]) {
        delete p.compareInputs.knowsSocialSecurity;
        delete p.compareInputs.socialSecurityBenefit;
      }
      expect(v2).toEqual(v1);
    });
  }

  it('is the conversion of what version 1 would open', () => {
    const stored = json(caseFromValues(V1_HOUSEHOLDS.mfjOlderKnown));
    expect(valuesV2FromCase(stored, YEAR)).toEqual(upgradeHouseholdValues(V1_HOUSEHOLDS.mfjOlderKnown, YEAR));
  });
});
