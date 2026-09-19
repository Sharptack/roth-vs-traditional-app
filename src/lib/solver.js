// Generic binary-search solver for a monotonic INCREASING function.
//
// Both retirement-income solvers (incomeNeed.js — solve for a gross withdrawal;
// portfolioTax.js — solve for a portfolio scale factor) reduce to: "find x >= 0
// such that f(x) = target", where f is after-tax income as a function of how
// much is withdrawn. After-tax income rises with every extra dollar withdrawn
// (even at the steepest stack — 37% bracket plus the 85% Social Security
// inclusion — you keep ~31 cents of the dollar), so bisection is safe and
// avoids deriving piecewise breakpoints by hand.
//
// Returns { x, bracketed }:
//   - if f(lo) >= target, x = lo (nothing needs to be withdrawn)
//   - otherwise doubles the upper bound until f(hi) >= target, then bisects
//   - bracketed = false only if the target could not be reached below maxHi
//     (e.g. f is flat because there is nothing to withdraw)
export function solveMonotonicIncreasing(
  f,
  target,
  { lo = 0, hiStart = 1, maxHi = 1e12, iterations = 100 } = {},
) {
  if (f(lo) >= target) return { x: lo, bracketed: true };

  let hi = Math.max(hiStart, lo + 1);
  while (f(hi) < target) {
    if (hi >= maxHi) return { x: hi, bracketed: false };
    hi *= 2;
  }

  let low = lo;
  for (let i = 0; i < iterations; i++) {
    const mid = (low + hi) / 2;
    if (f(mid) < target) low = mid;
    else hi = mid;
  }
  return { x: (low + hi) / 2, bracketed: true };
}
