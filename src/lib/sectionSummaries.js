// One-line summaries for the collapsible sections: each input section's header shows its
// current values, and each results card's header shows its headline number, so the whole
// scenario can be read with every section closed. Pure: form values / compare.js result in,
// strings out. No new financial logic.
import { ACCOUNT_TYPES } from './constants.js';
import { formatCurrency, formatPercent } from './format.js';
import { parseNumber } from './formInputs.js';

const money = (text) => formatCurrency(String(text ?? '').trim() === '' ? 0 : parseNumber(text));
const amount = (text) => {
  const n = parseNumber(text);
  return Number.isFinite(n) ? n : 0;
};

const INCOME_TYPE_SHORT = { w2: 'W-2', 1099: '1099', both: 'W-2 + 1099' };
const FILING_SHORT = { single: 'Single', mfj: 'Married filing jointly' };

function lifestyleShort(value) {
  const f = Number(value);
  if (!Number.isFinite(f) || f === 1) return null;
  return `${Math.round(Math.abs(f - 1) * 100)}% ${f > 1 ? 'higher' : 'lower'} retirement lifestyle`;
}

// The input sections, in form order. `fields` = the form-value keys each one holds (used to
// flag a section whose inputs differ in "Compare a change"); every form value is in exactly one.
export const INPUT_SECTIONS = [
  {
    id: 'about',
    title: 'About you',
    fields: ['grossIncome', 'incomeType', 'selfEmploymentIncome', 'filingStatus', 'currentAge', 'retirementAge', 'retirementLifestyle'],
    summary: (v) =>
      [
        `${money(v.grossIncome)} ${INCOME_TYPE_SHORT[v.incomeType] ?? ''}`.trim(),
        FILING_SHORT[v.filingStatus] ?? v.filingStatus,
        `age ${v.currentAge || '—'}, retiring at ${v.retirementAge || '—'}`,
        lifestyleShort(v.retirementLifestyle),
      ]
        .filter(Boolean)
        .join(' · '),
  },
  {
    id: 'costs',
    title: 'Costs that end before retirement',
    fields: ['debtPayments', 'otherExpenses'],
    summary: (v) => {
      const parts = [
        amount(v.debtPayments) > 0 && `${money(v.debtPayments)} debt`,
        amount(v.otherExpenses) > 0 && `${money(v.otherExpenses)} other`,
      ].filter(Boolean);
      return parts.length ? `${parts.join(' + ')} a year` : 'None';
    },
  },
  {
    id: 'contributions',
    title: 'Future Contributions',
    fields: ['savings', 'currentType', 'accountType'],
    summary: (v) =>
      `${money(v.savings)} a year · ${v.currentType === 'roth' ? 'Roth' : 'Pre-tax'} · ${ACCOUNT_TYPES[v.accountType] ?? v.accountType}`,
  },
  {
    id: 'socialSecurity',
    title: 'Social Security',
    fields: ['knowsSocialSecurity', 'socialSecurityBenefit'],
    summary: (v) => (v.knowsSocialSecurity === 'yes' ? `${money(v.socialSecurityBenefit)} a year (entered)` : 'Estimated from your income'),
  },
  {
    id: 'existing',
    title: 'Existing Accounts',
    fields: ['otherPretaxBalance', 'otherRothBalance', 'otherTaxableBalance', 'otherTaxableBasis'],
    summary: (v) => {
      const parts = [
        amount(v.otherPretaxBalance) > 0 && `Pre-tax ${money(v.otherPretaxBalance)}`,
        amount(v.otherRothBalance) > 0 && `Roth ${money(v.otherRothBalance)}`,
        amount(v.otherTaxableBalance) > 0 &&
          `Taxable ${money(v.otherTaxableBalance)} (${formatPercent(Number(v.otherTaxableBasis), 0)} basis)`,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'None';
    },
  },
  {
    id: 'assumptions',
    title: 'Assumptions',
    fields: ['returnRate'],
    summary: (v) => `${formatPercent(Number(v.returnRate), 0)} expected annual return`,
  },
];

// True when any input in the section differs from `baseValues` (compare mode).
export function sectionChanged(section, values, baseValues) {
  return Boolean(baseValues) && section.fields.some((key) => baseValues[key] !== values[key]);
}

const LEAN_SHORT = { pretax: 'tends to favor Pre-tax', roth: 'tends to favor Roth', even: 'about even' };
const WINNER_NAME = { roth: 'Roth', pretax: 'Pre-tax' };

// The headline shown on each results card's header, keyed by card id.
export function resultHeadlines(result) {
  const { retirementNeed, rates, comparison, portfolio } = result;
  return {
    need: `${formatCurrency(retirementNeed.target)} a year after tax`,
    rates: `${formatPercent(rates.marginalNow)} now vs. ${formatPercent(rates.effectiveRetirement)} in retirement · ${LEAN_SHORT[rates.lean]}`,
    tradeoff:
      comparison.winner === 'even'
        ? 'About even'
        : `${WINNER_NAME[comparison.winner]} ahead by ${formatCurrency(comparison.afterTaxIncomeDifference)} a year after tax`,
    portfolio: `Tax a year: All-Roth ${formatCurrency(portfolio.roth.totalTaxPaid)} vs. All-Pre-tax ${formatCurrency(portfolio.pretax.totalTaxPaid)}`,
  };
}
