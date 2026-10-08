// Share links for the household model (roadmap phase 1, step 8). Pure.
//
//   ?hh=1&h.grossIncome=…&h.spouseIncome=…&acc=pretax~p1~100000~0.5,roth~p2~40000~0.5[&view=1]
//
// - `hh` is the version marker (HOUSEHOLD_VERSION). Every form value is under an `h.` prefix so
//   the current calculator, which reads unprefixed keys (shareInputs.js), never picks them up.
// - `acc`: the Existing Accounts list, one `type~owner~balance~basisShare` row per account.
// - `view=1`: open locked (view only), with an "Edit a copy" button.
// - A link with no `hh` but the current calculator's keys (an old link) opens as a one-person
//   household: its three balances become the accounts list, and it gets the new version's
//   retirement-year tax rules (it opens in the new version).
// Unknown keys are ignored; missing keys fall back to the defaults; malformed account rows are
// dropped.
import { DEFAULT_FORM_VALUES, parseNumber } from './formInputs.js';
import {
  HOUSEHOLD_VERSION,
  NEW_RULES_DEFAULT_VALUES,
  PREVIEW_DEFAULT_VALUES,
  SPOUSE_DEFAULT_VALUES,
  accountRowsFromFlat,
} from './household.js';
import { TAX_CALCULATOR_DEFAULT_VALUES } from './taxCalculator.js';
import { PROJECTION_DEFAULT_VALUES } from './household.js';
import { CONVERSION_DEFAULT_VALUES } from './conversionCalculator.js';
import { PENSION_DEFAULT_VALUES } from './pensionCalculator.js';
import { valuesFromSearch } from './shareInputs.js';
import { HOUSEHOLD_VALUES_VERSION, cleanHouseholdValues } from './householdValues.js';
import { upgradeHouseholdValues } from './householdUpgrade.js';

const PREFIX = 'h.';
// The flat balances are carried by the accounts list instead.
const FLAT_BALANCE_KEYS = ['otherPretaxBalance', 'otherRothBalance', 'otherTaxableBalance', 'otherTaxableBasis'];
const KEYS = [...Object.keys(DEFAULT_FORM_VALUES), ...Object.keys(SPOUSE_DEFAULT_VALUES), ...Object.keys(NEW_RULES_DEFAULT_VALUES), ...Object.keys(TAX_CALCULATOR_DEFAULT_VALUES), ...Object.keys(PROJECTION_DEFAULT_VALUES), ...Object.keys(CONVERSION_DEFAULT_VALUES), ...Object.keys(PENSION_DEFAULT_VALUES)].filter(
  (k) => !FLAT_BALANCE_KEYS.includes(k),
);
// Every household form field a link (or a saved household, savedHousehold.js) may carry.
export const HOUSEHOLD_FORM_KEYS = KEYS;
const ACCOUNT_TYPES = ['pretax', 'roth', 'taxable'];
const OWNERS = ['p1', 'p2'];

const cleanNumber = (text) => {
  const n = parseNumber(text);
  return Number.isFinite(n) ? String(n) : '0';
};

export function householdLinkSearch(values, { viewOnly = false } = {}) {
  const params = new URLSearchParams();
  params.set('hh', String(HOUSEHOLD_VERSION));
  for (const key of KEYS) params.set(PREFIX + key, values[key] ?? '');
  params.set(
    'acc',
    (values.accounts ?? [])
      .map((a) => [a.type, a.owner, cleanNumber(a.balance), a.basisShare ?? '0.5'].join('~'))
      .join(','),
  );
  if (viewOnly) params.set('view', '1');
  return `?${params.toString()}`;
}

function accountsFromParam(text) {
  const rows = String(text ?? '')
    .split(',')
    .map((row) => row.split('~'))
    .filter(([type, owner, balance]) => ACCOUNT_TYPES.includes(type) && OWNERS.includes(owner) && balance !== undefined)
    .map(([type, owner, balance, basisShare], i) => ({
      id: `a${i + 1}`,
      owner,
      type,
      balance,
      basisShare: basisShare ?? '0.5',
    }));
  return rows.length > 0 ? rows : null;
}

// -> { values, viewOnly, fromOldLink } or null when the link carries no inputs.
export function householdValuesFromSearch(search) {
  const params = new URLSearchParams(search ?? '');
  const viewOnly = params.get('view') === '1';
  if (params.has('hh')) {
    const values = { ...PREVIEW_DEFAULT_VALUES };
    for (const key of KEYS) if (params.has(PREFIX + key)) values[key] = params.get(PREFIX + key);
    values.accounts = accountsFromParam(params.get('acc')) ?? PREVIEW_DEFAULT_VALUES.accounts;
    return { values, viewOnly, fromOldLink: false };
  }
  const old = valuesFromSearch(search).values;
  if (!old) return null;
  return {
    values: { ...PREVIEW_DEFAULT_VALUES, ...old, accounts: accountRowsFromFlat(old) },
    viewOnly,
    fromOldLink: true,
  };
}

// ---- Version 2 links (round 2 phase 0) ----
//
//   ?hh=2&v=<base64url of the values' JSON>[&view=1]
//
// Version 2 values have rows and groups, so the whole (cleaned) values object travels as one
// encoded parameter; what comes back goes through the same allow-list as a saved household
// (cleanHouseholdValues), so a tampered link can't inject anything. hh=1 links and old
// public-calculator links open converted (householdUpgrade.js). Every new link is version 2.

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function householdLinkSearchV2(values, { viewOnly = false } = {}) {
  const params = new URLSearchParams();
  params.set('hh', String(HOUSEHOLD_VALUES_VERSION));
  params.set('v', toBase64Url(JSON.stringify(cleanHouseholdValues(values))));
  if (viewOnly) params.set('view', '1');
  return `?${params.toString()}`;
}

// -> { values (version 2), viewOnly, fromOldLink } or null when the link carries no household
// (or a version 2 link that can't be read). year: the year it's opened in, for the conversion.
export function householdValuesV2FromSearch(search, year) {
  const params = new URLSearchParams(search ?? '');
  const viewOnly = params.get('view') === '1';
  if (params.get('hh') === String(HOUSEHOLD_VALUES_VERSION)) {
    let values;
    try {
      values = cleanHouseholdValues(JSON.parse(fromBase64Url(params.get('v') ?? '')));
    } catch {
      values = null;
    }
    return values ? { values, viewOnly, fromOldLink: false } : null;
  }
  const v1 = householdValuesFromSearch(search);
  return v1 ? { ...v1, values: upgradeHouseholdValues(v1.values, year) } : null;
}
