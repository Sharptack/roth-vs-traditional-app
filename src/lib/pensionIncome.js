// A pension as household income (decided 2026-10-08: a pension is an income row, counted by every
// calculator). Pure. Everything else in the plan is in today's dollars, so the pension is too:
//
//   monthly          the monthly payment at its start, as the plan states it (for a pension already
//                    being paid: what is paid now)
//   startAge         the owner's age when it starts
//   cola             its yearly cost-of-living increase (0 = none)
//
// Real annual amount at the owner's age `age` (0 before it starts), with k = years until it starts:
//   12 × monthly ÷ (1 + inflation)^k × ((1 + cola) ÷ (1 + inflation))^(age − max(startAge, ageNow))
// A pension with no COLA loses value each year at the inflation rate; one whose COLA matches
// inflation keeps it. Survivor benefits wait for survivor years (phase 2): until then the pension is
// paid in full for the whole projection.
export function pensionIncomeAt({ monthly, startAge, cola = 0 }, { ageNow, age, inflation = 0 }) {
  if (!(monthly > 0) || !(age >= startAge)) return 0;
  const yearsUntilStart = Math.max(0, startAge - ageNow);
  const yearsPaid = age - Math.max(startAge, ageNow);
  return ((12 * monthly) / (1 + inflation) ** yearsUntilStart) * ((1 + cola) / (1 + inflation)) ** yearsPaid;
}

// The household's pensions at year t of the projection (t = 0 is this year), each owner at their
// own age then. household.pensions: [{ owner, monthly, startAge, cola, survivorShare }]; absent =
// none. deceased: the id of a person who has died (survivor years, projection.js): their pensions
// continue at their survivor share (0 when none was entered), on the same schedule.
export function pensionIncomeInYear(household, t, { deceased = null } = {}) {
  const { year, people, pensions = [], assumptions } = household;
  const inflation = assumptions?.inflationRate ?? 0;
  return pensions.reduce((sum, p) => {
    const owner = people.find((x) => x.id === p.owner);
    if (!owner) return sum;
    const ageNow = year - owner.birthYear;
    const share = p.owner === deceased ? (p.survivorShare ?? 0) : 1;
    return sum + share * pensionIncomeAt(p, { ageNow, age: ageNow + t, inflation });
  }, 0);
}
