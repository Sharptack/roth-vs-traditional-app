// The version 2 household's inputs (round 2 phase 0, step b), as data: the sections of the inputs
// page, each with a one-line summary for its closed header, the labels of the row lists, and the
// inputs each calculator reads (its inputs card shows only those). Pure; the component is
// src/next/HouseholdInputs.jsx; the values are householdValues.js's.
import { formatCurrency } from './format.js';
import { parseNumber } from './formInputs.js';
import { INCOME_TYPES, activePeople, hasSpouseV2 } from './householdValues.js';
import { STRATEGIES } from './strategies.js';

export const ACCOUNT_TYPE_LABELS = { pretax: 'Pre-tax', roth: 'Roth', taxable: 'Taxable' };
export const OWNER_LABELS = { p1: 'You', p2: 'Spouse' };
export const INCOME_TYPE_LABELS = {
  w2: 'W-2 wages',
  1099: '1099 (self-employed)',
  other: 'Other',
  interest: 'Interest, non-qualified dividends, short-term gains',
  qualified: 'Qualified dividends, long-term gains',
  socialSecurity: 'Social Security already received',
};
// The short form, for summaries.
const INCOME_SHORT = { w2: 'W-2', 1099: '1099', other: 'Other', interest: 'Interest', qualified: 'Qualified', socialSecurity: 'Social Security' };
// The types every income row offers; the rest come from "Add other income types".
export const BASIC_INCOME_TYPES = ['w2', '1099', 'other'];
export const OTHER_INCOME_TYPES = ['interest', 'qualified', 'socialSecurity'];
export const INCOME_TREATMENT_LABELS = { ordinary: 'Ordinary income', taxExempt: 'Tax-exempt' };
export const CONTRIBUTION_TAX_LABELS = { pretax: 'Pre-tax', roth: 'Roth', taxable: 'Taxable' };
export const CONTRIBUTION_ACCOUNT_LABELS = { '401k': '401(k)', ira: 'IRA' };
export const LIABILITY_KIND_LABELS = {
  mortgage: 'Mortgage',
  car: 'Car loan',
  student: 'Student loan',
  creditCard: 'Credit card',
  other: 'Other debt',
};

const blankIsZero = (text) => (String(text ?? '').trim() === '' ? 0 : parseNumber(text));
const money = (text) => {
  const n = parseNumber(text);
  return Number.isFinite(n) ? formatCurrency(n) : '—';
};
const pct = (text) => `${Math.round(Number(text ?? 0) * 1000) / 10}%`;

// Rows that count: the spouse's only while a spouse is included.
function countedRows(values, list) {
  const ids = new Set(activePeople(values).map((p) => p.id));
  return values[list].filter((r) => ids.has(r.owner));
}

// "W-2 $100,000 · 1099 $20,000": totals by kind, in the order of `order` (an object's keys would
// put '1099' first).
function totalsBy(rows, keyOf, amountOf, labels, order = Object.keys(labels)) {
  const totals = new Map();
  for (const r of rows) totals.set(keyOf(r), (totals.get(keyOf(r)) ?? 0) + (blankIsZero(amountOf(r)) || 0));
  const parts = order
    .filter((k) => totals.get(k) > 0)
    .map((k) => `${labels[k]} ${formatCurrency(totals.get(k))}`);
  return parts.length > 0 ? parts.join(' · ') : 'None';
}

// Totals by type, for the Existing Accounts summary: "Pre-tax $100,000 · Roth $20,000".
export function accountsSummary(accounts) {
  return totalsBy(accounts ?? [], (a) => a.type, (a) => a.balance, ACCOUNT_TYPE_LABELS);
}

function personLine(p) {
  return `${OWNER_LABELS[p.id]} ${p.age || '—'}, retires at ${p.retirementAge || '—'}`;
}

export const INPUT_SECTIONS = [
  {
    id: 'household',
    title: 'Household',
    summary: (v) =>
      v.filingStatus === 'mfj'
        ? hasSpouseV2(v)
          ? 'Married filing jointly · two people'
          : 'Married filing jointly · one combined income'
        : 'Single',
  },
  { id: 'people', title: 'People', summary: (v) => activePeople(v).map(personLine).join(' · ') },
  {
    id: 'income',
    title: 'Income',
    summary: (v) => totalsBy(countedRows(v, 'incomes'), (r) => r.type, (r) => r.amount, INCOME_SHORT, INCOME_TYPES),
  },
  {
    id: 'contributions',
    title: 'Future Contributions',
    summary: (v) => {
      const rows = countedRows(v, 'contributions');
      const total = rows.reduce((a, r) => a + blankIsZero(r.amount), 0);
      if (rows.length === 0) return 'None';
      const kinds = new Set(rows.map((r) => (r.tax === 'taxable' ? 'taxable' : `${r.tax}|${r.account}`)));
      if (kinds.size === 1) {
        const r = rows[0];
        const kind = r.tax === 'taxable' ? 'Taxable' : `${CONTRIBUTION_TAX_LABELS[r.tax]} · ${CONTRIBUTION_ACCOUNT_LABELS[r.account]}`;
        return `${Number.isFinite(total) ? formatCurrency(total) : '—'} a year · ${kind}`;
      }
      return `${totalsBy(rows, (r) => r.tax, (r) => r.amount, CONTRIBUTION_TAX_LABELS)} a year`;
    },
  },
  { id: 'accounts', title: 'Existing Accounts', summary: (v) => accountsSummary(v.accounts) },
  {
    id: 'liabilities',
    title: 'Liabilities',
    summary: (v) => {
      const rows = v.liabilities;
      if (rows.length === 0) return 'None';
      const balance = rows.reduce((a, r) => a + (blankIsZero(r.balance) || 0), 0);
      const payment = rows.reduce((a, r) => a + (blankIsZero(r.payment) || 0), 0);
      const what = rows.length === 1 ? LIABILITY_KIND_LABELS[rows[0].kind] : `${rows.length} debts`;
      return `${what} · ${formatCurrency(balance)} · ${formatCurrency(payment)} a month`;
    },
  },
  {
    id: 'spending',
    title: 'Spending',
    summary: (v) => {
      const ending = (blankIsZero(v.spending.debtPayments) || 0) + (blankIsZero(v.spending.otherExpenses) || 0);
      const change = Math.round((Number(v.spending.retirementLifestyle) - 1) * 100);
      const retired = change === 0 ? 'same as today' : `${Math.abs(change)}% ${change > 0 ? 'higher' : 'lower'}`;
      return [ending > 0 && `${formatCurrency(ending)} a year ends at retirement`, `retirement spending ${retired}`]
        .filter(Boolean)
        .join(' · ')
        .replace(/^r/, 'R');
    },
  },
  {
    id: 'assumptions',
    title: 'Assumptions',
    summary: (v) => {
      const a = v.assumptions;
      const shift = Number(a.retirementRateShift);
      return [
        `${Math.round(Number(a.returnRate) * 100)}% return after inflation`,
        `${pct(a.inflationRate)} inflation`,
        shift ? `rates ${shift > 0 ? '+' : '−'}${Math.abs(Math.round(shift * 100))} pts in retirement` : null,
        a.medicareIrmaa === 'no' ? 'no IRMAA' : null,
      ]
        .filter(Boolean)
        .join(' · ');
    },
  },
  {
    id: 'projection',
    title: 'Projection',
    summary: (v) => {
      const p = v.calculators.projection;
      const strategy = (STRATEGIES.find((s) => s.id === p.strategy) ?? STRATEGIES[0]).label.toLowerCase();
      return `To age ${p.endAge || '—'} · heirs taxed at ${Math.round(Number(p.heirTaxRate ?? 0) * 100)}% · ${strategy}`;
    },
  },
  { id: 'conversion', title: 'Conversion', summary: (v) => `Convert ${money(v.calculators.conversion.amount)} this year` },
  {
    id: 'pension',
    title: 'Pension offer',
    summary: (v) => {
      const p = v.calculators.pension;
      return `${money(p.lumpSum)} or ${money(p.monthly)} a month from ${p.startAge || '—'}`;
    },
  },
];

// Every section, in the inputs page's order.
export const ALL_SECTION_IDS = INPUT_SECTIONS.map((s) => s.id);

// A person's fields, in groups (a calculator's card can show some of them).
export const PERSON_FIELDS = ['age', 'sex', 'retirementAge', 'planToAge', 'socialSecurity'];
export const ASSUMPTION_FIELDS = ['returnRate', 'inflationRate', 'ageDeductions', 'medicareIrmaa', 'retirementRateShift', 'taxSavedBasis'];

// The inputs each calculator reads: its sections (its own first), and for People and Assumptions
// the fields it reads (all of them when not listed). Sex and plan-to age are read by no calculator
// yet (phase 2), so they are on the inputs page only.
const FOR_ROTH = ['age', 'retirementAge', 'socialSecurity'];
export const CALCULATOR_INPUTS = {
  roth: {
    sections: ['contributions', 'household', 'people', 'income', 'accounts', 'spending', 'assumptions', 'projection'],
    fields: { people: FOR_ROTH },
  },
  tax: {
    sections: ['income', 'household', 'people', 'contributions', 'assumptions'],
    fields: { people: ['age'], assumptions: ['medicareIrmaa'] },
  },
  projection: {
    sections: ['projection', 'household', 'people', 'income', 'contributions', 'accounts', 'spending', 'assumptions'],
    fields: { people: FOR_ROTH },
  },
  conversion: {
    sections: ['conversion', 'household', 'people', 'income', 'contributions', 'accounts', 'assumptions'],
    fields: { people: ['age'], assumptions: ['medicareIrmaa'] },
  },
  pension: {
    sections: ['pension', 'household', 'people', 'assumptions'],
    fields: { people: ['age'], assumptions: ['returnRate', 'inflationRate'] },
  },
};

// The sections to show, in the order given (unknown ids are skipped).
export function inputSections(ids = ALL_SECTION_IDS) {
  return ids.map((id) => INPUT_SECTIONS.find((s) => s.id === id)).filter(Boolean);
}
