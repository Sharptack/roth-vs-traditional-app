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

// Yearly contributions for `contributeYears`, then left to grow untouched until `years` (a spouse
// who retires earlier, in a household that retires when the last of them does).
export function futureValueContributions(payment, returnRate, contributeYears, years) {
  return futureValueAnnuity(payment, returnRate, contributeYears) * Math.pow(1 + returnRate, years - contributeYears);
}

// A taxable account that pays qualified dividends (tax drag, round 2 phase 2 step c). Each year the
// dividends (dividendYield x the balance at the start of the year) are taxed at taxRate; the tax is
// paid out of them and the rest reinvested, adding to cost basis. The balance grows at returnRate
// (dividends included) less that tax; payments are added at the end of each of the first
// contributeYears years (as futureValueAnnuity), all of them basis.
// -> { value, basis }. With no dividends: exactly futureValueLumpSum + futureValueContributions.
export function growTaxable({ start = 0, basis = start, payment = 0, contributeYears, years, returnRate, dividendYield = 0, taxRate = 0 }) {
  const paidYears = contributeYears ?? years;
  if (!(dividendYield > 0)) {
    return {
      value: futureValueLumpSum(start, returnRate, years) + futureValueContributions(payment, returnRate, paidYears, years),
      basis: basis + payment * paidYears,
    };
  }
  let value = start;
  let cost = basis;
  for (let t = 0; t < years; t++) {
    const dividends = value * dividendYield;
    const tax = dividends * taxRate;
    value = value * (1 + returnRate) - tax;
    cost += dividends - tax;
    if (t < paidYears) {
      value += payment;
      cost += payment;
    }
  }
  return { value, basis: cost };
}

// The taxed share of a retirement withdrawal from a taxable account (withdrawalRate x its balance)
// when the account pays dividends: the dividends (dividendYield x the balance) are part of the
// withdrawal and taxed whole; the rest is a sale, taxed on its gain share.
//   (dividendYield + (withdrawalRate - dividendYield) x gainShare) / withdrawalRate
// With no dividends: gainShare.
export function taxedShareOfWithdrawal(gainShare, dividendYield, withdrawalRate) {
  if (!(dividendYield > 0)) return gainShare;
  const y = Math.min(dividendYield, withdrawalRate);
  return (y + (withdrawalRate - y) * gainShare) / withdrawalRate;
}
