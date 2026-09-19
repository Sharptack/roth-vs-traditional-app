// Compound-growth helpers.

// Future value of a single lump sum: PV * (1 + r)^years
export function futureValueLumpSum(presentValue, returnRate, years) {
  return presentValue * Math.pow(1 + returnRate, years);
}

// Future value of an ordinary annuity (equal payment at the END of each year):
//   payment * ((1 + r)^years - 1) / r
// With a 0% rate the formula is 0/0, so it falls back to payment * years.
export function futureValueAnnuity(payment, returnRate, years) {
  if (returnRate === 0) return payment * years;
  return payment * ((Math.pow(1 + returnRate, years) - 1) / returnRate);
}
