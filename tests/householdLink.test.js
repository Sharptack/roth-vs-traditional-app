import { describe, it, expect } from 'vitest';
import { householdLinkSearch, householdValuesFromSearch } from '../src/lib/householdLink.js';
import { PREVIEW_DEFAULT_VALUES, householdToCompareInputs, toHousehold } from '../src/lib/household.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';
import { valuesFromSearch, valuesToSearch } from '../src/lib/shareInputs.js';

const couple = {
  ...PREVIEW_DEFAULT_VALUES,
  filingStatus: 'mfj',
  includeSpouse: 'yes',
  spouseIncome: '60000',
  spouseSavings: '6000',
  spouseClaimAge: '67',
  accounts: [
    { id: 'a1', owner: 'p1', type: 'pretax', balance: '$100,000', basisShare: '0.5' },
    { id: 'a2', owner: 'p2', type: 'roth', balance: '40000', basisShare: '0.5' },
    { id: 'a3', owner: 'p1', type: 'taxable', balance: '25000', basisShare: '0.25' },
  ],
};

describe('household share links', () => {
  it('round-trips a two-person household, accounts included, to the same household', () => {
    const search = householdLinkSearch(couple);
    expect(search).toMatch(/^\?hh=1&/);
    const back = householdValuesFromSearch(search);
    expect(back.viewOnly).toBe(false);
    expect(back.fromOldLink).toBe(false);
    expect(back.values.accounts.map((a) => [a.type, a.owner, a.balance, a.basisShare])).toEqual([
      ['pretax', 'p1', '100000', '0.5'],
      ['roth', 'p2', '40000', '0.5'],
      ['taxable', 'p1', '25000', '0.25'],
    ]);
    expect(toHousehold(back.values, 2026)).toEqual(toHousehold(couple, 2026));
  });

  it('carries the view-only flag', () => {
    expect(householdValuesFromSearch(householdLinkSearch(couple, { viewOnly: true })).viewOnly).toBe(true);
  });

  it("is invisible to the current calculator (its keys are prefixed)", () => {
    expect(valuesFromSearch(householdLinkSearch(couple))).toEqual({ values: null, compareValues: null });
  });

  it('opens an old (current calculator) link as a one-person household with the same result', () => {
    const old = { ...DEFAULT_FORM_VALUES, grossIncome: '150000', otherRothBalance: '30000', otherTaxableBalance: '20000' };
    const back = householdValuesFromSearch(valuesToSearch(old));
    expect(back.fromOldLink).toBe(true);
    const h = toHousehold(back.values, 2026);
    expect(h.people).toHaveLength(1);
    // the same inputs, plus the new version's retirement-year tax rules
    const { retirementTaxRules, ...rest } = householdToCompareInputs(h);
    expect(rest).toEqual(toCompareInputs(old, 2026));
    expect(retirementTaxRules.ages).toEqual([65]);
  });

  it('no inputs in the link -> null; malformed account rows are dropped', () => {
    expect(householdValuesFromSearch('')).toBeNull();
    expect(householdValuesFromSearch('?utm_source=x')).toBeNull();
    const back = householdValuesFromSearch('?hh=1&acc=pretax~p1~5000~0.5,bogus~p1~1,roth~p9~3');
    expect(back.values.accounts).toEqual([{ id: 'a1', owner: 'p1', type: 'pretax', balance: '5000', basisShare: '0.5' }]);
    expect(back.values.grossIncome).toBe(PREVIEW_DEFAULT_VALUES.grossIncome);
  });
});
