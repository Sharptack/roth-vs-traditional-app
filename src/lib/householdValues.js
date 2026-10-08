// The version 2 household's form values (round 2 phase 0): what the inputs page edits, what a
// share link or a saved household stores. Pure. Like version 1 (household.js), every value the
// user types is kept as a string, as typed; household.js turns them into numbers.
//
// values = {
//   version: 2,
//   filingStatus: 'single' | 'mfj',
//   includeSpouse: 'yes' | 'no',          // the spouse counts only when filing jointly and 'yes'
//   people: [                             // always p1; p2 once a spouse has been entered
//     { id: 'p1' | 'p2',
//       ageEntry: 'age' | 'birthdate',    // which one was typed; the other follows (setPersonField)
//       age, birthDate,                   // birthDate 'YYYY-MM-DD', or '' when only the age is known
//       sex: '' | 'male' | 'female',      // biological sex; used only for life expectancy
//       retirementAge, planToAge,
//       socialSecurity: { mode: 'estimate' | 'pia', pia, claimAge } } ],
//                                          // 'estimate': from earnings; 'pia': the monthly benefit at
//                                          // full retirement age, as typed. claimAge '' = at retirement
//   incomes: [ { id, owner, type, treatment, amount, fromAge, toAge } ],
//                                          // type: INCOME_TYPES; treatment: 'ordinary' | 'taxExempt'
//                                          // (only for 'other'); fromAge..toAge are the owner's first
//                                          // and last ages it's received (both included); blank
//                                          // fromAge = from now, blank toAge = until the owner retires
//   contributions: [ { id, owner, tax: 'pretax' | 'roth' | 'taxable', account: '401k' | 'ira', amount } ],
//   accounts: [ { id, owner, type: 'pretax' | 'roth' | 'taxable', balance, basisShare } ],   // as version 1
//   liabilities: [ { id, kind, balance, rate, payment } ],   // kind: LIABILITY_KINDS; rate: the annual
//                                          // interest rate in percent, as typed (6.5); payment monthly
//   spending: { debtPayments, otherExpenses, retirementLifestyle },   // the costs that end at retirement
//   assumptions: { returnRate, inflationRate, ageDeductions, taxSavedBasis, retirementRateShift, medicareIrmaa },
//   calculators: { projection: { endAge, heirTaxRate, strategy }, conversion: { amount },
//                  pension: { lumpSum, monthly, startAge, cola, survivorShare, endAge, spouseEndAge } },
// }
//
// The defaults are version 1's (household.js PREVIEW_DEFAULT_VALUES), row by row.

export const HOUSEHOLD_VALUES_VERSION = 2;

export const OWNERS = ['p1', 'p2'];
// Earnings ('w2', '1099') run until the owner retires unless a toAge is given; the rest are the
// tax calculator's other income types ("Add other income types").
export const INCOME_TYPES = ['w2', '1099', 'other', 'interest', 'qualified', 'socialSecurity'];
export const INCOME_TREATMENTS = ['ordinary', 'taxExempt'];
export const CONTRIBUTION_TAX_TYPES = ['pretax', 'roth', 'taxable'];
export const CONTRIBUTION_ACCOUNTS = ['401k', 'ira'];
export const ACCOUNT_TYPES = ['pretax', 'roth', 'taxable'];
export const LIABILITY_KINDS = ['mortgage', 'car', 'student', 'creditCard', 'other'];
export const SS_MODES = ['estimate', 'pia'];

export function newPerson(id, overrides = {}) {
  return {
    id,
    ageEntry: 'age',
    age: '35',
    birthDate: '',
    sex: '',
    retirementAge: '65',
    planToAge: '95',
    socialSecurity: { mode: 'estimate', pia: '', claimAge: '' },
    ...overrides,
  };
}

// The list name -> its id prefix and a new, empty row (owner p1).
const ROW_TEMPLATES = {
  incomes: { prefix: 'i', row: { owner: 'p1', type: 'w2', treatment: 'ordinary', amount: '', fromAge: '', toAge: '' } },
  contributions: { prefix: 'c', row: { owner: 'p1', tax: 'pretax', account: '401k', amount: '' } },
  accounts: { prefix: 'a', row: { owner: 'p1', type: 'pretax', balance: '', basisShare: '0.5' } },
  liabilities: { prefix: 'l', row: { kind: 'mortgage', balance: '', rate: '', payment: '' } },
};
export const ROW_LISTS = Object.keys(ROW_TEMPLATES);

export const DEFAULT_HOUSEHOLD_VALUES = {
  version: HOUSEHOLD_VALUES_VERSION,
  filingStatus: 'single',
  includeSpouse: 'no',
  people: [newPerson('p1')],
  incomes: [{ id: 'i1', ...ROW_TEMPLATES.incomes.row, amount: '100000' }],
  contributions: [{ id: 'c1', ...ROW_TEMPLATES.contributions.row, amount: '10000' }],
  accounts: [{ id: 'a1', ...ROW_TEMPLATES.accounts.row, balance: '100000' }],
  liabilities: [],
  spending: { debtPayments: '6000', otherExpenses: '0', retirementLifestyle: '1' },
  assumptions: {
    returnRate: '0.07',
    inflationRate: '0.025',
    ageDeductions: 'yes',
    taxSavedBasis: 'average',
    retirementRateShift: '0',
    medicareIrmaa: 'yes',
  },
  calculators: {
    projection: { endAge: '95', heirTaxRate: '0.24', strategy: 'proportional' },
    conversion: { amount: '50000' },
    pension: {
      lumpSum: '300000',
      monthly: '1800',
      startAge: '65',
      cola: '0',
      survivorShare: '0',
      endAge: '90',
      spouseEndAge: '90',
    },
  },
};

export function hasSpouseV2(values) {
  return values.filingStatus === 'mfj' && values.includeSpouse === 'yes';
}

// The people who count: p1, and p2 when a spouse is included.
export function activePeople(values) {
  return values.people.filter((p) => p.id === 'p1' || (p.id === 'p2' && hasSpouseV2(values)));
}

// ---- Age and birthdate, one linked pair ----

// 'YYYY-MM-DD' -> { year, month, day }, or null when it isn't a real date.
export function parseBirthDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const [year, month, day] = m.slice(1).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

// Whole years of age on a date (the everyday rule: one more on the birthday itself; a February 29
// birthday counts from March 1 in other years). null when either date isn't valid.
export function ageOn(birthDate, onDate) {
  const b = parseBirthDate(birthDate);
  const on = parseBirthDate(onDate);
  if (!b || !on) return null;
  const hadBirthday = on.month > b.month || (on.month === b.month && on.day >= b.day);
  return on.year - b.year - (hadBirthday ? 0 : 1);
}

// A Date as 'YYYY-MM-DD' (local calendar day).
export function isoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---- Updates (each returns new values; nothing is changed in place) ----

const replacePerson = (values, id, fn) => ({
  ...values,
  people: values.people.map((p) => (p.id === id ? fn(p) : p)),
});

// Set one of a person's fields. Age and birthdate are linked: typing a birthdate sets the age
// (as of `today`, 'YYYY-MM-DD'); typing an age clears the birthdate, since an age alone doesn't
// give one. Social Security fields are 'socialSecurity.mode', '.pia', '.claimAge'.
export function setPersonField(values, id, field, value, today) {
  return replacePerson(values, id, (p) => {
    if (field === 'age') return { ...p, ageEntry: 'age', age: value, birthDate: '' };
    if (field === 'birthDate') {
      const age = ageOn(value, today);
      return { ...p, ageEntry: 'birthdate', birthDate: value, age: age === null ? '' : String(age) };
    }
    if (field.startsWith('socialSecurity.')) {
      return { ...p, socialSecurity: { ...p.socialSecurity, [field.slice('socialSecurity.'.length)]: value } };
    }
    return { ...p, [field]: value };
  });
}

// Bring a birthdate-entered person's age up to date (a saved household reopened a year later).
export function refreshAges(values, today) {
  return {
    ...values,
    people: values.people.map((p) => {
      if (p.ageEntry !== 'birthdate') return p;
      const age = ageOn(p.birthDate, today);
      return age === null || String(age) === p.age ? p : { ...p, age: String(age) };
    }),
  };
}

// Include or take out the spouse. A spouse's details are kept when they are taken out, so putting
// them back restores them; the first time, p2 starts from the defaults.
export function setIncludeSpouse(values, include) {
  const next = { ...values, includeSpouse: include ? 'yes' : 'no' };
  if (include && !values.people.some((p) => p.id === 'p2')) next.people = [...values.people, newPerson('p2')];
  return next;
}

// A row id no other row in the list has: the prefix and the next free number.
export function newRowId(rows, prefix) {
  const used = new Set(rows.map((r) => r.id));
  let n = rows.length + 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function addRow(values, list, overrides = {}) {
  const { prefix, row } = ROW_TEMPLATES[list];
  const rows = values[list];
  return { ...values, [list]: [...rows, { id: newRowId(rows, prefix), ...row, ...overrides }] };
}

export function updateRow(values, list, id, field, value) {
  return { ...values, [list]: values[list].map((r) => (r.id === id ? { ...r, [field]: value } : r)) };
}

export function removeRow(values, list, id) {
  return { ...values, [list]: values[list].filter((r) => r.id !== id) };
}

// Set a field of one of the groups (spending, assumptions) or a calculator's own inputs
// (group 'calculators.pension', ...).
export function setGroupField(values, group, field, value) {
  if (group.startsWith('calculators.')) {
    const name = group.slice('calculators.'.length);
    return {
      ...values,
      calculators: { ...values.calculators, [name]: { ...values.calculators[name], [field]: value } },
    };
  }
  return { ...values, [group]: { ...values[group], [field]: value } };
}

// ---- Cleaning values from outside (a saved household, a share link) ----
//
// Security: anything stored or linked is untrusted. cleanHouseholdValues rebuilds version 2 values
// field by field from an allow-list: every value a short string, every choice one of its known
// options (else the default), rows capped and renumbered, rows with an unknown type or owner
// dropped, unknown keys never copied. -> values, or null when it isn't a version 2 household.
export const MAX_ROWS = 50;
const MAX_VALUE_LENGTH = 64;
const str = (v, fallback = '') => (typeof v === 'string' ? v.slice(0, MAX_VALUE_LENGTH) : fallback);
const oneOf = (v, options, fallback) => (options.includes(v) ? v : fallback);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A group (spending, assumptions, a calculator's inputs): only the default's keys, as strings.
function cleanGroup(raw, defaults) {
  const src = isObject(raw) ? raw : {};
  return Object.fromEntries(Object.keys(defaults).map((k) => [k, str(src[k], defaults[k])]));
}

function cleanPerson(raw, id) {
  const d = newPerson(id);
  const src = isObject(raw) ? raw : {};
  const ss = isObject(src.socialSecurity) ? src.socialSecurity : {};
  return {
    id,
    ageEntry: oneOf(src.ageEntry, ['age', 'birthdate'], 'age'),
    age: str(src.age, d.age),
    birthDate: str(src.birthDate),
    sex: oneOf(src.sex, ['', 'male', 'female'], ''),
    retirementAge: str(src.retirementAge, d.retirementAge),
    planToAge: str(src.planToAge, d.planToAge),
    socialSecurity: { mode: oneOf(ss.mode, SS_MODES, 'estimate'), pia: str(ss.pia), claimAge: str(ss.claimAge) },
  };
}

// Each list's row: its choice fields with their options (a row with another value is dropped),
// and its text fields.
const ROW_RULES = {
  incomes: {
    choices: { owner: OWNERS, type: INCOME_TYPES },
    optional: { treatment: INCOME_TREATMENTS },
    text: ['amount', 'fromAge', 'toAge'],
  },
  contributions: { choices: { owner: OWNERS, tax: CONTRIBUTION_TAX_TYPES, account: CONTRIBUTION_ACCOUNTS }, text: ['amount'] },
  accounts: { choices: { owner: OWNERS, type: ACCOUNT_TYPES }, text: ['balance', 'basisShare'] },
  liabilities: { choices: { kind: LIABILITY_KINDS }, text: ['balance', 'rate', 'payment'] },
};

function cleanRows(raw, list) {
  if (!Array.isArray(raw)) return [];
  const { prefix, row: template } = ROW_TEMPLATES[list];
  const rules = ROW_RULES[list];
  return raw
    .slice(0, MAX_ROWS)
    .filter((r) => isObject(r) && Object.entries(rules.choices).every(([k, options]) => options.includes(r[k])))
    .map((r, i) => {
      const row = { id: `${prefix}${i + 1}` };
      for (const k of Object.keys(template)) {
        if (rules.choices[k]) row[k] = r[k];
        else if (rules.optional?.[k]) row[k] = oneOf(r[k], rules.optional[k], template[k]);
        else row[k] = str(r[k], template[k]);
      }
      return row;
    });
}

export function cleanHouseholdValues(raw) {
  if (!isObject(raw) || raw.version !== HOUSEHOLD_VALUES_VERSION) return null;
  const D = DEFAULT_HOUSEHOLD_VALUES;
  const rawPeople = Array.isArray(raw.people) ? raw.people.filter(isObject) : [];
  const find = (id) => rawPeople.find((p) => p.id === id);
  const people = [cleanPerson(find('p1'), 'p1'), ...(find('p2') ? [cleanPerson(find('p2'), 'p2')] : [])];
  const accounts = cleanRows(raw.accounts, 'accounts');
  const calculators = isObject(raw.calculators) ? raw.calculators : {};
  return {
    version: HOUSEHOLD_VALUES_VERSION,
    filingStatus: oneOf(raw.filingStatus, ['single', 'mfj'], D.filingStatus),
    includeSpouse: oneOf(raw.includeSpouse, ['yes', 'no'], D.includeSpouse),
    people,
    incomes: cleanRows(raw.incomes, 'incomes'),
    contributions: cleanRows(raw.contributions, 'contributions'),
    // The accounts list never starts empty (as version 1).
    accounts: accounts.length > 0 ? accounts : D.accounts.map((a) => ({ ...a })),
    liabilities: cleanRows(raw.liabilities, 'liabilities'),
    spending: cleanGroup(raw.spending, D.spending),
    assumptions: cleanGroup(raw.assumptions, D.assumptions),
    calculators: Object.fromEntries(
      Object.entries(D.calculators).map(([name, defaults]) => [name, cleanGroup(calculators[name], defaults)]),
    ),
  };
}
