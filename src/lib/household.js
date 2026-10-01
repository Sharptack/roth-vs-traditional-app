// The household model (roadmap phase 1): one plain object that describes the client household,
// read by every calculator. Pure, framework-free.
//
//   form strings -> toHousehold(values, year) -> household -> householdToCompareInputs(household)
//                -> compareRothVsTraditional
//
// household = {
//   version: 1,
//   year,                                  // the tax year the snapshot is for
//   filingStatus: 'single' | 'mfj',
//   people: [                              // 1 person, or 2 when mfj with a spouse included
//     { id: 'p1', birthYear, retirementAge,
//       wages, selfEmploymentIncome,       // W-2 and net 1099 earnings
//       socialSecurity: { known, benefit, claimAge } },   // claimAge null = at retirement age
//   ],
//   accounts: [                            // the Existing Accounts, any number
//     { id, owner: 'p1', type: 'pretax' | 'roth' | 'taxable', balance, basisShare } ],
//                                          // basisShare: taxable only, share of today's balance
//   futureContributions: { owner, amount, currentType, accountType },
//   spending: { debtPaymentsEnding, otherExpensesEnding, retirementLifestyle },
//   assumptions: { returnRate },
// }
//
// The current calculator still reads its flat form values directly (build alongside, see
// CLAUDE.md); only the #/next preview goes through here. For one person, the round trip
// form -> household -> compare inputs gives exactly the inputs toCompareInputs gives (tested).
import { DEFAULT_FORM_VALUES, parseNumber, toCompareInputs } from './formInputs.js';

export const HOUSEHOLD_VERSION = 1;

// Spouse fields of the preview form. Kept out of DEFAULT_FORM_VALUES so the current
// calculator's form, share links and tests are untouched.
export const SPOUSE_DEFAULT_VALUES = {
  includeSpouse: 'no', // 'yes' | 'no'; only used when filing jointly
  spouseAge: '35',
  spouseRetirementAge: '65',
  spouseIncome: '0',
  spouseIncomeType: 'w2', // 'w2' | '1099'
  spouseKnowsSocialSecurity: 'no',
  spouseSocialSecurityBenefit: '',
};

export const PREVIEW_DEFAULT_VALUES = { ...DEFAULT_FORM_VALUES, ...SPOUSE_DEFAULT_VALUES };

const blankAsZero = (text) => (String(text ?? '').trim() === '' ? 0 : parseNumber(text));

export function hasSpouse(values) {
  return values.filingStatus === 'mfj' && values.includeSpouse === 'yes';
}

export function toHousehold(values, year) {
  const flat = toCompareInputs(values, year);
  const p1 = {
    id: 'p1',
    birthYear: year - flat.currentAge,
    retirementAge: flat.retirementAge,
    wages: flat.grossIncome - flat.selfEmploymentIncome,
    selfEmploymentIncome: flat.selfEmploymentIncome,
    socialSecurity: { known: flat.knowsSocialSecurity, benefit: flat.socialSecurityBenefit, claimAge: null },
  };
  const people = [p1];
  if (hasSpouse(values)) {
    const income = blankAsZero(values.spouseIncome);
    const is1099 = values.spouseIncomeType === '1099';
    people.push({
      id: 'p2',
      birthYear: year - parseNumber(values.spouseAge),
      retirementAge: parseNumber(values.spouseRetirementAge),
      wages: is1099 ? 0 : income,
      selfEmploymentIncome: is1099 ? income : 0,
      socialSecurity: {
        known: values.spouseKnowsSocialSecurity === 'yes',
        benefit: parseNumber(values.spouseSocialSecurityBenefit),
        claimAge: null,
      },
    });
  }
  return {
    version: HOUSEHOLD_VERSION,
    year,
    filingStatus: flat.filingStatus,
    people,
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: flat.otherPretaxBalance },
      { id: 'a2', owner: 'p1', type: 'roth', balance: flat.otherRothBalance },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: flat.otherTaxableBalance, basisShare: flat.otherTaxableBasis },
    ],
    futureContributions: {
      owner: 'p1',
      amount: flat.savings,
      currentType: flat.currentType,
      accountType: flat.accountType,
    },
    spending: {
      debtPaymentsEnding: flat.debtPayments,
      otherExpensesEnding: flat.otherExpenses,
      retirementLifestyle: flat.retirementLifestyle,
    },
    assumptions: { returnRate: flat.returnRate },
  };
}

// Errors about the household's own structure (people, owners, ages). Everything else (amounts,
// rates, choices) is validated by the calculator that reads it, as today.
export function validateHousehold(household) {
  const errors = [];
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const { people, accounts, futureContributions, filingStatus, year } = household;
  if (!Array.isArray(people) || people.length < 1 || people.length > 2) {
    errors.push('A household has one or two people.');
    return errors;
  }
  if (people.length === 2 && filingStatus !== 'mfj') errors.push('A spouse can only be added when filing jointly.');
  const ids = new Set(people.map((p) => p.id));
  if (ids.size !== people.length) errors.push('Each person needs a different id.');
  people.forEach((p, i) => {
    if (i === 0) return; // the first person is checked by the calculator, with its current messages
    const age = year - p.birthYear;
    if (!isNum(age) || age < 16 || age > 100) errors.push("Enter your spouse's current age (16–100).");
    if (!isNum(p.retirementAge) || p.retirementAge > 100) {
      errors.push("Enter your spouse's planned retirement age.");
    } else if (isNum(age) && p.retirementAge <= age) {
      errors.push("Your spouse's retirement age must be after their current age.");
    }
    if (!isNum(p.wages) || !isNum(p.selfEmploymentIncome) || p.wages < 0 || p.selfEmploymentIncome < 0) {
      errors.push("Enter your spouse's income.");
    }
    if (p.socialSecurity.known && (!isNum(p.socialSecurity.benefit) || p.socialSecurity.benefit < 0)) {
      errors.push("Enter your spouse's annual Social Security benefit.");
    }
  });
  for (const a of accounts ?? []) {
    if (!ids.has(a.owner)) errors.push(`Account ${a.id} belongs to someone not in the household.`);
    if (!['pretax', 'roth', 'taxable'].includes(a.type)) errors.push(`Account ${a.id} has an unknown type.`);
  }
  if (!ids.has(futureContributions?.owner)) errors.push('Future Contributions belong to someone not in the household.');
  return errors;
}

// The Roth calculator's flat inputs from a household.
//  - Existing Accounts: summed by type, whoever owns them; the taxable cost basis is the
//    balance-weighted share (the first taxable account's share when every balance is $0).
//  - Snapshot timing (phase 1 decision): retirement = when the FIRST person retires. Future
//    Contributions grow until then; currentAge is their owner's age (it sets the IRS limit's
//    catch-up), and retirementAge = owner's age + years until that first retirement.
//  - With two people, `earners` carries each person's income, age and claiming age, so payroll
//    tax and Social Security are figured per person (compare.js). With one person it is left
//    out, so the calculation is exactly today's.
export function householdToCompareInputs(household) {
  const { year, people, accounts, futureContributions: fc, spending, assumptions } = household;
  const ageOf = (p) => year - p.birthYear;
  const owner = people.find((p) => p.id === fc.owner) ?? people[0];
  const yearsToRetirement = Math.min(...people.map((p) => p.retirementAge - ageOf(p)));
  const balanceOf = (type) =>
    accounts.filter((a) => a.type === type).reduce((acc, a) => acc + a.balance, 0);
  const taxable = accounts.filter((a) => a.type === 'taxable');
  const taxableTotal = balanceOf('taxable');
  const basisShare =
    taxable.length === 1
      ? (taxable[0].basisShare ?? 0)
      : taxableTotal > 0
      ? taxable.reduce((acc, a) => acc + a.balance * (a.basisShare ?? 0), 0) / taxableTotal
      : (taxable[0]?.basisShare ?? 0);
  const p1 = people[0];

  const inputs = {
    grossIncome: people.reduce((acc, p) => acc + p.wages + p.selfEmploymentIncome, 0),
    selfEmploymentIncome: people.reduce((acc, p) => acc + p.selfEmploymentIncome, 0),
    filingStatus: household.filingStatus,
    currentAge: ageOf(owner),
    // One person: their own retirement age as entered (so a blank age gives today's messages).
    retirementAge: people.length === 1 ? owner.retirementAge : ageOf(owner) + yearsToRetirement,
    debtPayments: spending.debtPaymentsEnding,
    otherExpenses: spending.otherExpensesEnding,
    savings: fc.amount,
    currentType: fc.currentType,
    accountType: fc.accountType,
    knowsSocialSecurity: p1.socialSecurity.known,
    socialSecurityBenefit: p1.socialSecurity.benefit,
    returnRate: assumptions.returnRate,
    retirementLifestyle: spending.retirementLifestyle,
    otherPretaxBalance: balanceOf('pretax'),
    otherRothBalance: balanceOf('roth'),
    otherTaxableBalance: taxableTotal,
    otherTaxableBasis: basisShare,
    year,
  };
  if (people.length > 1) {
    inputs.earners = people.map((p) => ({
      wages: p.wages,
      selfEmploymentIncome: p.selfEmploymentIncome,
      currentAge: ageOf(p),
      claimAge: p.socialSecurity.claimAge ?? p.retirementAge,
      knowsSocialSecurity: p.socialSecurity.known,
      socialSecurityBenefit: p.socialSecurity.benefit,
    }));
  }
  return inputs;
}
