// The preview's household input form (roadmap phase 1, step 7), as data: its sections, each
// with a one-line summary for the closed header, and the Existing Accounts list helpers.
// Pure; the component is src/next/HouseholdForm.jsx. Form values are strings, as in
// formInputs.js; the accounts list is an array of string rows:
//   values.accounts = [{ id, owner: 'p1' | 'p2', type: 'pretax' | 'roth' | 'taxable', balance, basisShare }]
import { formatCurrency } from './format.js';
import { parseNumber } from './formInputs.js';
import { hasSpouse } from './household.js';
import { STRATEGIES } from './strategies.js';

export { accountRowsFromFlat } from './household.js';

import { ACCOUNT_TYPE_LABELS, accountsSummary } from './householdInputs.js';

export { ACCOUNT_TYPE_LABELS, accountsSummary };

const money = (text) => {
  const n = parseNumber(text);
  return Number.isFinite(n) ? formatCurrency(n) : '—';
};
const blankIsZero = (text) => (String(text ?? '').trim() === '' ? 0 : parseNumber(text));

// A new, empty row with an id no other row has.
export function newAccountRow(accounts) {
  const used = new Set(accounts.map((a) => a.id));
  let n = accounts.length + 1;
  while (used.has(`a${n}`)) n += 1;
  return { id: `a${n}`, owner: 'p1', type: 'pretax', balance: '', basisShare: '0.5' };
}

function personSummary(income, incomeType, age, retirementAge) {
  const type = incomeType === '1099' ? ' (1099)' : incomeType === 'both' ? ' (W-2 + 1099)' : '';
  return `${money(income)}${type} · age ${age || '—'}, retires at ${retirementAge || '—'}`;
}

export const HOUSEHOLD_SECTIONS = [
  {
    id: 'household',
    title: 'Household',
    summary: (v) =>
      v.filingStatus === 'mfj' ? (hasSpouse(v) ? 'Married filing jointly · two people' : 'Married filing jointly · one combined income') : 'Single',
  },
  {
    id: 'you',
    title: 'You',
    summary: (v) => personSummary(v.grossIncome, v.incomeType, v.currentAge, v.retirementAge),
  },
  {
    id: 'spouse',
    title: 'Spouse',
    onlyWithSpouse: true,
    summary: (v) => personSummary(v.spouseIncome, v.spouseIncomeType, v.spouseAge, v.spouseRetirementAge),
  },
  {
    id: 'costs',
    title: 'Costs that end before retirement',
    summary: (v) => {
      const debt = blankIsZero(v.debtPayments);
      const other = blankIsZero(v.otherExpenses);
      if (!(debt > 0) && !(other > 0)) return 'None';
      return [debt > 0 && `${formatCurrency(debt)} debt`, other > 0 && `${formatCurrency(other)} other`]
        .filter(Boolean)
        .join(' · ') + ' a year';
    },
  },
  {
    id: 'contributions',
    title: 'Future Contributions',
    calculator: 'roth', // the Roth calculator's own inputs (other calculators read them too)
    summary: (v) => {
      const total = blankIsZero(v.savings) + (hasSpouse(v) ? blankIsZero(v.spouseSavings) : 0);
      const type = v.currentType === 'roth' ? 'Roth' : 'Pre-tax';
      const account = v.accountType === 'ira' ? 'IRA' : '401(k)';
      return `${Number.isFinite(total) ? formatCurrency(total) : '—'} a year · ${type} · ${account}`;
    },
  },
  { id: 'existing', title: 'Existing Accounts', summary: (v) => accountsSummary(v.accounts) },
  {
    id: 'projection',
    title: 'Projection',
    calculator: 'projection', // the projection page's own inputs
    summary: (v) => `To age ${v.projEndAge || '—'} · heirs taxed at ${Math.round(Number(v.projHeirTaxRate ?? 0) * 100)}% · ${(STRATEGIES.find((s) => s.id === v.projStrategy) ?? STRATEGIES[0]).label.toLowerCase()}`,
  },
  {
    id: 'conversion',
    title: 'Conversion',
    calculator: 'conversion', // the Roth conversion calculator's own input
    summary: (v) => `Convert ${money(v.convAmount)} this year`,
  },
  {
    id: 'pension',
    title: 'Pension offer',
    calculator: 'pension', // the pension calculator's own inputs
    summary: (v) => `${money(v.penLumpSum)} or ${money(v.penMonthly)} a month from ${v.penStartAge || '—'}`,
  },
  {
    id: 'thisYear',
    title: "This year's other income",
    calculator: 'tax', // the tax calculator's own inputs
    summary: (v) => {
      const total = ['taxOrdinaryIncome', 'taxInvestmentIncome', 'taxPreferentialIncome', 'taxSocialSecurity']
        .map((k) => blankIsZero(v[k]))
        .reduce((a, b) => a + b, 0);
      return Number.isFinite(total) && total > 0 ? `${formatCurrency(total)} besides earnings` : 'None besides earnings';
    },
  },
  {
    id: 'assumptions',
    title: 'Assumptions',
    summary: (v) =>
      `${Math.round(Number(v.returnRate) * 100)}% return after inflation · ${Math.round(Number(v.inflationRate ?? 0) * 1000) / 10}% inflation${Number(v.retirementRateShift) ? ` · rates ${Number(v.retirementRateShift) > 0 ? '+' : '−'}${Math.abs(Math.round(Number(v.retirementRateShift) * 100))} pts in retirement` : ''}${v.medicareIrmaa === 'no' ? ' · no IRMAA' : ''}`,
  },
];

// The sections to show for these values (the Spouse section only when a spouse is entered).
//  only: section ids to show, in that order (default: every section that belongs to no calculator,
//        plus Future Contributions, which every calculator reads).
export function visibleSections(values, only = DEFAULT_SECTION_IDS) {
  return only
    .map((id) => HOUSEHOLD_SECTIONS.find((s) => s.id === id))
    .filter((s) => s && (!s.onlyWithSpouse || hasSpouse(values)));
}

// The shared household inputs (the homepage; under each calculator's own inputs).
export const SHARED_SECTION_IDS = ['household', 'you', 'spouse', 'costs', 'existing', 'assumptions'];
export const DEFAULT_SECTION_IDS = ['household', 'you', 'spouse', 'costs', 'contributions', 'existing', 'assumptions'];
