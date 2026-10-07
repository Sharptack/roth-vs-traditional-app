// What a saved household holds (the #/next preview's "Saved households", stored in Supabase's
// saved_households.data). Pure. The household FORM values are stored (strings, as the form
// keeps them), not the derived household object, so a saved household reopens exactly as it was
// typed, and the math stays in the app.
//
// Security: what goes in and what comes out are both cleaned to an allow-list. Only known form
// fields (HOUSEHOLD_FORM_KEYS, the same list share links use) are kept, every value must be a
// short string, and the accounts list is rebuilt field by field, so a row someone tampered with
// can never inject anything else into the app's state. The database also caps the size.
import { HOUSEHOLD_FORM_KEYS } from './householdLink.js';
import { PREVIEW_DEFAULT_VALUES } from './household.js';

export const SAVED_SCHEMA_VERSION = 1;
export const MAX_LABEL_LENGTH = 80;
export const MAX_ACCOUNTS = 50;
const MAX_VALUE_LENGTH = 64;
const ACCOUNT_TYPES = ['pretax', 'roth', 'taxable'];
const OWNERS = ['p1', 'p2'];

const cleanString = (v) => (typeof v === 'string' ? v.slice(0, MAX_VALUE_LENGTH) : null);

function cleanAccounts(rows) {
  if (!Array.isArray(rows)) return null;
  const out = rows
    .slice(0, MAX_ACCOUNTS)
    .filter((a) => a && typeof a === 'object' && ACCOUNT_TYPES.includes(a.type) && OWNERS.includes(a.owner))
    .map((a, i) => ({
      id: `a${i + 1}`,
      owner: a.owner,
      type: a.type,
      balance: cleanString(a.balance) ?? '0',
      basisShare: cleanString(a.basisShare) ?? '0.5',
    }));
  return out.length > 0 ? out : null;
}

// Form values -> the object stored in saved_households.data.
export function caseFromValues(values) {
  const fields = {};
  for (const key of HOUSEHOLD_FORM_KEYS) {
    const v = cleanString(values?.[key]);
    if (v !== null) fields[key] = v;
  }
  return { fields, accounts: cleanAccounts(values?.accounts) ?? [] };
}

// A stored object -> form values (defaults for anything missing). null when it isn't one of ours.
export function valuesFromCase(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.fields !== 'object' || data.fields === null) {
    return null;
  }
  const values = { ...PREVIEW_DEFAULT_VALUES };
  for (const key of HOUSEHOLD_FORM_KEYS) {
    const v = cleanString(data.fields[key]);
    if (v !== null) values[key] = v;
  }
  values.accounts = cleanAccounts(data.accounts) ?? PREVIEW_DEFAULT_VALUES.accounts;
  return values;
}

// A household's label, trimmed; an error message when it can't be used.
export function cleanLabel(label) {
  const trimmed = String(label ?? '').trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return { label: '', error: 'Give the household a short name.' };
  if (trimmed.length > MAX_LABEL_LENGTH) return { label: trimmed, error: `Keep the name under ${MAX_LABEL_LENGTH} characters.` };
  return { label: trimmed, error: null };
}

// Whether the form values would store the same household as the saved values (the "Unsaved
// changes" marker). Compares what would be stored, so a field that is never saved, or an
// account row's id, doesn't count as a change. false when there is nothing saved to compare to.
export function sameSavedHousehold(values, savedValues) {
  if (!savedValues) return false;
  return JSON.stringify(caseFromValues(values)) === JSON.stringify(caseFromValues(savedValues));
}
