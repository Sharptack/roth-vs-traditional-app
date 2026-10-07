import { describe, it, expect } from 'vitest';
import { caseFromValues, cleanLabel, sameSavedHousehold, valuesFromCase, MAX_ACCOUNTS } from '../src/lib/savedHousehold.js';
import { PREVIEW_DEFAULT_VALUES, toHousehold } from '../src/lib/household.js';

const couple = {
  ...PREVIEW_DEFAULT_VALUES,
  filingStatus: 'mfj',
  includeSpouse: 'yes',
  spouseIncome: '60000',
  spouseSavings: '6000',
  spouseCurrentType: 'roth',
  accounts: [
    { id: 'a1', owner: 'p1', type: 'pretax', balance: '100,000', basisShare: '0.5' },
    { id: 'a7', owner: 'p2', type: 'taxable', balance: '40000', basisShare: '0.25' },
  ],
};

describe('saved households: what is stored', () => {
  it('round-trips the form exactly (the same household comes back)', () => {
    const back = valuesFromCase(JSON.parse(JSON.stringify(caseFromValues(couple))));
    // account ids are renumbered (they only keep list rows apart); everything else is identical
    const noIds = (h) => ({ ...h, accounts: h.accounts.map(({ id, ...rest }) => rest) });
    expect(noIds(toHousehold(back, 2026))).toEqual(noIds(toHousehold(couple, 2026)));
    expect(back.accounts.map((a) => [a.id, a.owner, a.type, a.balance])).toEqual([
      ['a1', 'p1', 'pretax', '100,000'],
      ['a2', 'p2', 'taxable', '40000'],
    ]);
  });

  it('keeps only known form fields, as short strings', () => {
    const stored = caseFromValues({ ...couple, notAField: 'x', grossIncome: 5, currentAge: '3'.repeat(500) });
    expect(stored.fields.notAField).toBeUndefined();
    expect(stored.fields.grossIncome).toBeUndefined(); // not a string
    expect(stored.fields.currentAge).toHaveLength(64);
  });

  it('cleans what comes back: unknown fields, wrong types, bad account rows', () => {
    const back = valuesFromCase({
      fields: { grossIncome: '80000', __proto__: { polluted: true }, constructor: 'x', filingStatus: { evil: 1 } },
      accounts: [
        { owner: 'p1', type: 'roth', balance: '5000', basisShare: '0.5', extra: '<script>' },
        { owner: 'p9', type: 'roth', balance: '1' },
        { owner: 'p1', type: 'gold', balance: '1' },
        'not a row',
      ],
    });
    expect(back.grossIncome).toBe('80000');
    expect(back.filingStatus).toBe(PREVIEW_DEFAULT_VALUES.filingStatus);
    expect(back.polluted).toBeUndefined();
    expect(back.accounts).toEqual([{ id: 'a1', owner: 'p1', type: 'roth', balance: '5000', basisShare: '0.5' }]);
    expect({}.polluted).toBeUndefined();
  });

  it('caps the accounts list', () => {
    const many = Array.from({ length: 80 }, () => ({ owner: 'p1', type: 'pretax', balance: '1' }));
    expect(caseFromValues({ ...couple, accounts: many }).accounts).toHaveLength(MAX_ACCOUNTS);
  });

  it("refuses something that isn't a saved household", () => {
    expect(valuesFromCase(null)).toBeNull();
    expect(valuesFromCase([])).toBeNull();
    expect(valuesFromCase({ fields: null })).toBeNull();
    expect(valuesFromCase('{"fields":{}}')).toBeNull();
  });

  it('labels: trimmed, required, capped', () => {
    expect(cleanLabel('  The   J. household ')).toEqual({ label: 'The J. household', error: null });
    expect(cleanLabel('   ').error).toBe('Give the household a short name.');
    expect(cleanLabel('x'.repeat(81)).error).toBe('Keep the name under 80 characters.');
  });

  it('unsaved changes: compares what would be stored, not the objects', () => {
    const opened = valuesFromCase(caseFromValues(couple));
    // the same values in a new object, and a different account id, are not a change
    expect(sameSavedHousehold({ ...opened }, opened)).toBe(true);
    expect(sameSavedHousehold({ ...opened, accounts: opened.accounts.map((a) => ({ ...a, id: 'x' + a.id })) }, opened)).toBe(true);
    // a field outside the stored list (not saved, so not a change)
    expect(sameSavedHousehold({ ...opened, somethingElse: '1' }, opened)).toBe(true);
    // a typed field, an account balance, an account removed: changes
    expect(sameSavedHousehold({ ...opened, spouseIncome: '61000' }, opened)).toBe(false);
    expect(sameSavedHousehold({ ...opened, accounts: [{ ...opened.accounts[0], balance: '1' }, opened.accounts[1]] }, opened)).toBe(false);
    expect(sameSavedHousehold({ ...opened, accounts: opened.accounts.slice(0, 1) }, opened)).toBe(false);
    // nothing open: nothing to compare against
    expect(sameSavedHousehold(opened, null)).toBe(false);
  });
});
