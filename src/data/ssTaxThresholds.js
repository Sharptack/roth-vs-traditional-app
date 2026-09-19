// Combined-income thresholds for taxation of Social Security benefits, by filing
// status.
//
// "Combined income" = other income + 50% of the Social Security benefit.
//   - at or below `lower`: 0% of benefits taxable
//   - between `lower` and `upper`: up to 50% of benefits taxable
//   - above `upper`: up to 85% of benefits taxable
//
// These amounts are fixed by statute (IRC §86) and have NOT been inflation-
// adjusted since they took effect (the 50% tier in 1984, the 85% tier in 1993).
// The data is keyed by the year a set of thresholds took effect, purely so the
// structure matches the other data files: if Congress ever indexes them, add a
// new year key and everything downstream picks it up.
export const SS_TAX_THRESHOLDS = {
  1984: {
    single: { lower: 25000, upper: 34000 },
    mfj: { lower: 32000, upper: 44000 },
  },
};
