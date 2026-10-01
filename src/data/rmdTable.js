// Required minimum distributions (roadmap phase 3): when they start, and the divisor.
//
// UNIFORM_LIFETIME_TABLE: the distribution period ("applicable denominator") by the owner's age in
//   the distribution year. Source: 26 CFR § 1.401(a)(9)-9(c), the Uniform Lifetime Table (Table 2),
//   read from law.cornell.edu/cfr/text/26/1.401(a)(9)-9 on 2026-10-01 (eCFR and the IRS Pub. 590-B
//   PDF were not machine-readable). Effective for distribution years from 2022; the same figures as
//   Pub. 590-B Appendix B, Table III. Ages 120 and over: 2.0.
// Start age (SECURE 2.0 Act § 107): 75 for owners born in 1960 or later, 73 for those born 1951–
//   1959, 72 for earlier birth years (people born before July 1, 1949 started at 70½; they are
//   already taking RMDs and are not modeled). The first RMD may be delayed to April 1 of the next
//   year; that option is not modeled (the projection takes it in the start year).
// Pre-tax accounts only: Roth IRAs have no RMDs for the owner, and designated Roth accounts in
//   401(k)/403(b) plans have none since 2024 (SECURE 2.0 § 325).
export const UNIFORM_LIFETIME_TABLE = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3,
  99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8,
  117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};

export const RMD_START_AGES = [
  { fromBirthYear: 1960, startAge: 75 },
  { fromBirthYear: 1951, startAge: 73 },
  { fromBirthYear: -Infinity, startAge: 72 },
];
