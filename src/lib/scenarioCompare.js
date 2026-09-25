// Side-by-side comparison of two calculator runs: a pinned "baseline" and the
// current inputs. Pure: takes compare.js inputs/results, returns rows of
// numbers. Formatting of the deltas is left to the UI.
import { ACCOUNT_TYPES, CONTRIBUTION_TYPES, FILING_STATUSES } from './constants.js';
import { formatCurrency, formatPercent } from './format.js';
import { effectiveRateSteps, rateDriverRows } from './rateSteps.js';

const lifestyleText = (f) =>
  f === 1 ? 'Same as today' : `${Math.round(Math.abs(f - 1) * 100)}% ${f > 1 ? 'higher' : 'lower'} than today`;

// Every input the calculator takes, with how to name and show it. The Social
// Security pair (knows it? + amount) reads as one input.
const INPUT_FIELDS = [
  { label: 'Gross income', get: (i) => i.grossIncome, show: formatCurrency },
  { label: '1099 income (part of gross)', get: (i) => i.selfEmploymentIncome, show: formatCurrency },
  { label: 'Filing status', get: (i) => i.filingStatus, show: (v) => FILING_STATUSES[v] ?? v },
  { label: 'Current age', get: (i) => i.currentAge, show: String },
  { label: 'Retirement age', get: (i) => i.retirementAge, show: String },
  { label: 'Debt payments that end', get: (i) => i.debtPayments, show: formatCurrency },
  { label: 'Other expenses that end', get: (i) => i.otherExpenses, show: formatCurrency },
  { label: 'Savings for retirement', get: (i) => i.savings, show: formatCurrency },
  { label: 'Savings are currently', get: (i) => i.currentType, show: (v) => CONTRIBUTION_TYPES[v] ?? v },
  { label: 'Account type', get: (i) => i.accountType, show: (v) => ACCOUNT_TYPES[v] ?? v },
  {
    label: 'Social Security benefit',
    get: (i) => (i.knowsSocialSecurity ? i.socialSecurityBenefit : 'estimate'),
    show: (v) => (v === 'estimate' ? 'Estimated' : formatCurrency(v)),
  },
  { label: 'Expected return', get: (i) => i.returnRate, show: (v) => formatPercent(v, 0) },
  { label: 'Retirement lifestyle', get: (i) => i.retirementLifestyle ?? 1, show: lifestyleText },
  { label: 'Other Pre-tax balances', get: (i) => i.otherPretaxBalance, show: formatCurrency },
  { label: 'Other Roth balances', get: (i) => i.otherRothBalance, show: formatCurrency },
  { label: 'Other taxable balances', get: (i) => i.otherTaxableBalance, show: formatCurrency },
];

// The inputs that differ between two compare.js input objects, in form order.
export function changedInputs(baseline, current) {
  const changes = [];
  for (const field of INPUT_FIELDS) {
    const from = field.get(baseline);
    const to = field.get(current);
    if (from === to || (Number.isNaN(from) && Number.isNaN(to))) continue;
    changes.push({ label: field.label, from: field.show(from), to: field.show(to) });
  }
  return changes;
}

const LEAN_TEXT = { pretax: 'Pre-tax (Traditional)', roth: 'Roth', even: 'About even' };

// The handful of numbers worth seeing side by side at a glance.
export function headlineRows(result) {
  const row = (key, label, value, format, kind = 'sub') => ({ key, label, value, format, kind });
  return [
    row('need', 'Retirement income number', result.retirementNeed.target, 'currency', 'total'),
    row('ssBenefit', 'Social Security benefit used', result.socialSecurity.annualBenefit, 'currency'),
    row('marginalNow', 'Marginal rate while working', result.rates.marginalNow, 'percent'),
    row('effectiveRetirement', 'Effective rate on these withdrawals', result.rates.effectiveRetirement, 'percent', 'total'),
    row('lean', 'Tends to favor', LEAN_TEXT[result.rates.lean], 'text', 'total'),
    row('contributionRoth', 'Contribution per year, Roth', result.contribution.roth, 'currency'),
    row('contributionPretax', 'Contribution per year, Pre-tax', result.contribution.pretax, 'currency'),
    row('afterTaxRoth', 'After-tax income per year, Roth', result.annuity.roth.afterTaxWithdrawal, 'currency'),
    row('afterTaxPretax', 'After-tax income per year, Pre-tax', result.annuity.pretax.afterTaxWithdrawal, 'currency'),
    row('winner', 'Comes out ahead', LEAN_TEXT[result.comparison.winner], 'text', 'total'),
  ];
}

// Lines up two lists of rows by key: baseline order first, then any rows only
// the current scenario has, placed after the row they follow there. Each
// output row has { key, label, kind, format, baseline, current, delta } where
// baseline/current are the row objects (or null) and delta is current − baseline
// for numbers present on both sides (null otherwise).
export function alignRows(baselineRows, currentRows) {
  const order = baselineRows.map((r) => r.key);
  currentRows.forEach((r, i) => {
    if (order.includes(r.key)) return;
    const prevKey = i > 0 ? currentRows[i - 1].key : null;
    const at = prevKey === null ? -1 : order.indexOf(prevKey);
    order.splice(at + 1, 0, r.key);
  });
  const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));
  const a = byKey(baselineRows);
  const b = byKey(currentRows);
  return order.map((key) => {
    const base = a[key] ?? null;
    const cur = b[key] ?? null;
    const shape = base ?? cur;
    const numeric = typeof base?.value === 'number' && typeof cur?.value === 'number';
    return {
      key,
      label: shape.label,
      kind: shape.kind,
      format: shape.format,
      baseline: base,
      current: cur,
      delta: numeric ? cur.value - base.value : null,
    };
  });
}

// Everything the comparison panel shows, from two compare.js inputs + results.
export function compareScenarios(baseline, current) {
  return {
    changes: changedInputs(baseline.inputs, current.inputs),
    headline: alignRows(headlineRows(baseline.result), headlineRows(current.result)),
    rateSteps: alignRows(effectiveRateSteps(baseline.result), effectiveRateSteps(current.result)),
    drivers: alignRows(rateDriverRows(baseline.result), rateDriverRows(current.result)),
  };
}
