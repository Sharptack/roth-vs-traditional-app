// "Use in the plan" (round 2, How the plan fits together; built as a trial on the Roth page in
// phase 1): a decision calculator writes the chosen option back into the household. Pure.
//
// The Roth vs. Pre-tax comparison weighs the two at the same take-home cost, so switching the plan
// to the other type keeps that cost: each person's Future Contributions become the other type, at
// the amount the comparison itself worked out for it (contributionSplit; for example $10,000
// Pre-tax at a 22% rate = $7,800 Roth). Switching back gives the first amount again.
// Only for a household whose savings are all one type (Roth or Pre-tax): a mix is the open item
// on more than one contribution type per person.

const ROTH_OR_PRETAX = ['roth', 'pretax'];

// -> null (nothing to switch, or an invalid result), or
//    { current, other, winner, currentTotal, otherTotal, amounts: { [owner]: amount } }
export function contributionSwitch(values, household, result) {
  if (!result.valid) return null;
  const ids = household.people.map((p) => p.id);
  const rows = values.contributions.filter((r) => ids.includes(r.owner) && ROTH_OR_PRETAX.includes(r.tax));
  const types = new Set(rows.map((r) => r.tax));
  if (rows.length === 0 || types.size !== 1) return null;
  const current = [...types][0];
  const other = current === 'roth' ? 'pretax' : 'roth';
  const split = result.contributionSplit;
  const perPerson = split.people ?? [split];
  const amounts = {};
  household.people.forEach((p, i) => {
    const s = perPerson[household.people.length === perPerson.length ? i : 0][other];
    if (rows.some((r) => r.owner === p.id)) amounts[p.id] = Math.round(s.toAccount + s.excessToTaxable);
  });
  const total = (type) => Math.round(split[type].toAccount + split[type].excessToTaxable);
  return { current, other, winner: result.comparison.winner, currentTotal: total(current), otherTotal: total(other), amounts };
}

// The values with each person's Roth/Pre-tax rows switched to `other` at the new amounts (a
// person's amount spread over their rows in proportion to the rows' amounts today).
export function applyContributionSwitch(values, sw) {
  const rowsOf = (owner) => values.contributions.filter((r) => r.owner === owner && ROTH_OR_PRETAX.includes(r.tax));
  return {
    ...values,
    contributions: values.contributions.map((r) => {
      if (!ROTH_OR_PRETAX.includes(r.tax) || sw.amounts[r.owner] === undefined) return r;
      const mine = rowsOf(r.owner);
      const today = mine.reduce((a, x) => a + (Number(x.amount) || 0), 0);
      const share = today > 0 ? (Number(r.amount) || 0) / today : 1 / mine.length;
      return { ...r, tax: sw.other, amount: String(Math.round(sw.amounts[r.owner] * share)) };
    }),
  };
}
