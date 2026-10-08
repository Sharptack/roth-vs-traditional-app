// The qualified business income (QBI) deduction, IRC §199A, by tax year.
//
//   threshold    taxable income (before the QBI deduction) up to which the basic 20% applies in full
//   phaseInEnd   where the limits for businesses with no W-2 wages or property, and for specified
//                service businesses, have fully applied (threshold + $50,000 / $100,000 in 2025;
//                + $75,000 / $150,000 from 2026)
//   minimum      from 2026: a deduction of at least `amount` for at least `qbi` of QBI from a
//                business the taxpayer materially participates in (OBBBA §70105); null before.
//
// Sources: Rev. Proc. 2025-32 §4.26 (2026: $201,750 / $276,750 single and other returns,
// $403,500 / $553,500 joint) and §3.12 (the $400 / $1,000 minimum, indexed from 2027);
// Rev. Proc. 2024-40 (2025: $197,300 / $247,300, $394,600 / $494,600; via RSM's summary).
export const QBI = {
  2025: {
    single: { threshold: 197300, phaseInEnd: 247300 },
    mfj: { threshold: 394600, phaseInEnd: 494600 },
    minimum: null,
  },
  2026: {
    single: { threshold: 201750, phaseInEnd: 276750 },
    mfj: { threshold: 403500, phaseInEnd: 553500 },
    minimum: { qbi: 1000, amount: 400 },
  },
};
