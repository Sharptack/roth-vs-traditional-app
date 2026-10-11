// The Social Security calculator (round 2 phase 5, a decision): when should each person claim? From
// the household: each person's table by claiming age (the other held at the plan's), break-even
// ages, and for a couple the grid of every pair. Gross benefits (tax stays in the other
// calculators), in today's dollars, to each person's plan-to age. Pure; the math is
// socialSecurityLifetime.js and socialSecurityClaiming.js.
import { DEFAULT_END_AGE, socialSecuritySchedule } from './projection.js';
import { breakEvenAge, claimingGrid, lifetimeBenefits, openClaimAges } from './socialSecurityLifetime.js';
import { getFullRetirementAgeMonths } from './socialSecurity.js';
import { addRow, updateRow } from './householdValues.js';

// Each person as the lifetime functions take them, with the plan's claiming age.
//   pia: entered, or estimated from earnings (0 = none of their own); receiving: the monthly check.
export function claimingPeople(household) {
  const schedule = socialSecuritySchedule(household);
  return household.people.map((p, i) => {
    const receiving = p.socialSecurity.mode === 'receiving' || p.socialSecurity.known;
    const base = {
      id: p.id,
      birthYear: p.birthYear,
      planToAge: Number.isFinite(p.planToAge) ? p.planToAge : DEFAULT_END_AGE,
      mode: p.socialSecurity.mode,
      sex: p.sex,
    };
    if (receiving) return { ...base, receiving: schedule[i].own / 12, planClaimAge: null };
    return { ...base, pia: schedule[i].pia ?? 0, planClaimAge: schedule[i].ownStartAge };
  });
}

// The break-even pairs: the first open age, full retirement age (whole years, rounded up) and 70.
function breakEvens(p, open, discountRate) {
  const fra = Math.ceil(getFullRetirementAgeMonths(p.birthYear) / 12);
  const anchors = [...new Set([open[0], fra, 70])].filter((a) => a >= open[0]).sort((a, b) => a - b);
  if (anchors.length < 2) return [];
  const pairs = anchors.slice(1).map((a, i) => [anchors[i], a]);
  if (anchors.length > 2) pairs.push([anchors[0], anchors.at(-1)]);
  return pairs.map(([earlyAge, lateAge]) => ({
    earlyAge,
    lateAge,
    age: breakEvenAge({ pia: p.pia, birthYear: p.birthYear, earlyAge, lateAge, discountRate }),
  }));
}

export function socialSecurityView(household) {
  const { year } = household;
  const discountRate = household.calculators?.socialSecurity?.discountRate ?? 0;
  const people = claimingPeople(household);
  const planAges = people.map((p) => p.planClaimAge);
  const run = (claimAges) => lifetimeBenefits({ year, people, claimAges, discountRate });
  const plan = run(planAges);
  const tables = people.map((p, i) => {
    const open = openClaimAges(p, year);
    if (p.receiving !== undefined) return { id: p.id, receiving: true, monthly: p.receiving, rows: [], breakEvens: [] };
    const rows = open.map((claimAge) => {
      const claimAges = planAges.map((a, j) => (j === i ? claimAge : a));
      const r = run(claimAges);
      const ownYear = r.years.find((y) => y.streams[i].own > 0);
      return {
        claimAge,
        inPlan: claimAge === p.planClaimAge,
        monthly: ownYear ? ownYear.streams[i].own / 12 : 0,
        ownTotal: r.people[i].own,
        householdTotal: r.discountedTotal,
      };
    });
    const best = rows.reduce((b, r) => (r.householdTotal > b.householdTotal ? r : b), rows[0]);
    return { id: p.id, receiving: false, pia: p.pia, rows, best, breakEvens: p.pia > 0 ? breakEvens(p, open, discountRate) : [] };
  });
  const grid = people.length === 2 ? claimingGrid({ year, people, discountRate }) : null;
  return { year, discountRate, people, plan, tables, grid };
}

// "Use in the plan": the person's claiming age, as the starting age of their Social Security row;
// with no row (estimated from earnings, claiming at retirement), a row added to estimate from
// earnings at that age.
export function applyClaimAge(values, personId, age) {
  const row = values.incomes.find((r) => r.owner === personId && r.type === 'socialSecurity');
  if (row) return updateRow(values, 'incomes', row.id, 'fromAge', String(age));
  return addRow(values, 'incomes', { owner: personId, type: 'socialSecurity', ssMode: 'estimate', amount: '', fromAge: String(age), toAge: '' });
}
