// The child tax credit (IRC §24) and the credit for other dependents, by tax year.
//
//   perChild        the credit for each qualifying child (under 17 at the end of the year)
//   refundable      the most of it per child that can be paid out beyond the tax owed (the
//                   additional child tax credit), limited also to 15% of earned income over $2,500
//   otherDependent  the credit for each other dependent (never refundable)
//
// Fixed by the law, not indexed (CHILD_TAX_CREDIT_RULES): the phase-out, $50 for each $1,000 (or
// part of $1,000) of modified AGI over $200,000 ($400,000 joint); the 15% and $2,500 of the
// refundable limit; the age limit.
//
// Sources: Rev. Proc. 2025-32 §3.03 and §3.05 (2025 $2,200 under the OBBBA; 2026 $2,200, refundable
// $1,700); IRC §24(h) as amended by the OBBBA (the $200,000 / $400,000 phase-out, the $500 credit
// for other dependents, the $1,700 refundable amount for 2025).
export const CHILD_TAX_CREDIT = {
  2025: { perChild: 2200, refundable: 1700, otherDependent: 500 },
  2026: { perChild: 2200, refundable: 1700, otherDependent: 500 },
};

export const CHILD_TAX_CREDIT_RULES = {
  phaseOutStart: { single: 200000, mfj: 400000 },
  phaseOutPer1000: 50,
  refundableRate: 0.15,
  refundableEarnedFloor: 2500,
  childAgeLimit: 17, // a qualifying child is under 17 at the end of the year
};
