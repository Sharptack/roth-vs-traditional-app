// Annual employee contribution limits by tax year and account type.
//
// TO ADD A YEAR: copy the 2025 object, change the key and numbers.
//
//   base          the elective-deferral limit everyone gets.
//   catchUp50     extra allowed once you turn 50, on top of `base`.
//   catchUp60to63 SECURE 2.0's ENHANCED 401(k) catch-up: replaces (not adds to)
//                 catchUp50 for the specific ages 60, 61, 62 and 63 — a person
//                 who is 50-59 or 64+ gets catchUp50, not this. IRAs have no
//                 such enhanced tier (undefined here).
//
//   401k: employee elective deferral limit (IRC §402(g)) — $23,500 base for 2025
//   ira:  combined Traditional + Roth IRA limit (IRC §219(b)) — $7,000 base for 2025
//
// Income phase-outs for IRA deductibility are not modeled.
//
// Sources: IRS Notice 2024-80 (2025 catch-up amounts: 401(k) $7,500 / age
// 60-63 $11,250; IRA $1,000) and "401(k) limit increases to $24,500 for 2026,
// IRA limit increases to $7,500" (irs.gov/newsroom; 2026 catch-up amounts:
// 401(k) $8,000 / age 60-63 $11,250 unchanged; IRA $1,100). Base limits from
// the same announcement's prior-year comparison ($23,500 / $7,000 for 2025).
export const CONTRIBUTION_LIMITS = {
  2025: {
    '401k': { base: 23500, catchUp50: 7500, catchUp60to63: 11250 },
    ira: { base: 7000, catchUp50: 1000 },
  },
  2026: {
    '401k': { base: 24500, catchUp50: 8000, catchUp60to63: 11250 },
    ira: { base: 7500, catchUp50: 1100 },
  },
};
