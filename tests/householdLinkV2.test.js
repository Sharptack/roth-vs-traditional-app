// Share links in version 2 (round 2 phase 0).
import { describe, it, expect } from 'vitest';
import { householdLinkSearch, householdLinkSearchV2, householdValuesFromSearch, householdValuesV2FromSearch } from '../src/lib/householdLink.js';
import { DEFAULT_HOUSEHOLD_VALUES, newPerson, setIncludeSpouse } from '../src/lib/householdValues.js';
import { upgradeHouseholdValues } from '../src/lib/householdUpgrade.js';
import { V1_HOUSEHOLDS } from './fixtures/householdV1.js';
import { YEAR } from './fixtures/householdPins.js';

const row = (r) => ({ treatment: 'ordinary', amount: '', fromAge: '', toAge: '', ssMode: 'estimate', cola: '0', survivorShare: '0', qbi: 'yes', ...r });
const couple = {
  ...setIncludeSpouse({ ...DEFAULT_HOUSEHOLD_VALUES, filingStatus: 'mfj' }, true),
  people: [
    newPerson('p1', { ageEntry: 'birthdate', birthDate: '1970-03-14', age: '56' }),
    newPerson('p2', { age: '54', sex: 'female' }),
  ],
  incomes: [
    row({ id: 'i1', owner: 'p1', type: 'w2', amount: '$150,000' }),
    row({ id: 'i2', owner: 'p2', type: '1099', amount: '40000' }),
    row({ id: 'i3', owner: 'p1', type: 'socialSecurity', ssMode: 'pia', amount: '3100', fromAge: '68' }),
    row({ id: 'i4', owner: 'p2', type: 'socialSecurity' }),
    row({ id: 'i5', owner: 'p2', type: 'pension', amount: '2100', fromAge: '60', cola: '0.02', survivorShare: '0.5' }),
  ],
  contributions: [
    { id: 'c1', owner: 'p1', tax: 'roth', account: '401k', amount: '24000', employer: 'match', matchRate: '0.5', matchUpTo: '0.06', employerAmount: '' },
    { id: 'c2', owner: 'p2', tax: 'pretax', account: 'ira', amount: '7000', employer: 'none', matchRate: '1', matchUpTo: '0.04', employerAmount: '' },
  ],
  liabilities: [{ id: 'l1', kind: 'mortgage', balance: '310000', rate: '0.0625', payment: '2400' }],
};

const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

describe('version 2 share links', () => {
  it('round-trip the values exactly, view-only or not', () => {
    const search = householdLinkSearchV2(couple);
    expect(search).toMatch(/^\?hh=2&v=[A-Za-z0-9_-]+$/);
    expect(householdValuesV2FromSearch(search, YEAR)).toEqual({ values: couple, viewOnly: false, fromOldLink: false });
    expect(householdValuesV2FromSearch(householdLinkSearchV2(couple, { viewOnly: true }), YEAR).viewOnly).toBe(true);
  });

  it('carry text beyond plain ASCII intact', () => {
    const v = { ...couple, incomes: [{ ...couple.incomes[0], amount: '150 000 €' }] };
    expect(householdValuesV2FromSearch(householdLinkSearchV2(v), YEAR).values.incomes[0].amount).toBe('150 000 €');
  });

  it('stay a reasonable length for a two-person household with rows', () => {
    // five income rows (Social Security and a pension among them) and every field: well within what
    // browsers and chat apps carry
    expect(householdLinkSearchV2(couple).length).toBeLessThan(3000);
  });

  it('clean what comes back, like a saved household', () => {
    const tampered = `?hh=2&v=${encode({ ...couple, evil: '<script>', filingStatus: 'x', incomes: [{ owner: 'p7', type: 'w2', amount: '1' }] })}`;
    const back = householdValuesV2FromSearch(tampered, YEAR).values;
    expect(back.evil).toBeUndefined();
    expect(back.filingStatus).toBe('single');
    expect(back.incomes).toEqual([]);
  });

  it("an unreadable version 2 link opens nothing (the page's defaults)", () => {
    for (const v of ['', 'not-base64!!', encode('just a string'), encode({ version: 1 })]) {
      expect(householdValuesV2FromSearch(`?hh=2&v=${v}`, YEAR)).toBeNull();
    }
    expect(householdValuesV2FromSearch('', YEAR)).toBeNull();
  });
});

describe('version 1 links open as version 2', () => {
  it('an hh=1 link, converted', () => {
    const v1 = V1_HOUSEHOLDS.mfjOlderKnown;
    const back = householdValuesV2FromSearch(householdLinkSearch(v1, { viewOnly: true }), YEAR);
    expect(back.viewOnly).toBe(true);
    expect(back.fromOldLink).toBe(false);
    expect(back.values).toEqual(upgradeHouseholdValues(householdValuesFromSearch(householdLinkSearch(v1)).values, YEAR));
    expect(back.values.incomes.find((r) => r.owner === 'p2' && r.type === 'socialSecurity').ssMode).toBe('pia');
  });

  it('an old public-calculator link, converted as a one-person household', () => {
    const back = householdValuesV2FromSearch('?grossIncome=95000&currentAge=30&otherRothBalance=10000', YEAR);
    expect(back.fromOldLink).toBe(true);
    expect(back.values.version).toBe(2);
    expect(back.values.people).toHaveLength(1);
    expect(back.values.incomes.map((r) => [r.type, r.amount])).toEqual([['w2', '95000'], ['socialSecurity', '']]);
    // a field the link leaves out takes the public calculator's default ($100,000 Pre-tax), as in version 1
    expect(back.values.accounts.map((a) => [a.type, a.balance])).toEqual([['pretax', '100000'], ['roth', '10000']]);
  });
});
