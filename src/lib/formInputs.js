// Turns the form's raw string state into the numeric inputs compare.js expects.
// Lives outside React so it can be unit-tested.

// "$1,234.50" -> 1234.5; "" -> NaN; "abc" -> NaN
export function parseNumber(text) {
  if (typeof text === 'number') return text;
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (cleaned === '') return NaN;
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(cleaned) ? Number(cleaned) : NaN;
}

// A blank optional dollar field means "none".
const blankAsZero = (text) => (String(text ?? '').trim() === '' ? 0 : parseNumber(text));

export const DEFAULT_FORM_VALUES = {
  grossIncome: '100000',
  incomeType: 'w2', // 'w2' | '1099' | 'both'
  selfEmploymentIncome: '', // the 1099 part, used when incomeType is 'both'
  filingStatus: 'single',
  currentAge: '35',
  retirementAge: '65',
  debtPayments: '6000',
  otherExpenses: '0',
  savings: '10000',
  currentType: 'pretax',
  accountType: '401k',
  knowsSocialSecurity: 'no', // 'yes' | 'no'
  socialSecurityBenefit: '',
  returnRate: '0.07',
  retirementLifestyle: '1', // retirement spending vs. today (1 = same)
  otherPretaxBalance: '100000',
  otherRothBalance: '0',
  otherTaxableBalance: '0',
};

// How much of the gross income is 1099 (self-employment) income.
function selfEmploymentAmount(values, grossIncome) {
  if (values.incomeType === '1099') return Number.isFinite(grossIncome) ? grossIncome : 0;
  if (values.incomeType === 'both') return blankAsZero(values.selfEmploymentIncome);
  return 0;
}

export function toCompareInputs(values, year) {
  const grossIncome = parseNumber(values.grossIncome);
  return {
    grossIncome,
    selfEmploymentIncome: selfEmploymentAmount(values, grossIncome),
    filingStatus: values.filingStatus,
    currentAge: parseNumber(values.currentAge),
    retirementAge: parseNumber(values.retirementAge),
    debtPayments: blankAsZero(values.debtPayments),
    otherExpenses: blankAsZero(values.otherExpenses),
    savings: blankAsZero(values.savings),
    currentType: values.currentType,
    accountType: values.accountType,
    knowsSocialSecurity: values.knowsSocialSecurity === 'yes',
    socialSecurityBenefit: parseNumber(values.socialSecurityBenefit),
    returnRate: Number(values.returnRate),
    retirementLifestyle: Number(values.retirementLifestyle),
    otherPretaxBalance: blankAsZero(values.otherPretaxBalance),
    otherRothBalance: blankAsZero(values.otherRothBalance),
    otherTaxableBalance: blankAsZero(values.otherTaxableBalance),
    year,
  };
}
