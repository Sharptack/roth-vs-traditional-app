// The household's children and other dependents, as the child tax credit counts them (round 2
// phase 1). Pure. household.dependents: [{ kind: 'child' | 'other', age }] (householdV2.js), a
// child's age being the age reached this calendar year.

// The counts for a year `yearsFromNow` years ahead: children still under 17 (by the age they reach
// that calendar year), and other dependents (this year only: whether an adult stays a dependent
// isn't something the plan can know).
export function dependentsInYear(household, yearsFromNow = 0) {
  const list = household.dependents ?? [];
  return {
    children: list.filter((d) => d.kind === 'child' && d.age !== null && d.age + yearsFromNow < 17).length,
    otherDependents: yearsFromNow === 0 ? list.filter((d) => d.kind === 'other').length : 0,
  };
}
