// The single Roth vs. Pre-tax calculator's share links ("?grossIncome=100000&..."), from before the
// switchover at the end of round 2's phase 1. Those links still open, as a one-person household
// (householdLink.js reads them with valuesFromSearch); valuesToSearch writes one, for tests.
import { DEFAULT_FORM_VALUES } from './formInputs.js';

const KEYS = Object.keys(DEFAULT_FORM_VALUES);
const COMPARE_PREFIX = 'c.'; // query keys for the "Compare a change" second set of inputs

// "?grossIncome=100000&…" with every form field, plus the second set when comparing.
export function valuesToSearch(values, compareValues = null) {
  const params = new URLSearchParams();
  for (const key of KEYS) params.set(key, values[key] ?? '');
  if (compareValues) {
    for (const key of KEYS) params.set(COMPARE_PREFIX + key, compareValues[key] ?? '');
  }
  return `?${params.toString()}`;
}

// Reads a query string back. Unknown keys are ignored and missing ones fall back to
// the defaults. `values` / `compareValues` are null when the link carries none.
export function valuesFromSearch(search) {
  const params = new URLSearchParams(search ?? '');
  const read = (prefix) => {
    const found = KEYS.filter((key) => params.has(prefix + key));
    if (found.length === 0) return null;
    const out = { ...DEFAULT_FORM_VALUES };
    for (const key of found) out[key] = params.get(prefix + key);
    return out;
  };
  return { values: read(''), compareValues: read(COMPARE_PREFIX) };
}
