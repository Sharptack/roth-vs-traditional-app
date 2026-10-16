// The Social Security calculator (round 2 phase 5, a decision): when should each person claim? From
// the household: each person's table by claiming age (the other held at the plan's), break-even
// ages, and for a couple the grid of every pair. Gross benefits (tax stays in the other
// calculators), in today's dollars, to each person's plan-to age. Pure; the math is
// socialSecurityLifetime.js and socialSecurityClaiming.js.
import { DEFAULT_END_AGE, runProjection, socialSecuritySchedule } from './projection.js';
import { heirsOf, legacyOption, sustainableSpending } from './projectionSummary.js';
import { conversionTotals } from './conversionLifetime.js';
import { strategyById } from './strategies.js';
import { benefitCrossings, breakEvenAge, claimingGrid, cumulativeCurve, lifetimeBenefits, openClaimAges } from './socialSecurityLifetime.js';
import { getFullRetirementAgeMonths } from './socialSecurity.js';
import { addRow, updateRow } from './householdValues.js';
import { deathRates, survival, survivalCurve } from './lifeTable.js';
import { LIFE_TABLE } from '../data/lifeTable.js';

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
  // pairs: every pair of claiming ages (one person: one row); grid: the same, for a couple only.
  const pairs = claimingGrid({ year, people, discountRate });
  const grid = people.length === 2 ? pairs : null;
  const inflationRate = household.assumptions?.inflationRate || 0;
  return { year, discountRate, inflationRate, people, plan, tables, pairs, grid };
}

// The strategies compared on the page (before phase 6, asked 2026-10-12): each a set of claiming
// ages (one per person) found among the view's pairs (a pair not open is left out), with its
// running-total curve (cumulativeCurve), and every crossing between two of them (benefitCrossings:
// a and b index the strategies; leader is the one ahead after it).
// -> { strategies: [{ claimAges, cell, curve }], crossings: [{ a, b, age, leader }] }
export function strategyCompare(view, list) {
  const strategies = list
    .map((claimAges) => view.pairs.cells.find((c) => c.claimAges.every((a, i) => a === claimAges[i])))
    .filter(Boolean)
    .map((cell) => ({ claimAges: cell.claimAges, cell, curve: cumulativeCurve(cell) }));
  const crossings = strategies.flatMap((sa, a) =>
    strategies.slice(a + 1).flatMap((sb, k) => {
      const b = a + 1 + k;
      return benefitCrossings(sa.cell, sb.cell).map((x) => ({ a, b, age: x.age, leader: x.leader === 'a' ? a : b }));
    }),
  );
  return { strategies, crossings };
}

// "Use in the plan": the person's claiming age, as the starting age of their Social Security row;
// with no row (estimated from earnings, claiming at retirement), a row added to estimate from
// earnings at that age.
export function applyClaimAge(values, personId, age) {
  const row = values.incomes.find((r) => r.owner === personId && r.type === 'socialSecurity');
  if (row) return updateRow(values, 'incomes', row.id, 'fromAge', String(age));
  return addRow(values, 'incomes', { owner: personId, type: 'socialSecurity', ssMode: 'estimate', amount: '', fromAge: String(age), toAge: '' });
}

// The plan effect (phase 5 step e, decided 2026-10-10): for each person's open claiming age, the
// other's held as in the plan, the whole plan rerun: sustainable spending (with the legacy goal, as
// the evaluators), and at the spending need the lifetime tax (federal income tax + IRMAA) and what
// is left for heirs after tax. Someone already receiving has no rows.
// -> [{ id, rows: [{ claimAge, inPlan, sustainable, lifetimeTax, legacyAfterTax }] }]
export function claimingPlanEffect(household, need) {
  const own = household.calculators?.projection ?? {};
  const options = { endAge: own.endAge, strategy: strategyById(own.strategy) };
  const legacy = legacyOption(household);
  const { heirTaxRate, charityShare } = heirsOf(household);
  const people = claimingPeople(household);
  return people.map((p, i) => {
    if (p.receiving !== undefined) return { id: p.id, rows: [] };
    const rows = openClaimAges(p, household.year).map((claimAge) => {
      const h = {
        ...household,
        people: household.people.map((x, j) => (j === i ? { ...x, socialSecurity: { ...x.socialSecurity, claimAge } } : x)),
      };
      const totals = conversionTotals(runProjection(h, { ...options, need }).rows, heirTaxRate, charityShare);
      return {
        claimAge,
        inPlan: claimAge === p.planClaimAge,
        sustainable: sustainableSpending(h, { ...options, legacy }),
        lifetimeTax: totals.lifetimeTax,
        legacyAfterTax: totals.legacyAfterTax,
      };
    });
    return { id: p.id, rows };
  });
}

// The chance of being alive at each age (phase 5 step f): SSA's period life table by sex (lifeTable.js;
// sex not entered = the two averaged), from each person's age now. One age axis for both: from the
// older person's age now to 105. reach: each person's chance of reaching their break-even ages
// and their life expectancy in the plan.
// -> { ages, series: [{ id, points: [{ x, y }] }], reach: [{ id, marks: [{ kind, age, chance, label }] }] }
export function survivalView(view, table = LIFE_TABLE) {
  const { year, people, tables } = view;
  const now = people.map((p) => year - p.birthYear);
  const qs = people.map((p) => deathRates(table, p.sex));
  const chance = (i, age) => (age <= now[i] ? 1 : survival(qs[i], now[i], Math.round((age - now[i]) * 12)));
  const start = Math.max(...now);
  const ages = Array.from({ length: Math.max(1, 105 - start + 1) }, (_, k) => start + k);
  return {
    ages,
    series: people.map((p, i) => ({ id: p.id, points: ages.map((x) => ({ x, y: chance(i, x) })) })),
    reach: people.map((p, i) => ({
      id: p.id,
      marks: [
        ...(tables[i].breakEvens ?? [])
          .filter((b) => b.age !== null)
          .map((b) => ({ kind: 'breakEven', age: b.age, chance: chance(i, b.age), label: `${b.lateAge} vs. ${b.earlyAge}` })),
        { kind: 'planTo', age: p.planToAge, chance: chance(i, p.planToAge), label: 'life expectancy in the plan' },
      ],
    })),
    joint: people.length === 2 ? jointSurvival(qs, now) : null,
  };
}

// A couple's joint odds (asked 2026-10-16), the two lives taken as independent: at each of the
// first person's ages that is a multiple of 5 (after their age now, to 100), the chance each is
// alive, both are, and at least one is (1 − both gone). expected: the years until the first death
// and until the second, each month counted by the chance of both (or either) being alive through
// it (the average of its start and end, as lifeExpectancy).
// -> { rows: [{ years, ages, alive: [a, b], both, either }], expected: { first, second } }
export function jointSurvival(qs, now) {
  const curves = qs.map((q, i) => survivalCurve(q, now[i]));
  const at = (i, k) => curves[i][k] ?? 0;
  const both = (k) => at(0, k) * at(1, k);
  const either = (k) => at(0, k) + at(1, k) - both(k);
  const months = Math.max(...curves.map((c) => c.length));
  let first = 0;
  let second = 0;
  for (let k = 1; k < months; k++) {
    first += (both(k - 1) + both(k)) / 2;
    second += (either(k - 1) + either(k)) / 2;
  }
  const rows = [];
  for (let age = (Math.floor(now[0] / 5) + 1) * 5; age <= 100; age += 5) {
    const years = age - now[0];
    const k = years * 12;
    rows.push({ years, ages: [age, now[1] + years], alive: [at(0, k), at(1, k)], both: both(k), either: either(k) });
  }
  return { rows, expected: { first: first / 12, second: second / 12 } };
}
