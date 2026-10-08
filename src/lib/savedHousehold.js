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
import { HOUSEHOLD_VALUES_VERSION, cleanHouseholdValues } from './householdValues.js';
import { upgradeHouseholdValues } from './householdUpgrade.js';

export const SAVED_SCHEMA_VERSION = 1;
// Version 2 households (round 2 phase 0) are stored as their cleaned values, with this
// schema_version; every save is version 2 since step b. Version 1 saves still open, converted.
export const SAVED_SCHEMA_VERSION_V2 = HOUSEHOLD_VALUES_VERSION;
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

// ---- Version 2 (round 2 phase 0) ----

// Version 2 values -> the object stored in saved_households.data (the cleaned values themselves).
export function caseFromValuesV2(values) {
  return cleanHouseholdValues(values);
}

// A stored object of either version -> version 2 values: a version 2 object is cleaned; a
// version 1 object is cleaned as version 1 and converted (householdUpgrade.js; year = the year
// it's opened in). null when it's neither.
export function valuesV2FromCase(data, year) {
  if (data && typeof data === 'object' && data.version === HOUSEHOLD_VALUES_VERSION) return cleanHouseholdValues(data);
  const v1 = valuesFromCase(data);
  return v1 ? upgradeHouseholdValues(v1, year) : null;
}

// The "Unsaved changes" marker for version 2 values (row ids don't count, as in version 1).
export function sameSavedHouseholdV2(values, savedValues) {
  if (!savedValues) return false;
  return JSON.stringify(caseFromValuesV2(values)) === JSON.stringify(caseFromValuesV2(savedValues));
}
