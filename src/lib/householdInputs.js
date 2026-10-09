// The version 2 household's inputs (round 2 phase 0, step b; regrouped 2026-10-08), as data: the
// sections, each with a one-line summary for its closed header, the inputs page's four groups, the
// labels of the row lists, and the inputs each calculator reads (its inputs card shows only those).
// Pure; the component is src/next/HouseholdInputs.jsx; the values are householdValues.js's.
import { formatCurrency } from './format.js';
import { parseNumber } from './formInputs.js';
import { activePeople, hasSpouseV2 } from './householdValues.js';
import { STRATEGIES } from './strategies.js';

export const ACCOUNT_TYPE_LABELS = { pretax: 'Pre-tax', roth: 'Roth', taxable: 'Taxable' };
export const OWNER_LABELS = { p1: 'You', p2: 'Spouse' };
export const INCOME_TYPE_LABELS = {
  w2: 'W-2 wages',
  1099: '1099 (self-employed)',
  socialSecurity: 'Social Security',
  pension: 'Pension',
  other: 'Other',
};
// The kinds of "Other" income.
export const OTHER_KIND_LABELS = {
  ordinary: 'Taxable as ordinary income',
  taxExempt: 'Tax-exempt',
  interest: 'Interest, non-qualified dividends, short-term gains',
  qualified: 'Qualified dividends, long-term gains',
};
export const INCOME_TREATMENT_LABELS = OTHER_KIND_LABELS;
// The short forms, for summaries.
const ANNUAL_SHORT = { w2: 'W-2', 1099: '1099' };
const OTHER_SHORT = { ordinary: 'Other', taxExempt: 'Tax-exempt', interest: 'Interest', qualified: 'Qualified' };
// Income typed as a yearly amount; Social Security and pensions are monthly.
export const MONTHLY_INCOME_TYPES = ['socialSecurity', 'pension'];
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
  // A retirement age at or below the age now: already retired (decided 2026-10-09).
  const retired = Number(p.age) > 0 && Number(p.retirementAge) > 0 && Number(p.retirementAge) <= Number(p.age);
  return `${OWNER_LABELS[p.id]} ${p.age || '—'}, ${retired ? 'retired' : 'retires'} at ${p.retirementAge || '—'}, plans to ${p.planToAge || '—'}`;
}

// The income summary: yearly amounts by kind, then each person's Social Security and pensions.
function incomeSummary(v) {
  const rows = countedRows(v, 'incomes');
  const annual = totalsBy(
    rows.filter((r) => !MONTHLY_INCOME_TYPES.includes(r.type)),
    (r) => (r.type === 'other' ? `other:${r.treatment}` : r.type),
    (r) => r.amount,
    { ...ANNUAL_SHORT, ...Object.fromEntries(Object.entries(OTHER_SHORT).map(([k, l]) => [`other:${k}`, l])) },
    ['w2', '1099', ...Object.keys(OTHER_SHORT).map((k) => `other:${k}`)], // ('1099' would sort first)
  );
  const two = hasSpouseV2(v);
  const whose = (r) => (two ? `${r.owner === 'p1' ? 'your' : "spouse's"} ` : '');
  const ss = rows
    .filter((r) => r.type === 'socialSecurity')
    .map((r) => `${two ? (r.owner === 'p1' ? 'Your' : "Spouse's") + ' ' : ''}Social Security ${r.ssMode === 'pia' ? `${money(r.amount)}/mo PIA` : r.ssMode === 'receiving' ? `${money(r.amount)}/mo received` : 'estimated'}`);
  const pensions = rows
    .filter((r) => r.type === 'pension')
    .map((r) => (r.election === 'lumpSum' ? `${whose(r)}pension taken as a ${money(r.lumpSum)} lump sum` : `${whose(r)}pension ${money(r.amount)}/mo from ${r.fromAge || '—'}`));
  const parts = [annual === 'None' ? null : annual, ...ss, ...pensions].filter(Boolean);
  return parts.length > 0 ? parts.map((s) => s.replace(/^[a-z]/, (c) => c.toUpperCase())).join(' · ') : 'None';
}

// One income row, closed (decided 2026-10-09): its type and amount, and whose with a spouse.
//   "W-2 wages · $100,000 a year", "Pension · $1,800 a month from 65 · Spouse"
export function incomeRowSummary(r, withOwner = false) {
  const type = r.type === 'other' ? `Other: ${OTHER_KIND_LABELS[r.treatment] ?? ''}` : INCOME_TYPE_LABELS[r.type];
  let amount;
  if (r.type === 'socialSecurity') amount = r.ssMode === 'pia' ? `${money(r.amount)} per month at full retirement age` : r.ssMode === 'receiving' ? `${money(r.amount)} per month, received now` : 'estimated from earnings';
  else if (r.type === 'pension' && r.election === 'lumpSum') amount = `${money(r.lumpSum)} lump sum, rolled over at ${String(r.fromAge ?? '').trim() || '—'}`;
  else if (r.type === 'pension') amount = `${money(r.amount)} per month${String(r.fromAge ?? '').trim() ? ` from ${r.fromAge}` : ''}`;
  else amount = String(r.amount ?? '').trim() === '' ? 'no amount yet' : `${money(r.amount)} per year`;
  const from = String(r.fromAge ?? '').trim();
  const to = String(r.toAge ?? '').trim();
  const ages = MONTHLY_INCOME_TYPES.includes(r.type) ? null : [from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(' ');
  return [type, amount, ages, withOwner ? OWNER_LABELS[r.owner] : null].filter(Boolean).join(' · ');
}

// One account row, closed (decided 2026-10-09, like income rows): its type and balance, a taxable
// account's cost basis, and whose with a spouse. "Taxable · $50,000 · 50% basis · Spouse"
export function accountRowSummary(a, withOwner = false) {
  const balance = String(a.balance ?? '').trim() === '' ? 'no balance yet' : money(a.balance);
  const basis = a.type === 'taxable' && String(a.basisShare ?? '').trim() !== '' ? `${Math.round(Number(a.basisShare) * 100)}% basis` : null;
  return [ACCOUNT_TYPE_LABELS[a.type], balance, basis, withOwner ? OWNER_LABELS[a.owner] : null].filter(Boolean).join(' · ');
}

export const INPUT_SECTIONS = [
  {
    id: 'household',
    title: 'Household',
    summary: (v) => {
      const status = v.filingStatus === 'mfj' ? (hasSpouseV2(v) ? 'Married filing jointly' : 'Married filing jointly, one combined income') : 'Single';
      return [status, ...activePeople(v).map(personLine)].join(' · ');
    },
  },
  {
    id: 'dependents',
    title: 'Children and dependents',
    summary: (v) => {
      const rows = v.dependents ?? [];
      const kids = rows.filter((d) => d.kind === 'child');
      const others = rows.length - kids.length;
      const parts = [
        kids.length > 0 && `${kids.length} ${kids.length === 1 ? 'child' : 'children'} (${kids.length === 1 ? 'age' : 'ages'} ${kids.map((k) => k.age || '—').join(', ')})`,
        others > 0 && `${others} other ${others === 1 ? 'dependent' : 'dependents'}`,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : 'None';
    },
  },
  { id: 'income', title: 'Income', summary: incomeSummary },
  {
    id: 'contributions',
    title: 'Contributions',
    summary: (v) => {
      const rows = countedRows(v, 'contributions');
      const total = rows.reduce((a, r) => a + blankIsZero(r.amount), 0);
      if (rows.length === 0) return 'None';
      // "· employer match" / "· employer $5,000" when a 401(k) row has one
      const employerRows = rows.filter((r) => r.tax !== 'taxable' && r.account === '401k' && (r.employer === 'match' || r.employer === 'flat'));
      const employer =
        employerRows.length === 0
          ? ''
          : employerRows.every((r) => r.employer === 'flat')
            ? ` · employer ${formatCurrency(employerRows.reduce((a, r) => a + blankIsZero(r.employerAmount), 0))}`
            : ' · employer match';
      const kinds = new Set(rows.map((r) => (r.tax === 'taxable' ? 'taxable' : `${r.tax}|${r.account}`)));
      if (kinds.size === 1) {
        const r = rows[0];
        const kind = r.tax === 'taxable' ? 'Taxable' : `${CONTRIBUTION_TAX_LABELS[r.tax]} · ${CONTRIBUTION_ACCOUNT_LABELS[r.account]}`;
        return `${Number.isFinite(total) ? formatCurrency(total) : '—'} per year · ${kind}${employer}`;
      }
      return `${totalsBy(rows, (r) => r.tax, (r) => r.amount, CONTRIBUTION_TAX_LABELS)} per year${employer}`;
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
      return `${what} · ${formatCurrency(balance)} · ${formatCurrency(payment)} per month`;
    },
  },
  {
    id: 'deductions',
    title: 'Deductions',
    summary: (v) => {
      const itemized = blankIsZero(v.deductions?.itemized);
      return itemized > 0 ? `Itemized ${formatCurrency(itemized)} per year, when more than the standard deduction` : 'The standard deduction';
    },
  },
  {
    id: 'spending',
    title: 'Spending',
    summary: (v) => {
      const ending = (blankIsZero(v.spending.debtPayments) || 0) + (blankIsZero(v.spending.otherExpenses) || 0);
      const change = Math.round((Number(v.spending.retirementLifestyle) - 1) * 100);
      const retired = change === 0 ? 'same as today' : `${Math.abs(change)}% ${change > 0 ? 'higher' : 'lower'}`;
      return [ending > 0 && `${formatCurrency(ending)} per year ends at retirement`, `retirement spending ${retired}`]
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
        a.retirementReturnRate === 'same' || a.retirementReturnRate === undefined || Number(a.retirementReturnRate) === Number(a.returnRate)
          ? `${Math.round(Number(a.returnRate) * 100)}% return after inflation`
          : `${Math.round(Number(a.returnRate) * 100)}% return after inflation, ${Math.round(Number(a.retirementReturnRate) * 100)}% in retirement`,
        `${pct(a.inflationRate)} inflation`,
        shift ? `rates ${shift > 0 ? '+' : '−'}${Math.abs(Math.round(shift * 100))} pts in retirement` : null,
        a.medicareIrmaa === 'no' ? 'no IRMAA' : null,
        a.surplus === 'spend' ? 'surplus spent' : null,
        hasSpouseV2(v) ? `survivor spends ${Math.round(Number(a.survivorSpending) * 100)}%` : null,
        // dividends only when not the default 1.3%
        a.dividendYield === '0.013' ? null : Number(a.dividendYield) > 0 ? `${pct(a.dividendYield)} dividends` : 'no dividends',
        `${strategyLabel(v).toLowerCase()} in retirement`,
        `heirs taxed at ${Math.round(Number(v.calculators.projection.heirTaxRate ?? 0) * 100)}%`,
      ]
        .filter(Boolean)
        .join(' · ');
    },
  },
  // Calculator cards only (on the inputs page these are under Assumptions; a conversion is the
  // conversion calculator's what-if; the lump-sum offer belongs to the pension calculator).
  {
    id: 'projection',
    title: 'Withdrawals',
    summary: (v) => `${strategyLabel(v)} · heirs taxed at ${Math.round(Number(v.calculators.projection.heirTaxRate ?? 0) * 100)}%`,
  },
  { id: 'conversion', title: 'Conversion', summary: (v) => `Convert ${money(v.calculators.conversion.amount)} this year` },
  {
    id: 'pension',
    title: 'Pension offer',
    summary: (v) => {
      const p = countedRows(v, 'incomes').find((r) => r.type === 'pension');
      if (!p) return 'No pension yet';
      const lump = String(p.lumpSum ?? '').trim() ? p.lumpSum : v.calculators.pension.lumpSum;
      return `${money(lump)} or ${money(p.amount)} per month from ${p.fromAge || '—'} · the plan takes the ${p.election === 'lumpSum' ? 'lump sum' : 'monthly payments'}`;
    },
  },
];

const strategyLabel = (v) => (STRATEGIES.find((s) => s.id === v.calculators.projection.strategy) ?? STRATEGIES[0]).label;

// The inputs page: four groups, each holding its sections (decided 2026-10-08).
export const INPUT_GROUPS = [
  { id: 'household', title: 'Household', sections: ['household', 'dependents'] },
  { id: 'income', title: 'Income and expenses', sections: ['income', 'contributions', 'spending', 'deductions'] },
  { id: 'assets', title: 'Assets and liabilities', sections: ['accounts', 'liabilities'] },
  { id: 'assumptions', title: 'Assumptions', sections: ['assumptions'] },
];

// Every section of the inputs page, in its order.
export const ALL_SECTION_IDS = INPUT_GROUPS.flatMap((g) => g.sections);

// A person's fields, and the assumptions (a calculator's card can show some of them). The
// withdrawal strategy and heirs' tax rate are the projection's (calculators.projection).
export const PERSON_FIELDS = ['age', 'sex', 'retirementAge', 'planToAge'];
export const ASSUMPTION_FIELDS = ['returnRate', 'retirementReturnRate', 'inflationRate', 'ageDeductions', 'medicareIrmaa', 'retirementRateShift', 'taxSavedBasis', 'survivorSpending', 'dividendYield', 'surplus', 'strategy', 'heirTaxRate'];
const WITHOUT_PROJECTION = ASSUMPTION_FIELDS.filter((f) => f !== 'strategy' && f !== 'heirTaxRate');

// The inputs each calculator reads: its sections (its own first), for the household and the
// assumptions the fields it reads (all of them when not listed), and section titles of its own.
// Sex is read only by the pension calculator (the plan runs to each person's plan-to age).
const FOR_PLAN = ['age', 'retirementAge', 'planToAge'];
export const CALCULATOR_INPUTS = {
  roth: {
    sections: ['contributions', 'household', 'dependents', 'income', 'deductions', 'accounts', 'spending', 'assumptions'],
    fields: { people: FOR_PLAN },
    // The Roth page keeps its Future Contributions / Existing Accounts pair (Michael, 2026-10-08).
    titles: { contributions: 'Future Contributions' },
  },
  tax: {
    sections: ['income', 'household', 'dependents', 'contributions', 'deductions', 'assumptions'],
    fields: { people: ['age'], assumptions: ['medicareIrmaa'] },
  },
  projection: {
    sections: ['projection', 'household', 'dependents', 'income', 'contributions', 'deductions', 'accounts', 'spending', 'assumptions'],
    fields: { people: FOR_PLAN, assumptions: WITHOUT_PROJECTION },
  },
  conversion: {
    sections: ['conversion', 'household', 'dependents', 'income', 'contributions', 'deductions', 'accounts', 'assumptions'],
    fields: { people: ['age'], assumptions: ['medicareIrmaa'] },
  },
  pension: {
    sections: ['pension', 'household', 'assumptions'],
    fields: { people: ['age', 'sex'], assumptions: ['retirementReturnRate', 'returnRate', 'inflationRate'] },
  },
};

// The sections to show, in the order given (unknown ids are skipped).
export function inputSections(ids = ALL_SECTION_IDS) {
  return ids.map((id) => INPUT_SECTIONS.find((s) => s.id === id)).filter(Boolean);
}

// The values each section edits, to tell whether a section differs between two households (the
// Roth page's "Compare a change" marks the sections the change touches).
const SECTION_DATA = {
  household: (v) => [v.filingStatus, v.includeSpouse, v.people],
  dependents: (v) => v.dependents ?? [],
  income: (v) => v.incomes,
  contributions: (v) => v.contributions,
  accounts: (v) => v.accounts,
  liabilities: (v) => v.liabilities,
  deductions: (v) => v.deductions,
  spending: (v) => v.spending,
  assumptions: (v) => [v.assumptions, v.calculators.projection],
  projection: (v) => v.calculators.projection,
  conversion: (v) => v.calculators.conversion,
  pension: (v) => [v.calculators.pension, v.incomes.filter((r) => r.type === 'pension')],
};

export function sectionChanged(id, a, b) {
  const pick = SECTION_DATA[id];
  return Boolean(pick) && JSON.stringify(pick(a)) !== JSON.stringify(pick(b));
}
