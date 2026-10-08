// Version 1 household form values -> version 2 (round 2 phase 0). Pure. Every place a version 1
// household can come from goes through here: the preview's form, a share link (hh=1 or an old
// public-calculator link, householdLink.js), a saved household (savedHousehold.js).
//
// The rule: the converted household gives the same results as the version 1 household
// (tests/householdUpgrade.test.js checks every calculator against the pins), with one exception
// decided on 2026-10-07: a known Social Security benefit becomes a PIA (the benefit undone by
// its claiming adjustment), and a PIA counts for the spousal top-up, which a known benefit never
// did. So a couple with a known benefit can gain a spousal top-up.
//
//   income      -> income rows: yours (W-2, 1099, or one of each for "both"), the spouse's, and
//                  the tax calculator's other income as rows for this year only
//   savings     -> one contribution row for you (always, so the household keeps its Roth/Pre-tax
//                  type), and one for the spouse when they save or have their own types
//   ages        -> ages as typed (no birthdate is invented); biological sex unset
//   debt payments that end stay a spending field; no liabilities
import { parseNumber } from './formInputs.js';
import { PREVIEW_DEFAULT_VALUES, SPOUSE_DEFAULT_VALUES, accountRowsFromFlat } from './household.js';
import { benefitFromPIA } from './socialSecurity.js';
import { HOUSEHOLD_VALUES_VERSION, newPerson } from './householdValues.js';

const isBlankOrZero = (text) => ['', '0'].includes(String(text ?? '').trim());
const pick = (values, key) => values[key] ?? PREVIEW_DEFAULT_VALUES[key];

// A known annual benefit claimed at claimAge -> the monthly PIA that gives it. '' when it can't be
// worked out (a blank benefit, age or claiming age: version 1 shows its own error then).
export function piaFromKnownBenefit({ benefit, currentAge, claimAge, year }) {
  const b = parseNumber(benefit);
  const age = parseNumber(currentAge);
  const claim = parseNumber(claimAge);
  if (![b, age, claim].every(Number.isFinite)) return '';
  const { adjustmentFactor } = benefitFromPIA({ pia: 1, currentAge: age, retirementAge: claim, year });
  return String(b / 12 / adjustmentFactor);
}

function socialSecurity(known, benefit, claimAge, currentAge, retirementAge, year) {
  if (known !== 'yes') return { mode: 'estimate', pia: '', claimAge: claimAge ?? '' };
  const claim = String(claimAge ?? '').trim() === '' ? retirementAge : claimAge;
  return { mode: 'pia', pia: piaFromKnownBenefit({ benefit, currentAge, claimAge: claim, year }), claimAge: claimAge ?? '' };
}

// Whether the version 1 values hold a spouse worth keeping: included, or any spouse field typed.
function hasSpouseDetails(values) {
  return values.includeSpouse === 'yes' || Object.keys(SPOUSE_DEFAULT_VALUES).some((k) => k !== 'includeSpouse' && values[k] !== undefined && values[k] !== SPOUSE_DEFAULT_VALUES[k]);
}

// year: the calendar year the household is opened in (for the PIA's full retirement age).
export function upgradeHouseholdValues(values, year) {
  if (values?.version === HOUSEHOLD_VALUES_VERSION) return values;
  const v = { ...PREVIEW_DEFAULT_VALUES, ...values };
  const incomes = [];
  const contributions = [];
  const addIncome = (owner, type, amount, ages = {}) =>
    incomes.push({ id: `i${incomes.length + 1}`, owner, type, treatment: 'ordinary', amount, fromAge: ages.fromAge ?? '', toAge: ages.toAge ?? '' });

  // Your income: one row, or a W-2 row and a 1099 row for "both".
  if (v.incomeType === '1099') addIncome('p1', '1099', v.grossIncome);
  else if (v.incomeType === 'both') {
    const gross = parseNumber(v.grossIncome);
    const se = String(v.selfEmploymentIncome ?? '').trim() === '' ? 0 : parseNumber(v.selfEmploymentIncome);
    const bothValid = Number.isFinite(gross) && Number.isFinite(se);
    addIncome('p1', 'w2', bothValid ? String(gross - se) : v.grossIncome);
    addIncome('p1', '1099', bothValid ? String(se) : v.selfEmploymentIncome);
  } else addIncome('p1', 'w2', v.grossIncome);

  const people = [
    newPerson('p1', {
      age: v.currentAge,
      retirementAge: v.retirementAge,
      socialSecurity: socialSecurity(v.knowsSocialSecurity, v.socialSecurityBenefit, v.claimAge, v.currentAge, v.retirementAge, year),
    }),
  ];
  contributions.push({ id: 'c1', owner: 'p1', tax: v.currentType, account: v.accountType, amount: v.savings });

  if (hasSpouseDetails(v)) {
    people.push(
      newPerson('p2', {
        age: v.spouseAge,
        retirementAge: v.spouseRetirementAge,
        socialSecurity: socialSecurity(v.spouseKnowsSocialSecurity, v.spouseSocialSecurityBenefit, v.spouseClaimAge, v.spouseAge, v.spouseRetirementAge, year),
      }),
    );
    if (!isBlankOrZero(v.spouseIncome)) addIncome('p2', v.spouseIncomeType === '1099' ? '1099' : 'w2', v.spouseIncome);
    const ownTax = ['pretax', 'roth'].includes(v.spouseCurrentType) ? v.spouseCurrentType : null;
    const ownAccount = ['401k', 'ira'].includes(v.spouseAccountType) ? v.spouseAccountType : null;
    if (!isBlankOrZero(v.spouseSavings) || ownTax || ownAccount) {
      contributions.push({ id: 'c2', owner: 'p2', tax: ownTax ?? v.currentType, account: ownAccount ?? v.accountType, amount: v.spouseSavings });
    }
  }

  // The tax calculator's other income: this year only (your age now, both ends).
  const thisYear = { fromAge: v.currentAge, toAge: v.currentAge };
  for (const [key, type] of [
    ['taxOrdinaryIncome', 'other'],
    ['taxInvestmentIncome', 'interest'],
    ['taxPreferentialIncome', 'qualified'],
    ['taxSocialSecurity', 'socialSecurity'],
  ]) {
    if (!isBlankOrZero(v[key])) addIncome('p1', type, v[key], thisYear);
  }

  return {
    version: HOUSEHOLD_VALUES_VERSION,
    filingStatus: v.filingStatus,
    includeSpouse: v.includeSpouse === 'yes' ? 'yes' : 'no',
    people,
    incomes,
    contributions,
    accounts: Array.isArray(values?.accounts) ? values.accounts.map((a) => ({ ...a })) : accountRowsFromFlat(v),
    liabilities: [],
    deductions: { itemized: '' },
    spending: { debtPayments: v.debtPayments, otherExpenses: v.otherExpenses, retirementLifestyle: v.retirementLifestyle },
    assumptions: {
      returnRate: v.returnRate,
      inflationRate: pick(v, 'inflationRate'),
      ageDeductions: pick(v, 'ageDeductions'),
      taxSavedBasis: pick(v, 'taxSavedBasis'),
      retirementRateShift: pick(v, 'retirementRateShift'),
      medicareIrmaa: pick(v, 'medicareIrmaa'),
    },
    calculators: {
      projection: { endAge: v.projEndAge, heirTaxRate: v.projHeirTaxRate, strategy: v.projStrategy },
      conversion: { amount: v.convAmount },
      pension: {
        lumpSum: v.penLumpSum,
        monthly: v.penMonthly,
        startAge: v.penStartAge,
        cola: v.penCola,
        survivorShare: v.penSurvivor,
        endAge: v.penEndAge,
        spouseEndAge: v.penSpouseEndAge,
      },
    },
  };
}

