// Version 1 preview households (form values), one per kind of input, for round 2 phase 0:
// tests/householdV1Pins.test.js pins every calculator's results for them today, and the version 2
// conversion must reproduce those results. Between them they set every version 1 form field.
import { DEFAULT_FORM_VALUES } from '../../src/lib/formInputs.js';

// What the old calculator's "Clear all" left: every dollar amount $0, the ages blank, the choices at
// their defaults (a household saved that way must still open).
const CLEARED_FORM_VALUES = {
  ...DEFAULT_FORM_VALUES,
  grossIncome: '0',
  selfEmploymentIncome: '0',
  currentAge: '',
  retirementAge: '',
  debtPayments: '0',
  otherExpenses: '0',
  savings: '0',
  socialSecurityBenefit: '0',
  otherPretaxBalance: '0',
  otherRothBalance: '0',
  otherTaxableBalance: '0',
};
import { PREVIEW_DEFAULT_VALUES } from '../../src/lib/household.js';
import { householdValuesFromSearch } from '../../src/lib/householdLink.js';

const v1 = (overrides) => ({ ...PREVIEW_DEFAULT_VALUES, ...overrides });
const acc = (id, owner, type, balance, basisShare = '0.5') => ({ id, owner, type, balance, basisShare });

export const V1_HOUSEHOLDS = {
  // The preview's defaults: single, W-2, $100,000 Pre-tax.
  defaults: v1({}),

  // "Clear all": blank ages, every amount $0 (invalid: the errors are pinned).
  cleared: v1({ ...CLEARED_FORM_VALUES, accounts: [acc('a1', 'p1', 'pretax', '0')] }),

  // Single, 1099, a known benefit claimed at 67, over the IRS limit (a side account), Roth IRA,
  // every account type, and every assumption and calculator input moved off its default.
  singleEverything: v1({
    grossIncome: '240000',
    incomeType: '1099',
    currentAge: '52',
    retirementAge: '62',
    debtPayments: '12000',
    otherExpenses: '4000',
    savings: '30000',
    currentType: 'roth',
    accountType: 'ira',
    knowsSocialSecurity: 'yes',
    socialSecurityBenefit: '38000',
    claimAge: '67',
    returnRate: '0.05',
    retirementLifestyle: '0.8',
    accounts: [
      acc('a1', 'p1', 'pretax', '450000'),
      acc('a2', 'p1', 'roth', '60000'),
      acc('a3', 'p1', 'taxable', '120000', '0.7'),
    ],
    inflationRate: '0',
    ageDeductions: 'no',
    taxSavedBasis: 'marginal',
    retirementRateShift: '0.03',
    medicareIrmaa: 'no',
    taxOrdinaryIncome: '5000',
    taxInvestmentIncome: '3000',
    taxPreferentialIncome: '8000',
    taxSocialSecurity: '0',
    projEndAge: '100',
    projHeirTaxRate: '0.32',
    projStrategy: 'conventional',
    convAmount: '100000',
    penLumpSum: '500000',
    penMonthly: '2900',
    penStartAge: '62',
    penCola: '0.02',
    penSurvivor: '0',
    penEndAge: '92',
  }),

  // Single, W-2 and 1099 together, age 61 (the 60-63 catch-up), Pre-tax 401(k).
  singleBoth: v1({
    grossIncome: '180000',
    incomeType: 'both',
    selfEmploymentIncome: '40000',
    currentAge: '61',
    retirementAge: '66',
    savings: '35000',
    projStrategy: 'fill22',
  }),

  // Married filing jointly, no spouse entered: one combined income.
  mfjCombined: v1({
    filingStatus: 'mfj',
    grossIncome: '210000',
    currentAge: '45',
    retirementAge: '65',
    savings: '23000',
    accounts: [acc('a1', 'p1', 'pretax', '300000'), acc('a2', 'p1', 'roth', '50000')],
    projStrategy: 'convert12',
  }),

  // Married with a spouse: a W-2 earner and a 1099 spouse, estimated benefits (spousal top-up),
  // both saving under "same" types.
  mfjSpouse: v1({
    filingStatus: 'mfj',
    includeSpouse: 'yes',
    grossIncome: '160000',
    currentAge: '40',
    retirementAge: '65',
    savings: '20000',
    spouseAge: '38',
    spouseRetirementAge: '63',
    spouseIncome: '30000',
    spouseIncomeType: '1099',
    spouseSavings: '6000',
    accounts: [acc('a1', 'p1', 'pretax', '200000'), acc('a2', 'p2', 'pretax', '40000'), acc('a3', 'p2', 'roth', '15000')],
  }),

  // Married, older (65+ deductions, IRMAA, RMDs soon): known benefits and own claiming ages, the
  // spouse's own Roth IRA, several taxable accounts with different cost basis, Social Security
  // already received in the tax calculator, a 75% survivor pension.
  mfjOlderKnown: v1({
    filingStatus: 'mfj',
    includeSpouse: 'yes',
    grossIncome: '130000',
    currentAge: '62',
    retirementAge: '67',
    savings: '31000',
    knowsSocialSecurity: 'yes',
    socialSecurityBenefit: '36000',
    claimAge: '70',
    spouseAge: '66',
    spouseRetirementAge: '68',
    spouseIncome: '45000',
    spouseIncomeType: 'w2',
    spouseKnowsSocialSecurity: 'yes',
    spouseSocialSecurityBenefit: '14000',
    spouseClaimAge: '66',
    spouseSavings: '8000',
    spouseCurrentType: 'roth',
    spouseAccountType: 'ira',
    accounts: [
      acc('a1', 'p1', 'pretax', '900000'),
      acc('a2', 'p2', 'pretax', '250000'),
      acc('a3', 'p1', 'taxable', '200000', '0.4'),
      acc('a4', 'p2', 'taxable', '100000', '0.9'),
      acc('a5', 'p2', 'roth', '80000'),
    ],
    taxSocialSecurity: '14000',
    taxPreferentialIncome: '12000',
    projStrategy: 'convert22',
    penSurvivor: '0.75',
    penSpouseEndAge: '94',
    penStartAge: '67',
  }),

  // Married, one known benefit and one estimated (mixed), the spouse with no income; different
  // types only for the spouse's account.
  mfjMixedBenefits: v1({
    filingStatus: 'mfj',
    includeSpouse: 'yes',
    grossIncome: '250000',
    currentAge: '50',
    retirementAge: '64',
    savings: '24500',
    knowsSocialSecurity: 'yes',
    socialSecurityBenefit: '42000',
    spouseAge: '48',
    spouseRetirementAge: '60',
    spouseIncome: '0',
    spouseSavings: '0',
    spouseCurrentType: 'pretax',
    spouseAccountType: '401k',
    currentType: 'roth',
    projStrategy: 'fill12',
    penSurvivor: '1',
  }),

  // Spouse fields filled in but filing single: the spouse is ignored.
  spouseButSingle: v1({
    filingStatus: 'single',
    includeSpouse: 'yes',
    spouseIncome: '80000',
    spouseSavings: '10000',
    accounts: [acc('a1', 'p1', 'pretax', '100000'), acc('a2', 'p2', 'roth', '30000')],
  }),

  // Spouse taken out (includeSpouse 'no'): their account counts as person 1's.
  spouseRemoved: v1({
    filingStatus: 'mfj',
    includeSpouse: 'no',
    spouseIncome: '90000',
    accounts: [acc('a1', 'p1', 'pretax', '100000'), acc('a2', 'p2', 'taxable', '50000', '0.2')],
    projStrategy: 'convert24',
  }),

  // An old public-calculator link opened in the preview (three flat balances, no hh marker).
  oldPublicLink: householdValuesFromSearch(
    '?grossIncome=95000&filingStatus=mfj&currentAge=30&retirementAge=60&savings=12000&currentType=roth' +
      '&otherPretaxBalance=40000&otherRothBalance=10000&otherTaxableBalance=25000&otherTaxableBasis=0.6',
  ).values,
};
