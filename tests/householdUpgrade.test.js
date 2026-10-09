// Version 1 -> version 2 (round 2 phase 0): every version 1 example opens with the same results
// (tests/householdV1Pins.test.js), except decided changes:
//  - a known benefit becomes a PIA, and a PIA counts for the spousal top-up (2026-10-07);
//  - (round 2 phase 1) 1099 earnings get the QBI deduction;
//  - (2026-10-08, the inputs regrouped) a pension is an income row: a pension offer someone typed
//    in becomes one, counted by every calculator; one left at the example defaults doesn't, so the
//    pension calculator has nothing to show; its fixed end ages are gone (life expectancy decides);
//    and the projection runs until the LAST person's plan-to age.
import { describe, it, expect } from 'vitest';
import { piaFromKnownBenefit, upgradeHouseholdValues } from '../src/lib/householdUpgrade.js';
import { DEFAULT_HOUSEHOLD_VALUES, newPerson } from '../src/lib/householdValues.js';
import { toHouseholdV2, validateHouseholdV2 } from '../src/lib/householdV2.js';
import { PREVIEW_DEFAULT_VALUES } from '../src/lib/household.js';
import { V1_HOUSEHOLDS } from './fixtures/householdV1.js';
import { YEAR, pinsFor, pinsForV2 } from './fixtures/householdPins.js';

// Version 1's "known benefit" inputs are replaced by the PIA (carried in `earners`, which the
// pins leave out); everything else must match.
const withoutKnownBenefit = (pins) => ({
  ...pins,
  compareInputs: { ...pins.compareInputs, knowsSocialSecurity: undefined, socialSecurityBenefit: undefined },
});

// The examples whose typed-in pension offer becomes a pension row (counted in the Roth comparison,
// the projection and the lifetime comparison), and the couple whose younger spouse's plan-to age
// runs the projection longer.
const PENSION_COUNTED = ['singleEverything', 'mfjOlderKnown'];
const SPOUSE_PLANS_LONGER = ['mfjSpouse'];
const PLAN_SECTIONS = ['compareInputs', 'roth', 'projection', 'lifetime'];
// The pension calculator without the fixed end ages (life expectancy replaced them, phase 1 step c).
const withoutEndAges = (pension) =>
  pension && {
    inputs: { ...pension.inputs, endAge: undefined, spouseEndAge: undefined },
    result: { ...pension.result, irr: undefined, totalPayments: undefined, months: undefined },
  };

describe('version 1 households open in version 2 with the same results', () => {
  for (const [name, values] of Object.entries(V1_HOUSEHOLDS)) {
    if (name === 'mfjMixedBenefits') continue; // the decided change, below
    it(name, () => {
      const v2 = upgradeHouseholdValues(values, YEAR);
      const before = withoutKnownBenefit(pinsFor(values));
      const after = withoutKnownBenefit(pinsForV2(v2, { qbi: false, lastRetirement: false, dividends: false }));
      const hasPension = v2.incomes.some((r) => r.type === 'pension');
      expect(hasPension, name).toBe(PENSION_COUNTED.includes(name));
      if (hasPension) expect(withoutEndAges(after.pension)).toEqual(withoutEndAges(before.pension));
      else expect(after.pension).toBeNull();
      expect(after.tax).toEqual(before.tax);
      expect(after.conversion).toEqual(before.conversion);
      const changed = PENSION_COUNTED.includes(name) ? PLAN_SECTIONS : SPOUSE_PLANS_LONGER.includes(name) ? ['projection', 'lifetime'] : [];
      for (const section of PLAN_SECTIONS) {
        if (changed.includes(section)) expect(after[section], `${name} ${section}`).not.toEqual(before[section]);
        else expect(after[section], `${name} ${section}`).toEqual(before[section]);
      }
    });
  }

  it('the QBI deduction changes only households with 1099 income, and lowers their tax', () => {
    for (const [name, values] of Object.entries(V1_HOUSEHOLDS)) {
      const v2 = upgradeHouseholdValues(values, YEAR);
      const on = pinsForV2(v2);
      const off = pinsForV2(v2, { qbi: false });
      const has1099 = v2.incomes.some((r) => r.type === '1099' && Number(r.amount) > 0) && (v2.includeSpouse === 'yes' || v2.incomes.some((r) => r.type === '1099' && r.owner === 'p1' && Number(r.amount) > 0));
      if (!has1099) {
        expect({ ...on, compareInputs: { ...on.compareInputs, qualifiedBusinessIncome: undefined } }, name).toEqual(off);
      } else {
        expect(on.tax.incomeTax, name).toBeLessThan(off.tax.incomeTax);
      }
    }
  }, 60000); // every example twice, whole projections included: slow under a full parallel run

  it('mfjMixedBenefits: the spouse with no earnings gains a spousal top-up from the PIA (HAND CALC)', () => {
    // You: age 50 (born 1976, full retirement age 67), known $42,000 claimed at retirement, 64:
    //   36 months early -> x 0.8, so the PIA = 42,000 / 12 / 0.8 = 4,375 a month.
    // Spouse: age 48, no earnings (estimated PIA 0), retires at 60 -> claims at 62.
    //   Spousal part starts at max(62, your claim at 64 when they're 62) = 62: 60 months early ->
    //   1 - (36 x 25/36% + 24 x 5/12%) = 1 - 35% = 0.65.  0.5 x 4,375 x 0.65 = 1,421.875 a month
    //   = 17,062.50 a year.  Household: 42,000 + 17,062.50 = 59,062.50 (version 1: 42,000).
    const values = V1_HOUSEHOLDS.mfjMixedBenefits;
    const v1 = pinsFor(values);
    const v2 = pinsForV2(upgradeHouseholdValues(values, YEAR));
    expect(v1.roth.socialSecurity.annualBenefit).toBe(42000);
    expect(v2.roth.socialSecurity.annualBenefit).toBeCloseTo(59062.5, 6);
    // Social Security doesn't reach this year's tax, the conversion or the pension.
    expect(v2.tax).toEqual(v1.tax);
    expect(v2.conversion).toEqual(v1.conversion);
    expect(v2.pension).toEqual(v1.pension);
  });
});

describe('upgradeHouseholdValues, field by field', () => {
  it('a known benefit becomes the PIA that gives it at the claiming age (HAND CALC)', () => {
    // age 52 (born 1974, full retirement age 67), $38,000 at 67: factor 1 -> 38,000 / 12 = 3,166.67
    expect(Number(piaFromKnownBenefit({ benefit: '38000', currentAge: '52', claimAge: '67', year: YEAR }))).toBeCloseTo(3166.666667, 6);
    // age 62 (born 1964), $36,000 at 70: 36 months late, x 1.24 -> 36,000 / 12 / 1.24 = 2,419.35
    expect(Number(piaFromKnownBenefit({ benefit: '36,000', currentAge: '62', claimAge: '70', year: YEAR }))).toBeCloseTo(2419.354839, 6);
    // age 66 (born 1960, full retirement age 67), $14,000 at 66: 12 months early,
    //   1 - 12 x 5/9% = 0.933333 -> 14,000 / 12 / 0.933333 = 1,250
    expect(Number(piaFromKnownBenefit({ benefit: '14000', currentAge: '66', claimAge: '66', year: YEAR }))).toBeCloseTo(1250, 9);
    expect(piaFromKnownBenefit({ benefit: '', currentAge: '66', claimAge: '66', year: YEAR })).toBe('');
  });

  it('turns the people, income, savings and other income into rows', () => {
    const v = upgradeHouseholdValues(V1_HOUSEHOLDS.mfjOlderKnown, YEAR);
    expect(v.version).toBe(2);
    expect(v.people.map((p) => [p.id, p.age, p.retirementAge, p.ageEntry, p.birthDate, p.sex])).toEqual([
      ['p1', '62', '67', 'age', '', ''],
      ['p2', '66', '68', 'age', '', ''],
    ]);
    expect(v.people.every((p) => p.socialSecurity === undefined)).toBe(true);
    const pick = ({ id, owner, type, treatment, amount, fromAge, toAge }) => ({ id, owner, type, treatment, amount, fromAge, toAge });
    expect(v.incomes.slice(0, 3).map(pick)).toEqual([
      { id: 'i1', owner: 'p1', type: 'w2', treatment: 'ordinary', amount: '130000', fromAge: '', toAge: '' },
      { id: 'i2', owner: 'p2', type: 'w2', treatment: 'ordinary', amount: '45000', fromAge: '', toAge: '' },
      // the tax calculator's own income: this year only (your age now), as other income of its kind
      { id: 'i3', owner: 'p1', type: 'other', treatment: 'qualified', amount: '12000', fromAge: '62', toAge: '62' },
    ]);
    // each person's Social Security as a row: the known benefits as PIAs at their claiming ages
    // (36,000 at 70 for someone 62 now: 2,419.35, as above). The tax calculator's "Social Security
    // received" 14,000 is dropped: your benefit is entered (and the spouse's 14,000 at 66 is this
    // year's anyway).
    expect(v.incomes.slice(3, 5).map(({ owner, type, ssMode, fromAge }) => ({ owner, type, ssMode, fromAge }))).toEqual([
      { owner: 'p1', type: 'socialSecurity', ssMode: 'pia', fromAge: '70' },
      { owner: 'p2', type: 'socialSecurity', ssMode: 'pia', fromAge: '66' },
    ]);
    expect(Number(v.incomes[3].amount)).toBeCloseTo(2419.354839, 6);
    // the pension offer was typed in (start age 67, survivor 75%): a pension row for you
    expect(v.incomes[5]).toMatchObject({ id: 'i6', owner: 'p1', type: 'pension', amount: '1800', fromAge: '67', cola: '0', survivorShare: '0.75' });
    expect(v.incomes).toHaveLength(6);
    expect(v.calculators.pension).toEqual({ lumpSum: '300000' });
    expect(v.contributions).toEqual([
      { id: 'c1', owner: 'p1', tax: 'pretax', account: '401k', amount: '31000' },
      { id: 'c2', owner: 'p2', tax: 'roth', account: 'ira', amount: '8000' },
    ]);
    expect(v.liabilities).toEqual([]);
    expect(v.spending.debtPayments).toBe('6000');
  });

  it('"both" becomes a W-2 row and a 1099 row', () => {
    // 180,000 in all, 40,000 of it 1099 -> W-2 140,000 + 1099 40,000
    const v = upgradeHouseholdValues(V1_HOUSEHOLDS.singleBoth, YEAR);
    expect(v.incomes.filter((r) => r.type !== 'socialSecurity').map((r) => [r.type, r.amount])).toEqual([['w2', '140000'], ['1099', '40000']]);
  });

  it("keeps a spouse who was typed in but isn't included, and an old link's three balances", () => {
    const spouse = upgradeHouseholdValues(V1_HOUSEHOLDS.spouseButSingle, YEAR);
    expect(spouse.people).toHaveLength(2);
    expect(spouse.includeSpouse).toBe('yes');
    expect(upgradeHouseholdValues(PREVIEW_DEFAULT_VALUES, YEAR).people).toHaveLength(1);
    const old = upgradeHouseholdValues(V1_HOUSEHOLDS.oldPublicLink, YEAR);
    expect(old.accounts.map((a) => [a.type, a.balance])).toEqual([['pretax', '40000'], ['roth', '10000'], ['taxable', '25000']]);
  });

  it('leaves version 2 values as they are, and the defaults convert to the version 2 defaults', () => {
    expect(upgradeHouseholdValues(DEFAULT_HOUSEHOLD_VALUES, YEAR)).toBe(DEFAULT_HOUSEHOLD_VALUES);
    expect(upgradeHouseholdValues(PREVIEW_DEFAULT_VALUES, YEAR)).toEqual(DEFAULT_HOUSEHOLD_VALUES);
  });
});

describe('Social Security worked out from earnings needs no PIA', () => {
  // The default household with its Social Security row (i2) set as given.
  const person = ({ mode, pia, claimAge }) => ({
    ...DEFAULT_HOUSEHOLD_VALUES,
    people: [newPerson('p1')],
    incomes: DEFAULT_HOUSEHOLD_VALUES.incomes.map((r) => (r.id === 'i2' ? { ...r, ssMode: mode, amount: pia, fromAge: claimAge } : r)),
  });

  it('"estimate" with the PIA blank: no error, the benefit comes from earnings', () => {
    const h = toHouseholdV2(person({ mode: 'estimate', pia: '', claimAge: '' }), YEAR);
    expect(validateHouseholdV2(h)).toEqual([]);
    const pins = pinsForV2(person({ mode: 'estimate', pia: '', claimAge: '' }));
    expect(pins.roth.valid).toBe(true);
    expect(pins.roth.socialSecurity.estimated).toBe(true);
    expect(pins.roth.socialSecurity.annualBenefit).toBe(pinsFor(PREVIEW_DEFAULT_VALUES).roth.socialSecurity.annualBenefit);
  });

  it('a PIA left in the field after switching back to "estimate" is ignored', () => {
    const pins = pinsForV2(person({ mode: 'estimate', pia: '9999', claimAge: '' }));
    expect(pins.roth.valid).toBe(true);
    expect(pins.roth.socialSecurity.estimated).toBe(true);
    expect(pins.roth.socialSecurity.annualBenefit).toBe(pinsFor(PREVIEW_DEFAULT_VALUES).roth.socialSecurity.annualBenefit);
  });

  it('only "enter the PIA" with the field blank is an error', () => {
    const h = toHouseholdV2(person({ mode: 'pia', pia: '', claimAge: '' }), YEAR);
    expect(validateHouseholdV2(h)).toEqual(['Enter your monthly Social Security benefit at full retirement age (PIA).']);
  });
});

describe('the preview runs on the version 2 household (step a, commit 8)', () => {
  it('converts the form values and reads the version 2 household', async () => {
    const { previewResult } = await import('../src/next/NextApp.jsx');
    const { household, result } = previewResult(V1_HOUSEHOLDS.mfjMixedBenefits, YEAR, { blend: false });
    expect(household.version).toBe(2);
    // the decided change shows up in the preview (hand calc in the mfjMixedBenefits test above)
    expect(result.socialSecurity.annualBenefit).toBeCloseTo(59062.5, 6);
    expect(previewResult(V1_HOUSEHOLDS.cleared, YEAR, { blend: false }).result.errors).toEqual(pinsFor(V1_HOUSEHOLDS.cleared).roth.errors);
  });
});
