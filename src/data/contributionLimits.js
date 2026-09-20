// Annual employee contribution limits by tax year and account type.
//
// TO ADD A YEAR: copy the 2025 object, change the key and numbers.
//
// Base limits only. Age-based catch-up contributions (50+, and the higher 60–63
// 401(k) catch-up) and income phase-outs for IRAs are not modeled.
//   401k: employee elective deferral limit (IRC §402(g)) — $23,500 for 2025
//   ira:  combined Traditional + Roth IRA limit (IRC §219(b)) — $7,000 for 2025
//
// Source: IRS Notice 2025-67 / "401(k) limit increases to $24,500 for 2026, IRA
// limit increases to $7,500" (irs.gov/newsroom). 2025 figures from the same
// announcement's prior-year comparison ($23,500 and $7,000).
export const CONTRIBUTION_LIMITS = {
  2025: {
    '401k': 23500,
    ira: 7000,
  },
  2026: {
    '401k': 24500,
    ira: 7500,
  },
};
