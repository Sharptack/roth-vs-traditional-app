// Social Security data used by the simplified benefit ESTIMATOR
// (src/lib/socialSecurity.js). Not used for taxability of a known benefit —
// that lives in ssTaxThresholds.js.
//
// TO ADD A YEAR: copy the 2025 object, change the key and numbers.

// PIA (Primary Insurance Amount) bend points, by year.
// PIA = 90% of AIME up to bendPoint1
//     + 32% of AIME between bendPoint1 and bendPoint2
//     + 15% of AIME above bendPoint2
// (AIME = Average Indexed MONTHLY Earnings.) The annual wage base — the cap on
// earnings that count toward a benefit — lives in ficaRates.js, since it is the
// same number that caps the Social Security payroll tax.
//
// NOTE: SSA fixes bend points at the year a worker turns 62, not the current
// year. The estimator applies the requested year's bend points to everyone —
// part of why it is a simplified estimate.
export const SS_BEND_POINTS = {
  2025: {
    bendPoint1: 1226,
    bendPoint2: 7391,
  },
};

// Full retirement age (FRA) by birth year, in MONTHS (so 66y 2m = 794).
// FRA depends on the year you were born, not the calendar year, so this is a
// list of birth-year ranges rather than a year-keyed object. Source: SSA.
const y = (years, months = 0) => years * 12 + months;
export const FULL_RETIREMENT_AGE = [
  { fromBirthYear: -Infinity, toBirthYear: 1937, months: y(65) },
  { fromBirthYear: 1938, toBirthYear: 1938, months: y(65, 2) },
  { fromBirthYear: 1939, toBirthYear: 1939, months: y(65, 4) },
  { fromBirthYear: 1940, toBirthYear: 1940, months: y(65, 6) },
  { fromBirthYear: 1941, toBirthYear: 1941, months: y(65, 8) },
  { fromBirthYear: 1942, toBirthYear: 1942, months: y(65, 10) },
  { fromBirthYear: 1943, toBirthYear: 1954, months: y(66) },
  { fromBirthYear: 1955, toBirthYear: 1955, months: y(66, 2) },
  { fromBirthYear: 1956, toBirthYear: 1956, months: y(66, 4) },
  { fromBirthYear: 1957, toBirthYear: 1957, months: y(66, 6) },
  { fromBirthYear: 1958, toBirthYear: 1958, months: y(66, 8) },
  { fromBirthYear: 1959, toBirthYear: 1959, months: y(66, 10) },
  { fromBirthYear: 1960, toBirthYear: Infinity, months: y(67) },
];

// Earliest and latest ages at which benefits can be claimed.
export const EARLIEST_CLAIMING_AGE = 62;
export const LATEST_CLAIMING_AGE = 70;
