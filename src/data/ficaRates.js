// FICA payroll-tax parameters by year (employee share only).
//
// TO ADD A YEAR: copy the 2025 object, change the key and numbers.
//
//   socialSecurityRate  6.2% on wages up to the wage base
//   wageBase            annual maximum earnings subject to the Social Security
//                       portion (also the cap on earnings that count toward
//                       Social Security benefits — see socialSecurity.js)
//   medicareRate        1.45% on ALL wages, no cap
//   additionalMedicare  extra 0.9% on wages above a filing-status threshold.
//                       The thresholds are fixed by statute (not indexed).
//
// Assumes W-2 wages. Self-employed people pay both halves (15.3%); not modeled.
//
// Sources: IRS Topic 751 (rates; 2026 wage base $184,500) and Topic 560
// (Additional Medicare thresholds $200,000 / $250,000 MFJ). The 2025 wage base of
// $176,100 is from SSA (corroborated; SSA's site blocked direct retrieval).
export const FICA_RATES = {
  2025: {
    socialSecurityRate: 0.062,
    wageBase: 176100,
    medicareRate: 0.0145,
    additionalMedicare: {
      rate: 0.009,
      threshold: { single: 200000, mfj: 250000 },
    },
  },
  2026: {
    socialSecurityRate: 0.062,
    wageBase: 184500,
    medicareRate: 0.0145,
    additionalMedicare: {
      rate: 0.009,
      threshold: { single: 200000, mfj: 250000 },
    },
  },
};
