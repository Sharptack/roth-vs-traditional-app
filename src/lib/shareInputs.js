// Sharing a scenario: the form values as a link (query string) and as plain text
// that can be pasted into a conversation. Pure; App reads/writes the browser bits.
import { compareRothVsTraditional } from './compare.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from './formInputs.js';
import { formatValue } from './format.js';
import { changedInputs, describeInputs, headlineRows } from './scenarioCompare.js';

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

const bullet = (label, value) => `- ${label}: ${value}`;

function resultLines(result) {
  if (!result.valid) return result.errors.map((e) => `- (invalid) ${e}`);
  return headlineRows(result).map((r) => bullet(r.label, formatValue(r.value, r.format)));
}

// A readable summary of the scenario (inputs, headline results, link) to paste into a chat.
export function shareText({ values, compareValues = null, year, url }) {
  const inputs = toCompareInputs(values, year);
  const result = compareRothVsTraditional(inputs);
  const lines = [
    `Roth vs. Pre-tax calculator scenario (${year} tax rules)`,
    `Link: ${url}`,
    '',
    compareValues ? 'Baseline inputs' : 'Inputs',
    ...describeInputs(inputs).map((i) => bullet(i.label, i.value)),
    '',
    compareValues ? 'Baseline results' : 'Results',
    ...resultLines(result),
  ];
  if (compareValues) {
    const changedIn = toCompareInputs(compareValues, year);
    const changes = changedInputs(inputs, changedIn);
    lines.push(
      '',
      'Compared with a change',
      ...(changes.length === 0
        ? ['- (no inputs changed)']
        : changes.map((c) => bullet(c.label, `${c.from} -> ${c.to}`))),
      '',
      'Results with the change',
      ...resultLines(compareRothVsTraditional(changedIn)),
    );
  }
  return lines.join('\n');
}
