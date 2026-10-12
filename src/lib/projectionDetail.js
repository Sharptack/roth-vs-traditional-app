// The parts behind a projection row's totals (roadmap phase 6 step a, decided 2026-10-12): the year
// table's breakdowns. Pure; reads row.detail, which runProjection fills (projection.js):
//   income:   [{ kind: 'w2' | '1099' | 'socialSecurity' | 'pension' | 'other', owner, amount, id?,
//               part? ('own' | 'spousal' | 'survivor'), index? (the pension's place), treatment? }]
//   accounts: each account with activity this year: { id, owner, type, start, withdrawn, rmd,
//               convertedOut, convertedIn, growth, dividends, dividendTax, contributed, employer,
//               reinvested, end }
//   spending: { baseNeed, need, afterTaxIncome, surplus, extraSpending, reinvested, shortfall }
//   taxParams, tax: the year's calculateYearTax input and result
import { yearTaxRows } from './yearTaxRows.js';
import { ACCOUNT_TYPE_LABELS, OTHER_KIND_LABELS, OWNER_LABELS } from './householdInputs.js';

const OTHER_SHORT = { ordinary: 'taxable as ordinary income', taxExempt: 'tax-exempt', interest: 'interest', qualified: 'qualified dividends, long-term gains' };
const whoOf = (owner, couple) => (couple ? `${OWNER_LABELS[owner] ?? owner}: ` : '');

// The accounts the projection opens itself (projection.js accountFor): what goes into each.
const NEW_MONEY = { pretax: 'new contributions', roth: 'new contributions and conversions', taxable: 'new savings and surplus' };

// Labels for one year's accounts, by id: "Pre-tax account" (numbered when an owner has more than one
// of a type), the projection's own accounts by what goes into them, a pension lump sum's IRA.
export function accountLabels(accounts, { couple = false } = {}) {
  const own = accounts.filter((a) => !a.id.startsWith('new-') && !a.id.startsWith('lump-'));
  const labels = {};
  for (const a of accounts) {
    const who = whoOf(a.owner, couple);
    const type = ACCOUNT_TYPE_LABELS[a.type];
    if (a.id.startsWith('new-')) labels[a.id] = `${who}${type}, ${NEW_MONEY[a.type]}`;
    else if (a.id.startsWith('lump-')) labels[a.id] = `${who}Pre-tax IRA (pension lump sum)`;
    else {
      const same = own.filter((x) => x.owner === a.owner && x.type === a.type);
      labels[a.id] = `${who}${type} account${same.length > 1 ? ` ${same.indexOf(a) + 1}` : ''}`;
    }
  }
  return labels;
}

// The household's shape for labels, from the rows: a couple, and how many pensions.
export function detailContext(rows) {
  const pensions = rows.flatMap((r) => r.detail.income.filter((x) => x.kind === 'pension').map((x) => x.index));
  return { couple: (rows[0]?.ages.length ?? 1) > 1, pensionCount: pensions.length > 0 ? Math.max(...pensions) + 1 : 0 };
}

// A total column's parts across the years (the year table's columns that open, decided 2026-10-12):
// [{ key, label, value(row) }], the parts adding up to the column's total in every row (tested).
// Columns with parts: wages, ss, pension, other, withdrawn, contributed, incomeTax, end; else [].
export function columnParts(column, rows, ctx = detailContext(rows)) {
  const incomeParts = (kinds, keyOf) => {
    const seen = new Map();
    for (const r of rows) for (const x of r.detail.income) if (kinds.includes(x.kind) && !seen.has(keyOf(x))) seen.set(keyOf(x), x);
    return [...seen].map(([k, x]) => ({
      key: `${column}:${k}`,
      label: incomeLabel(x, ctx),
      value: (r) => r.detail.income.filter((y) => kinds.includes(y.kind) && keyOf(y) === k).reduce((s, y) => s + y.amount, 0),
    }));
  };
  const accountParts = (field, keep = () => true) => {
    const seen = new Map();
    for (const r of rows) for (const a of r.detail.accounts) if (!seen.has(a.id) && keep(a)) seen.set(a.id, a);
    const labels = accountLabels([...seen.values()], ctx);
    return [...seen.keys()]
      .map((id) => ({ key: `${column}:${id}`, label: labels[id], value: (r) => r.detail.accounts.find((a) => a.id === id)?.[field] ?? 0 }))
      .filter((p) => rows.some((r) => Math.abs(p.value(r)) > 0.005));
  };
  switch (column) {
    case 'wages':
      return incomeParts(['w2', '1099'], (x) => x.id ?? `${x.kind}-${x.owner}`);
    case 'ss':
      return incomeParts(['socialSecurity'], (x) => `${x.owner}-${x.part}`);
    case 'pension':
      return incomeParts(['pension'], (x) => String(x.index));
    case 'other':
      return incomeParts(['other'], (x) => x.id);
    case 'withdrawn':
      return accountParts('withdrawn');
    case 'contributed':
      return accountParts('contributed');
    case 'end':
      return accountParts('end');
    case 'incomeTax': {
      const parts = [
        { key: 'incomeTax:ordinary', label: 'Ordinary income tax', value: (r) => r.ordinaryTax },
        { key: 'incomeTax:gains', label: 'Capital-gains tax', value: (r) => r.capitalGainsTax },
        { key: 'incomeTax:niit', label: 'NIIT', value: (r) => r.niit },
        // the child tax credit (incomeTax = the three taxes less the credits)
        { key: 'incomeTax:credits', label: 'Credits', value: (r) => r.incomeTax - r.ordinaryTax - r.capitalGainsTax - r.niit },
      ];
      return parts.filter((p) => rows.some((r) => Math.abs(p.value(r)) > 0.005));
    }
    default:
      return [];
  }
}

// One income line's label. pensionCount: how many pensions the household has (numbered when more than one).
export function incomeLabel(item, { couple = false, pensionCount = 1 } = {}) {
  const who = whoOf(item.owner, couple);
  switch (item.kind) {
    case 'w2':
      return `${who}Wages (W-2)`;
    case '1099':
      return `${who}Self-employment (1099)`;
    case 'socialSecurity':
      return `${who}Social Security${item.part === 'spousal' ? ', spousal top-up' : item.part === 'survivor' ? ', survivor benefit (above their own)' : ''}`;
    case 'pension':
      return `${who}Pension${pensionCount > 1 ? ` ${item.index + 1}` : ''}`;
    default:
      return `${who}Other income (${OTHER_SHORT[item.treatment] ?? OTHER_KIND_LABELS[item.treatment] ?? item.treatment})`;
  }
}

// An account's year, added up from its start: equals its end (tested).
export function accountFlowTotal(a) {
  return a.start - a.withdrawn - a.convertedOut + a.convertedIn + a.growth - a.dividendTax + a.contributed + a.employer + a.reinvested;
}

// The tax calculator's rows for this projection year (the same rows the tax page shows), with the
// Medicare IRMAA surcharge after them when there is one (it is not a tax, so not in the total).
export function yearTaxRowsOf(row) {
  const rows = yearTaxRows(row.detail.taxParams, row.detail.tax);
  if (row.irmaa > 0) rows.push({ key: 'irmaa', label: `Medicare IRMAA surcharges (tier ${row.irmaaTier}, set by MAGI two years earlier)`, value: row.irmaa, kind: 'line' });
  return rows;
}
