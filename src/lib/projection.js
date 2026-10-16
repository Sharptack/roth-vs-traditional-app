// The year-by-year projection (roadmap phase 4). Pure. Starts TODAY (decided 2026-10-01): the
// working years are projected too, so the projection page is the pre-retirement planner.
//
// One loop, this year to the end age (person 1's), in today's dollars (a real return; brackets and
// limits fixed in today's terms; the fixed-dollar thresholds shrink at the inflation rate through
// calculateYearTax's thresholdScale). Each year, in order:
//   1. Ages; who is still working (age < their retirement age); Social Security for each person
//      who has reached their claiming age (own benefit), and the spousal top-up once it starts.
//   2. Contributions from each person still working: their own amount, capped at their IRS limit
//      for THIS year's age (so catch-up starts at 50); any excess goes to a taxable account (basis).
//   3. The RMD floor for each owner's Pre-tax accounts (rmd.js), on the balance at the start of the
//      year (= the end of the year before).
//   4. Once anyone has retired, the strategy picks withdrawals so after-tax cash = the spending
//      need. While everyone works there is no need to meet from the portfolio (the budget is the
//      paycheck); only RMDs are taken. The engine enforces at least the RMD and at most the balance,
//      whatever the strategy returns.
//   5. Tax on the whole year (calculateYearTax): wages, Pre-tax deferrals, Pre-tax withdrawals,
//      conversions and pensions as ordinary income, the gain part of taxable withdrawals, Social Security.
//   6. Surplus (an RMD that leaves more than the need) is reinvested in a taxable account as basis.
//      A shortfall (everything withdrawn and still short) is recorded, with the year money ran out.
//   7. Cost basis falls pro-rata with withdrawals; what is left grows at the return; contributions
//      and reinvested surplus are added at the end of the year (as futureValueAnnuity assumes).
//
// After-tax cash in a year = wages + Social Security + pensions + withdrawals − all tax (income and payroll)
// − the year's contributions (they are paid out of that cash) − any Medicare IRMAA surcharge.
//
// IRMAA (assumptions.medicareIrmaa; off when absent): each person 65 or older pays the Part B and
// Part D surcharges set by the household's MAGI two years earlier (lib/irmaa.js). The surcharge is
// known at the start of the year, so it is a fixed cost the strategy meets like tax. The two years
// before the first projected year are taken to have the first year's MAGI without its conversions
// (decided 2026-10-13: a conversion this year can't have set past premiums; for the first year
// itself, as worked out before its surcharge). While everyone is still working the surcharge is
// recorded but, like tax, comes out of the paycheck. In the first retirement year of a
// one-person household this is exactly what the total portfolio section computes (tested).
//
// Survivor years (phase 2, decided 2026-10-09): a couple filing jointly where each person has a
// plan-to age. Each person lives through the year they reach it; only the first death is modeled
// (the survivor lives to the end age). The year of death stays joint; from the next year:
//   - filing status single (brackets, deductions, SS taxability, NIIT, IRMAA all follow it);
//     qualifying surviving spouse status (needs a dependent child) is not modeled
//   - Social Security (SSA survivor rules, phase 5, decided 2026-10-10; socialSecurityClaiming.js):
//     the spousal top-up ends; the survivor keeps their own benefit plus the excess of the survivor
//     benefit over it, from the later of the year after the death and their own claiming age (never
//     before 60). The survivor benefit: the deceased's benefit with delayed credits (at least 82.5%
//     of their PIA after an early claim; their PIA plus credits earned if they died before
//     claiming), reduced if started before survivor full retirement age. A deceased whose PIA isn't
//     known (a benefit entered as an amount, or already receiving) passes on that amount.
//   - the deceased's pensions continue at their survivor share; their wages and contributions stop
//   - spending: the need x assumptions.survivorSpending (default 80%)
//   - at the end of the year of death the deceased's accounts become the survivor's (a spousal
//     rollover: RMDs follow the survivor's age), and taxable accounts get a step-up in basis
// Without plan-to ages (version 1 households), or with both past the end age, nothing changes.
//
// Tax drag (phase 2 step c, decided 2026-10-09): assumptions.dividendYield, the qualified dividends a
// taxable account pays each year as a share of what stays invested (its balance less this year's
// withdrawal). Part of the return, not added to it. The dividends are taxed in the year (capital-gains
// rates and NIIT, through calculateYearTax, so they count in Social Security taxability, MAGI and
// IRMAA) and reinvested, adding to cost basis. Who pays the tax:
//   - once anyone has retired, the year's cash (the strategy withdraws enough to cover it)
//   - while everyone works, the account itself: the paycheck is the budget, so less of the dividend
//     is reinvested (tax = the year's tax with the dividends − without them; basis rises by the rest)
// A taxable account may have a yield of its own (accounts[i].dividendYield, step f); the accounts the
// projection opens (savings over the limit, reinvested surplus) take the assumption.
// Absent (version 1 households) = no dividends, as before.
//
// Employer contributions (phase 2 step d, decided 2026-10-09): each person still working gets their
// employer's 401(k) contribution (employerContributions.js: a match on the deferral as entered, or a
// flat amount), paid into their Pre-tax account at the end of the year. Not income this year and not
// out of the paycheck; the same whatever contributions override the plan's. Version 1: none.
//
// Returns (phase 2 step e, decided 2026-10-09): assumptions.returnRate while anyone still works,
// assumptions.retirementReturnRate once no one does (a couple: from the year the last retires, when the
// Roth comparison takes its snapshot). Absent = returnRate throughout, as before.
//
// The rest of the household (phase 2 step f, decided 2026-10-08/09): a version 2 household's income rows
// count in the years their ages cover (incomeRowCounts): earnings (W-2, 1099) and other income
// (ordinary, interest, qualified dividends, tax-exempt). A blank first age is from now; a blank last
// age is until the owner's retirement, or for life for a row that starts at or after it (part-time
// work, an annuity). After the first death the deceased's earnings stop; their other income goes on.
// Version 1 (no rows): each person's wages while working, as before.
// Surplus (assumptions.surplus): once anyone has retired, cash above the need; while everyone works,
// cash above what today's paycheck alone leaves (an RMD, income beyond the paycheck, after tax; a
// drop in earnings is taken as lower spending, not drawn). 'save' (the default) reinvests it in a
// taxable account; 'spend' spends it (spending rises in those years). While everyone works,
// assumptions.surplusWorking decides instead (phase 4, decided 2026-10-10; absent = as surplus, as
// before). Version 2 households: spent while working, saved in retirement, by default.
//
// A conversion this year (option convertNow, the Roth conversion calculator's lifetime view, decided
// 2026-10-09): that many dollars move from the Pre-tax accounts (pro rata by balance) to Roth in the
// first projected year, taxed as ordinary income that year.
//
// Who pays a conversion's tax (every conversion: a strategy's, convertNow; decided 2026-10-12,
// Michael): the conversion's tax = the year's tax with the conversions − without them.
//   - once anyone has retired: the strategy draws for spending only (its evaluate leaves the
//     conversions' tax out of the cash); then the taxable accounts pay the tax (more withdrawn from
//     them, pro rata by what is left, until the cash meets the need again; any gains on it taxed
//     too); what they can't cover is held back from the conversions (Pre-tax pays it; less reaches Roth)
//   - while everyone works: held back from the conversions
// The amount held back is the row's conversionTaxWithheld, spread over the conversions by size.
// Before 2026-10-12, in retirement the year's withdrawals (by the strategy's order) paid it.
//
// A pension taken as a lump sum (household.rollovers, decided 2026-10-09): rolled over to the owner's
// Pre-tax account at the start of the year they reach the pension's start age (the survivor's, after
// a death), after that year's RMD is set (it counts from the next year).
//
// Simplifications: spending is flat in today's dollars; earnings are flat (no raises); each return is
// constant.
import { calculateYearTax, calculateYearTaxTotals } from './yearTax.js';
import { calculateEmploymentTaxes } from './ficaTax.js';
import { estimateHouseholdSocialSecurity } from './socialSecurity.js';
import { SURVIVOR_EARLIEST_AGE, survivorAdjustmentFactor, survivorBenefitMonthly } from './socialSecurityClaiming.js';
import { checkContributionLimit } from './contributionLimits.js';
import { requiredMinimumDistribution } from './rmd.js';
import { solveMonotonicIncreasing } from './solver.js';
import { splitAtTakeHome } from './compare.js';
import { irmaaCost, medicareEnrollees } from './irmaa.js';
import { dependentsInYear } from './dependents.js';
import { pensionIncomesInYear } from './pensionIncome.js';
import { employerContributionFor } from './employerContributions.js';
import { IRMAA_LOOKBACK_YEARS } from '../data/irmaa.js';

export const DEFAULT_END_AGE = 95;

// One account's year (row.detail.accounts, phase 6 step a):
//   start - withdrawn - convertedOut + convertedIn + growth - dividendTax + contributed + employer
//   + reinvested = end   (projectionDetail.js accountFlowTotal)
// growth: the return on what stays invested (dividends are part of it); rmd: the required part of
// withdrawn; owner: the owner at the start of the year (a death passes the account on at its end).
const newFlow = (a, start) => ({
  id: a.id,
  owner: a.owner,
  type: a.type,
  start,
  withdrawn: 0,
  rmd: 0,
  convertedOut: 0,
  convertedIn: 0,
  growth: 0,
  dividends: 0,
  dividendTax: 0,
  contributed: 0,
  employer: 0,
  reinvested: 0,
  end: 0,
});
const hasActivity = (f) => Object.values(f).some((v) => typeof v === 'number' && Math.abs(v) > 0.005);
// Spending in survivor years, as a share of the couple's (assumptions.survivorSpending).
export const DEFAULT_SURVIVOR_SPENDING = 0.8;

// v1 strategy: proportional. The same fraction k of every account's start-of-year balance, with
// each Pre-tax account's RMD as a floor, k solved so after-tax cash meets the need.
//   ({ accounts, rmdByAccount, need, evaluate }) -> { withdrawals: { [accountId]: amount }, conversions: [] }
// evaluate(withdrawals) -> { cash, ... }: the engine's after-tax cash for those withdrawals.
export function proportionalStrategy({ accounts, rmdByAccount, need, evaluate }) {
  const at = (k) =>
    Object.fromEntries(accounts.map((a) => [a.id, Math.min(a.balance, Math.max(k * a.balance, rmdByAccount[a.id] ?? 0))]));
  // 50 halvings of k in [0, 1]: within 1e-15 of a balance, under a cent on any portfolio.
  const { x } = solveMonotonicIncreasing((k) => evaluate(at(k)).cash, need, { lo: 0, hiStart: 1, maxHi: 1, iterations: 50 });
  return { withdrawals: at(Math.min(1, x)), conversions: [] };
}

// Per-person Social Security for the projection: when each part starts, and how much it is.
// (Also the tax calculator's Social Security this year, socialSecurityInYear.)
// Whether an income row counts at this age (see the header): a blank last age is until retirement,
// or for life when the row starts at or after retirement. ageNow: the owner's age this year. For
// someone already retired (decided 2026-10-09) a blank first age is now, so other income (rent,
// interest) counts for life; earnings with no last age don't count (they ended at retirement).
const EARNINGS = ['w2', '1099'];
export function incomeRowCounts(row, age, retirementAge, ageNow = -Infinity) {
  const from = row.fromAge ?? null;
  if (from !== null && age < from) return false;
  if (row.toAge !== null && row.toAge !== undefined) return age <= row.toAge;
  const startsRetired = from !== null ? from >= retirementAge : !EARNINGS.includes(row.type) && ageNow >= retirementAge;
  return startsRetired || age < retirementAge;
}

export function socialSecuritySchedule(household) {
  const { year, people } = household;
  const ageOf = (p) => year - p.birthYear;
  const ss = estimateHouseholdSocialSecurity({
    earners: people.map((p) => {
      // Someone retired: the earnings of the work they left (householdV2 pastEarnings), else this year's.
      const { wages, selfEmploymentIncome } = p.pastEarnings ?? p;
      const pay = calculateEmploymentTaxes({ wages, selfEmploymentIncome, filingStatus: household.filingStatus, year });
      return {
        earnings: wages + pay.selfEmployment.netEarnings,
        currentAge: ageOf(p),
        claimAge: p.socialSecurity.claimAge ?? p.retirementAge,
        knowsSocialSecurity: p.socialSecurity.known,
        socialSecurityBenefit: p.socialSecurity.benefit,
        ...(p.socialSecurity.mode === 'pia' && { pia: p.socialSecurity.pia }),
      };
    }),
    year,
  });
  return people.map((p, i) => {
    const s = ss.people[i];
    // Already receiving (version 2): from now, at any age; a version 1 known benefit: its claiming age.
    const claimAge = p.socialSecurity.mode === 'receiving' ? ageOf(p) : s.known ? Math.min(70, Math.max(62, p.socialSecurity.claimAge ?? p.retirementAge)) : s.claimingAge;
    return {
      own: s.ownBenefit,
      ownStartAge: claimAge,
      topUp: s.spousalTopUp ?? 0,
      topUpStartAge: s.spousalStartAge ?? Infinity,
      // The PIA when known (entered or estimated), for the survivor benefit; null otherwise.
      pia: s.known ? null : s.pia,
    };
  });
}

// The household's Social Security in year t (0 = this year): each part that has started by then.
export function socialSecurityInYear(household, t) {
  // An age not entered yet (the form shows the error): nothing to work out. The retirement age is
  // needed only for a claim "at retirement": the tax page doesn't ask for it, and a benefit already
  // received or claimed at a set age counts without it (fixed 2026-10-16).
  const needsRetirementAge = (p) => p.socialSecurity.mode !== 'receiving' && !Number.isFinite(p.socialSecurity.claimAge);
  if (!household.people.every((p) => Number.isFinite(p.birthYear) && (Number.isFinite(p.retirementAge) || !needsRetirementAge(p)))) return 0;
  const ages = household.people.map((p) => household.year - p.birthYear + t);
  return socialSecuritySchedule(household).reduce(
    (acc, s, i) => acc + (ages[i] >= s.ownStartAge ? s.own : 0) + (ages[i] >= s.topUpStartAge ? s.topUp : 0),
    0,
  );
}

// household: the household object (its year is the first projected year).
// options:
//   need             the after-tax spending need once anyone has retired (today's dollars); the
//                    Roth calculator's retirement income number.
//   strategy         defaults to proportionalStrategy.
//   contributions    optional override, one entry per saver: [{ owner, amount, type: 'pretax' | 'roth' | 'taxable' }]
//                    ('taxable': straight to a taxable account as basis, no IRS limit),
//                    or [{ owner, takeHomeCost, rate, type }] (phase 6: the Roth and Pre-tax scenarios at
//                    the SAME take-home cost, split each year at that year's limit by splitAtTakeHome, so
//                    a Pre-tax saver over the limit invests the tax saved in a taxable account).
//                    Default: the household's Future Contributions as entered.
//   taxableSavings   optional override of the savings to a taxable account, [{ owner, amount }] (phase 4,
//                    decided 2026-10-10): each person's while they work, as basis, whatever the
//                    contributions. Default: the household's (futureContributions.taxableSavings; none in version 1).
//   endAge           person 1's age in the last projected year (default household.assumptions.endAge or 95).
//   retirementRateShift  added to every ordinary bracket rate in the years anyone is retired (a tax-law
//                    what-if: "rates 3 points higher in retirement"); default: the household's
//                    assumptions.retirementRateShift, else 0.
//   convertNow       a Roth conversion in the first projected year, in dollars (see the header).
//   yearChanges      the planner's changes for single years (phase 6 step b, decided 2026-10-12); default
//                    household.plannerChanges, none = today's results. Each alters its year (and, for
//                    'onward', the years after), never an earlier one:
//                    { year, kind: 'convert', owner, amount }: a Roth conversion that calendar year from
//                      the owner's Pre-tax accounts (pro rata by balance; the survivor's after a death),
//                      on top of the strategy's; its tax as any conversion's (see the header)
//                    { year, kind: 'contribution', row, amount, scope: 'year' | 'onward' }: a contribution
//                      row's amount (household.contributionRows) that year, or from that year on; for a
//                      row, the change from the latest year wins, and in its own year a 'year' change
//                      wins over an 'onward' one. The employer's match follows the changed amount. Not
//                      applied where the caller overrides the contributions (or taxable savings).
//   yearReturn       (rate, t) => this year's return, from the plan's return for the year (before or after
//                    retirement) and the year's index t (0 = the first year); Monte Carlo's random paths
//                    (phase 8). Default: the plan's return, today's results.
//   needIn           (t) => the need in year t (phase 9: spending that changes along a path, the
//                    guardrails); replaces need where given. Default: need every year.
//   rescale          { t, scale }: at the start of year t, every account's balance (and basis) times
//                    scale (phase 9: the plan from a later year at a given portfolio). Default: none.
export function runProjection(household, { need = 0, needIn, rescale, strategy = proportionalStrategy, contributions, taxableSavings, endAge, retirementRateShift, convertNow = 0, yearChanges = household.plannerChanges ?? [], yearReturn } = {}) {
  const { year, people, filingStatus, futureContributions: fc, assumptions } = household;
  // The household's own what-if (assumptions.retirementRateShift) unless a caller sets one.
  const rateShiftInRetirement = retirementRateShift ?? assumptions.retirementRateShift ?? 0;
  const workingReturn = assumptions.returnRate;
  const retiredReturn = assumptions.retirementReturnRate ?? workingReturn;
  const inflation = assumptions.inflationRate ?? 0;
  const lastAge = endAge ?? assumptions.endAge ?? DEFAULT_END_AGE;
  const age0 = people.map((p) => year - p.birthYear);
  const ss = socialSecuritySchedule(household);
  // Survivor years: only a couple filing jointly; a person with no plan-to age never dies.
  const survivorRules = people.length === 2 && filingStatus === 'mfj';
  const lastYearAlive = people.map((p) => (Number.isFinite(p.planToAge) ? p.planToAge : Infinity));
  const survivorSpending = assumptions.survivorSpending ?? DEFAULT_SURVIVOR_SPENDING;
  const dividendYield = assumptions.dividendYield ?? 0;
  const yieldOf = (a) => a.dividendYield ?? dividendYield;
  const spendSurplusRetired = assumptions.surplus === 'spend';
  const spendSurplusWorking = (assumptions.surplusWorking ?? assumptions.surplus) === 'spend';
  // Version 2: the income rows (earnings and other income) by their ages; version 1: none.
  const incomeRows = Array.isArray(household.incomes) ? household.incomes : null;
  let deceased = -1; // the index of the person who has died, from the year after their death
  let survivorSS = { annual: 0, startAge: Infinity }; // the survivor benefit, set at the death
  const plan = [
    ...(contributions ?? fc.contributions.map((c) => ({ owner: c.owner, amount: c.amount, type: c.currentType ?? fc.currentType }))),
    ...(taxableSavings ?? fc.taxableSavings ?? []).map((c) => ({ owner: c.owner, amount: c.amount, type: 'taxable' })),
  ];
  // Each saver's account type (their own, else the household's) sets their IRS limit.
  const accountTypeOf = (owner) => fc.contributions.find((c) => c.owner === owner)?.accountType ?? fc.accountType;

  // The planner's contribution changes (see yearChanges above): each row's amount in a year, and the
  // year's plan with the changed rows' differences added to their owner's entries.
  const contributionRows = household.contributionRows ?? [];
  const contributionChanges = yearChanges.filter((c) => c.kind === 'contribution' && contributionRows.some((r) => r.id === c.row));
  const rowAmountIn = (row, y) => {
    let best = null;
    for (const c of contributionChanges) {
      if (c.row !== row.id || !(c.scope === 'year' ? c.year === y : c.year <= y)) continue;
      if (!best || c.year > best.year || (c.year === best.year && c.scope === 'year')) best = c;
    }
    return best ? Math.max(0, best.amount) : row.amount;
  };
  // -> { plan, rows } for the year, or null when no change applies to it.
  const changedPlanIn = (y) => {
    if (contributionChanges.length === 0) return null;
    const rows = contributionRows.map((r) => ({ ...r, amount: rowAmountIn(r, y) }));
    if (rows.every((r, i) => r.amount === contributionRows[i].amount)) return null;
    const delta = (owner, taxable) =>
      rows.reduce((s, r, i) => (r.owner === owner && (r.tax === 'taxable') === taxable ? s + r.amount - contributionRows[i].amount : s), 0);
    const owners = people.map((p) => p.id);
    const adjusted = plan.map((c) => {
      const overridden = c.type === 'taxable' ? taxableSavings : contributions;
      return overridden ? c : { ...c, amount: Math.max(0, c.amount + delta(c.owner, c.type === 'taxable')) };
    });
    if (!taxableSavings) {
      for (const owner of owners) {
        const d = delta(owner, true);
        if (d > 0 && !adjusted.some((c) => c.owner === owner && c.type === 'taxable')) adjusted.push({ owner, amount: d, type: 'taxable' });
      }
    }
    return { plan: adjusted, rows };
  };

  // Working balances, one per account; contributions and surplus get accounts of their own.
  const accounts = household.accounts.map((a) => ({
    id: a.id,
    owner: a.owner,
    type: a.type,
    balance: a.balance,
    basis: a.type === 'taxable' ? a.balance * (a.basisShare ?? 0) : 0,
    ...(a.type === 'taxable' && Number.isFinite(a.dividendYield) && { dividendYield: a.dividendYield }),
  }));
  const accountFor = (owner, type) => {
    const id = `new-${type}-${owner}`;
    let a = accounts.find((x) => x.id === id);
    if (!a) {
      a = { id, owner, type, balance: 0, basis: 0 };
      accounts.push(a);
    }
    return a;
  };

  const rows = [];
  let runOutYear = null;
  let preProjectionMagi = 0; // IRMAA: the first year's MAGI without its conversions, set in that year
  for (let t = 0; age0[0] + t <= lastAge; t++) {
    const calendarYear = year + t;
    const ages = age0.map((a) => a + t);
    const alive = people.map((_, i) => i !== deceased);
    const survivorYear = deceased >= 0;
    const filingStatusThisYear = survivorYear ? 'single' : filingStatus;
    const working = people.map((p, i) => alive[i] && ages[i] < p.retirementAge);
    const anyRetired = people.some((_, i) => alive[i] && !working[i]);
    const planReturn = working.some(Boolean) ? workingReturn : retiredReturn;
    const returnRate = yearReturn ? yearReturn(planReturn, t) : planReturn;
    const thresholdScale = 1 / (1 + inflation) ** t;
    const ssOf = (i) => (ages[i] >= ss[i].ownStartAge ? ss[i].own : 0) + (ages[i] >= ss[i].topUpStartAge ? ss[i].topUp : 0);
    let socialSecurity;
    if (survivorYear) {
      // Their own (the spousal top-up ends) plus the excess of the survivor benefit over it.
      const s = 1 - deceased;
      const ownNow = ages[s] >= ss[s].ownStartAge ? ss[s].own : 0;
      socialSecurity = ownNow + (ages[s] >= survivorSS.startAge ? Math.max(0, survivorSS.annual - ownNow) : 0);
    } else socialSecurity = people.reduce((acc, _, i) => acc + ssOf(i), 0);
    // today's dollars (pensionIncome.js)
    const pensions = pensionIncomesInYear(household, t, { deceased: survivorYear ? people[deceased].id : null });
    const pension = pensions.reduce((s, p) => s + p.amount, 0);

    // The portfolio rescaled at the start of this year (see rescale above).
    if (rescale && rescale.t === t) {
      for (const a of accounts) {
        a.balance *= rescale.scale;
        a.basis *= rescale.scale;
      }
    }

    // 2. This year's contributions (paid in at the end of the year), with any planner change.
    const changed = changedPlanIn(calendarYear);
    const made = [];
    for (const c of changed ? changed.plan : plan) {
      const i = people.findIndex((p) => p.id === c.owner);
      if (i < 0 || !working[i] || !((c.amount ?? c.takeHomeCost) > 0)) continue;
      if (c.takeHomeCost !== undefined) {
        const limit = checkContributionLimit(c.takeHomeCost, accountTypeOf(c.owner), year, ages[i]).limit;
        const split = splitAtTakeHome(c.takeHomeCost, 'roth', c.rate, limit)[c.type];
        made.push({ owner: c.owner, type: c.type, toAccount: split.toAccount, excess: split.excessToTaxable });
        continue;
      }
      // type 'taxable' (phase 4's extra savings with no contribution rows): all of it to a taxable account.
      const limit = c.type === 'taxable' ? 0 : checkContributionLimit(c.amount, accountTypeOf(c.owner), year, ages[i]).limit;
      const toAccount = Math.min(c.amount, limit);
      made.push({ owner: c.owner, type: c.type, toAccount, excess: c.amount - toAccount });
    }
    const pretaxDeferrals = made.filter((m) => m.type === 'pretax').reduce((s, m) => s + m.toAccount, 0);
    // The employers' contributions (Pre-tax, paid in at the end of the year).
    const employerMade = people.map((p, i) => (working[i] ? employerContributionFor(household, p, ages[i], changed?.rows) : 0));
    const contributionCash = made.reduce((s, m) => s + m.toAccount + m.excess, 0);

    // 3. RMDs, per owner, spread over that owner's Pre-tax accounts by balance.
    const rmdByAccount = {};
    let rmdTotal = 0;
    people.forEach((p, i) => {
      const own = accounts.filter((a) => a.type === 'pretax' && a.owner === p.id && a.balance > 0);
      const total = own.reduce((s, a) => s + a.balance, 0);
      const { required } = requiredMinimumDistribution({ priorYearEndBalance: total, age: ages[i], birthYear: p.birthYear });
      if (required > 0) for (const a of own) rmdByAccount[a.id] = (required * a.balance) / total;
      rmdTotal += required;
    });

    // A pension's lump sum rolled over this year (see the header).
    for (const ro of household.rollovers ?? []) {
      const i = people.findIndex((p) => p.id === ro.owner);
      if (i < 0 || ages[i] !== ro.age || !(ro.amount > 0)) continue;
      accountFor(people[alive[i] ? i : 1 - i].id, 'pretax').balance += ro.amount;
    }

    // Medicare IRMAA this year (set by MAGI two years back; see the header). evaluate() subtracts it.
    const enrolled = assumptions.medicareIrmaa ? medicareEnrollees(ages.filter((_, i) => alive[i])) : 0;
    let irmaa = null;
    let irmaaThisYear = 0;

    // Earnings this year: the rows by age (version 2), else the wages while working. paycheck: today's
    // earnings while working, the base that income beyond the paycheck is measured against.
    const counts = (r) => {
      const i = people.findIndex((p) => p.id === r.owner);
      return i >= 0 && incomeRowCounts(r, ages[i], people[i].retirementAge, age0[i]);
    };
    const earnings = (i, type) =>
      incomeRows
        ? incomeRows.filter((r) => r.owner === people[i].id && r.type === type && counts(r)).reduce((s, r) => s + r.amount, 0)
        : working[i]
          ? people[i][type === 'w2' ? 'wages' : 'selfEmploymentIncome']
          : 0;
    // The share of a person's 1099 earnings this year from a business that qualifies for QBI.
    const qbiShareOf = (i, paycheckOnly) => {
      if (paycheckOnly || !incomeRows) return people[i].qbiShare ?? 1;
      const all = earnings(i, '1099');
      const qualifying = incomeRows.filter((r) => r.owner === people[i].id && r.type === '1099' && r.qbi !== false && counts(r)).reduce((s, r) => s + r.amount, 0);
      return all > 0 ? qualifying / all : 1;
    };
    const earnersThisYear = (paycheckOnly) =>
      people
        .map((p, i) => {
          const qbiShare = qbiShareOf(i, paycheckOnly);
          return {
            age: assumptions.ageDeductions ? ages[i] : undefined,
            wages: paycheckOnly ? (working[i] ? p.wages : 0) : earnings(i, 'w2'),
            selfEmploymentIncome: paycheckOnly ? (working[i] ? p.selfEmploymentIncome : 0) : earnings(i, '1099'),
            ...(qbiShare < 1 && { qbiShare }),
          };
        })
        .filter((_, i) => alive[i]);
    const peopleThisYear = earnersThisYear(false);
    const paycheckPeople = earnersThisYear(true);
    // Other income this year, by kind (it goes on after its owner's death).
    const otherIncome = { ordinary: 0, interest: 0, qualified: 0, taxExempt: 0 };
    for (const r of incomeRows ?? []) if (r.type === 'other' && counts(r)) otherIncome[r.treatment] = (otherIncome[r.treatment] ?? 0) + r.amount;
    const otherIncomeTotal = otherIncome.ordinary + otherIncome.interest + otherIncome.qualified + otherIncome.taxExempt;
    // Each taxable account's qualified dividends this year, on what stays invested.
    const dividendsOf = (withdrawals) =>
      Object.fromEntries(
        accounts
          .filter((a) => a.type === 'taxable' && yieldOf(a) > 0)
          .map((a) => [a.id, Math.max(0, a.balance - (withdrawals[a.id] ?? 0)) * yieldOf(a)]),
      );
    const sum = (o) => Object.values(o).reduce((s, x) => s + x, 0);
    // paycheckOnly: today's earnings alone, no other income (the base for the surplus while working).
    const taxParams = (withdrawals, conversions = [], { withDividends = true, paycheckOnly = false } = {}) => {
      const other = paycheckOnly ? { ordinary: 0, interest: 0, qualified: 0 } : otherIncome;
      let ordinaryIncome = pension + other.ordinary + conversions.reduce((s, c) => s + c.amount, 0);
      let preferentialIncome = other.qualified + (withDividends ? sum(dividendsOf(withdrawals)) : 0);
      for (const a of accounts) {
        const w = withdrawals[a.id] ?? 0;
        if (!(w > 0)) continue;
        if (a.type === 'pretax') ordinaryIncome += w;
        if (a.type === 'taxable') preferentialIncome += w * (a.balance > 0 ? Math.max(0, 1 - a.basis / a.balance) : 0);
      }
      return {
        filingStatus: filingStatusThisYear,
        year, // today's law, in today's dollars
        calendarYear,
        people: paycheckOnly ? paycheckPeople : peopleThisYear,
        pretaxDeferrals,
        income: { ordinaryIncome, investmentOrdinaryIncome: other.interest, preferentialIncome, socialSecurity },
        thresholdScale,
        rateShift: anyRetired ? rateShiftInRetirement : 0,
        qbi: Boolean(assumptions.qualifiedBusinessIncome), // QBI on 1099 earnings while working (qbi.js)
        itemizedDeductions: household.deductions?.itemized ?? 0, // every year, in today's dollars
        ...dependentsInYear(household, t), // children while under 17; other dependents this year
      };
    };
    // Totals only while solving; the row below runs the full engine once (marginal rates, room).
    // opts.withDividends false: the cash without the dividends' tax (while everyone works, the account
    // pays it); opts.paycheckOnly: today's earnings alone, no other income.
    const evaluate = (withdrawals, conversions = [], full = false, opts = {}) => {
      const params = taxParams(withdrawals, conversions, opts);
      const tax = full ? calculateYearTax(params) : calculateYearTaxTotals(params);
      const withdrawn = Object.values(withdrawals).reduce((s, w) => s + w, 0);
      const earned = params.people.reduce((s, p) => s + p.wages + p.selfEmploymentIncome, 0);
      const other = opts.paycheckOnly ? 0 : otherIncomeTotal;
      return { tax, params, cash: earned + other + socialSecurity + pension + withdrawn - tax.totalTax - contributionCash - irmaaThisYear };
    };

    const live = accounts.filter((a) => a.balance > 0);
    const baseNeed = needIn ? needIn(t) : need;
    const needThisYear = anyRetired ? baseNeed * (survivorYear ? survivorSpending : 1) : 0;
    // The one-time conversion (first year only): from every Pre-tax account, pro rata by balance.
    const pretaxLive = live.filter((a) => a.type === 'pretax');
    const pretaxTotal = pretaxLive.reduce((s, a) => s + a.balance, 0);
    const oneTime = t === 0 && convertNow > 0 && pretaxTotal > 0 ? Math.min(convertNow, pretaxTotal) : 0;
    const oneTimeConversions = oneTime > 0 ? pretaxLive.map((a) => ({ from: a.id, amount: (oneTime * a.balance) / pretaxTotal, oneTime: true })) : [];
    // The planner's conversions this year (see yearChanges): each from its owner's Pre-tax accounts,
    // pro rata by balance (after a death, the survivor's, who holds the accounts).
    const plannedConversions = yearChanges
      .filter((c) => c.kind === 'convert' && c.year === calendarYear && c.amount > 0)
      .flatMap((c) => {
        const i = people.findIndex((p) => p.id === c.owner);
        if (i < 0) return [];
        const owner = alive[i] ? c.owner : people[1 - i].id;
        const sources = pretaxLive.filter((a) => a.owner === owner);
        const total = sources.reduce((s, a) => s + a.balance, 0);
        const amount = Math.min(c.amount, total);
        return amount > 0 ? sources.map((a) => ({ from: a.id, amount: (amount * a.balance) / total, planned: true })) : [];
      });
    const fixedConversions = [...oneTimeConversions, ...plannedConversions];
    // The strategy plans the spending withdrawals only (decided 2026-10-12, see the header): its cash
    // leaves out every conversion's tax, which is paid after it; its tax lines include the conversions
    // (so a conversion strategy sizes its own on top of the others).
    const evaluateForStrategy = (w, conv = [], full = false, opts = {}) => {
      const all = [...conv, ...fixedConversions];
      if (all.length === 0) return evaluate(w, [], full, opts);
      return { ...evaluate(w, all, full, opts), cash: evaluate(w, [], false, opts).cash };
    };
    const solveYear = () => {
      // 4. Withdrawals: the strategy once anyone has retired; RMDs only while everyone works.
      const proposed = anyRetired
        ? strategy({
            year: calendarYear,
            ages,
            working,
            alive,
            household,
            taxYear: year,
            rateShift: rateShiftInRetirement,
            accounts: live.map((a) => ({ ...a })),
            rmdByAccount,
            need: needThisYear,
            socialSecurity,
            filingStatus: filingStatusThisYear,
            evaluate: evaluateForStrategy,
          })
        : { withdrawals: { ...rmdByAccount }, conversions: [] };
      // The engine's rules, whatever the strategy returned: at least the RMD, at most the balance.
      const withdrawals = {};
      for (const a of live) {
        const w = Math.max(proposed.withdrawals?.[a.id] ?? 0, rmdByAccount[a.id] ?? 0);
        withdrawals[a.id] = Math.min(a.balance, Math.max(0, w));
      }
      // Conversions (Roth conversions, phase 7): only from Pre-tax accounts, never more than what is
      // left after this year's withdrawals (and any conversion before it); taxed as ordinary income this
      // year (taxParams). The one-time conversion comes after the strategy's own.
      const used = {};
      const conversions = [...(proposed.conversions ?? []), ...fixedConversions]
        .map((c) => {
          const a = accounts.find((x) => x.id === c.from && x.type === 'pretax');
          if (!a) return null;
          const amount = Math.max(0, Math.min(c.amount, a.balance - (withdrawals[a.id] ?? 0) - (used[a.id] ?? 0)));
          used[a.id] = (used[a.id] ?? 0) + amount;
          return { from: a.id, owner: a.owner, amount, ...(c.oneTime && { oneTime: true }) };
        })
        .filter((c) => c && c.amount > 0);
      const forSpending = { ...withdrawals }; // before any drawn to pay the conversions' tax
      // The conversions' tax (see the header). Once anyone has retired: more from the taxable accounts
      // (pro rata by what is left in them) until the year's cash meets the need again; what they can't
      // cover is held back from the conversions. While everyone works: all of it held back.
      let withheld = 0;
      if (conversions.length > 0) {
        const conversionTax = (w) => evaluate(w, conversions).tax.totalTax - evaluate(w, []).tax.totalTax;
        if (anyRetired) {
          const target = needThisYear;
          if (evaluate(withdrawals, conversions).cash < target) {
            const left = live.filter((a) => a.type === 'taxable').map((a) => [a.id, a.balance - withdrawals[a.id]]).filter(([, x]) => x > 0);
            const room = left.reduce((s, [, x]) => s + x, 0);
            const at = (x) => {
              const w = { ...withdrawals };
              for (const [id, rest] of left) w[id] += (x * rest) / room;
              return w;
            };
            if (room > 0) {
              const x = evaluate(at(room), conversions).cash <= target
                ? room
                : solveMonotonicIncreasing((v) => evaluate(at(v), conversions).cash, target, { lo: 0, hiStart: room, maxHi: room, iterations: 50 }).x;
              Object.assign(withdrawals, at(Math.min(x, room)));
            }
            const short = target - evaluate(withdrawals, conversions).cash;
            if (short > 0) withheld = Math.min(short, conversionTax(withdrawals));
          }
        } else withheld = conversionTax(withdrawals);
      }
      const { tax, params, cash } = evaluate(withdrawals, conversions, true);
      return { withdrawals, forSpending, conversions, tax, params, cash: cash + withheld, withheld };
    };
    if (enrolled > 0) {
      // The years before the projection: the first year's MAGI without its conversions (see the header);
      // for the first year itself, as worked out before its surcharge.
      const back = t - IRMAA_LOOKBACK_YEARS;
      const lookbackMagi = back >= 0 ? rows[back].magi : t === 0 ? evaluate(solveYear().forSpending, []).tax.lines.magi : preProjectionMagi;
      irmaa = irmaaCost({ magi: lookbackMagi, filingStatus: filingStatusThisYear, year, enrolled });
      irmaaThisYear = irmaa.total;
    }
    const solved = solveYear();
    const { withdrawals, conversions, tax, params: taxParamsUsed, withheld } = solved;
    if (t === 0) preProjectionMagi = conversions.length > 0 ? evaluate(solved.forSpending, []).tax.lines.magi : tax.lines.magi;
    const dividendsByAccount = dividendsOf(withdrawals);
    const dividends = sum(dividendsByAccount);
    // While everyone works the dividends' tax comes out of the dividends (reinvested less), not the
    // paycheck: the year's cash leaves it out.
    const accountPaysDividendTax = !anyRetired && dividends > 0;
    const cash = accountPaysDividendTax ? evaluate(withdrawals, conversions, false, { withDividends: false }).cash + withheld : solved.cash;
    const dividendTax = accountPaysDividendTax ? cash - solved.cash : 0;
    // Surplus: once retired, cash above the need; while everyone works, cash above what today's
    // paycheck alone leaves (an RMD's or other income's after-tax money), since the paycheck covers
    // spending. Saved (reinvested) or spent, by assumptions.surplus (surplusWorking while everyone works).
    const surplus = anyRetired
      ? Math.max(0, cash - needThisYear)
      : Math.max(0, cash - evaluate({}, [], false, { withDividends: false, paycheckOnly: true }).cash);
    const spendSurplus = anyRetired ? spendSurplusRetired : spendSurplusWorking;
    const reinvested = spendSurplus ? 0 : surplus;
    const shortfall = anyRetired && needThisYear - cash > 0.01 ? needThisYear - cash : 0;
    if (shortfall > 0 && runOutYear === null) runOutYear = calendarYear;

    // 7. Basis falls pro-rata with withdrawals; grow; add contributions and surplus at year end.
    const byType = (src) => ({
      pretax: accounts.filter((a) => a.type === 'pretax').reduce((s, a) => s + (src[a.id] ?? 0), 0),
      roth: accounts.filter((a) => a.type === 'roth').reduce((s, a) => s + (src[a.id] ?? 0), 0),
      taxable: accounts.filter((a) => a.type === 'taxable').reduce((s, a) => s + (src[a.id] ?? 0), 0),
    });
    const withdrawn = byType(withdrawals);
    const startBalances = byType(Object.fromEntries(accounts.map((a) => [a.id, a.balance])));
    // Each account's year (row.detail.accounts): its start, each flow in or out, and its end.
    const flows = new Map(accounts.map((a) => [a.id, newFlow(a, a.balance)]));
    const flowOf = (a) => {
      if (!flows.has(a.id)) flows.set(a.id, newFlow(a, 0));
      return flows.get(a.id);
    };
    // Conversions move from the Pre-tax account to the owner's Roth before growth.
    const convertedTotal = conversions.reduce((s, c) => s + c.amount, 0);
    for (const c of conversions) {
      accounts.find((x) => x.id === c.from).balance -= c.amount;
      flows.get(c.from).convertedOut += c.amount;
      // (any tax held back from the conversions, by each one's share)
      const reaching = c.amount - (withheld * c.amount) / convertedTotal;
      const roth = accountFor(c.owner, 'roth');
      roth.balance += reaching;
      flowOf(roth).convertedIn += reaching;
    }
    for (const a of accounts) {
      const w = withdrawals[a.id] ?? 0;
      if (a.type === 'taxable' && a.balance > 0) a.basis *= 1 - w / a.balance;
      const f = flowOf(a);
      f.withdrawn = w;
      f.rmd = rmdByAccount[a.id] ?? 0;
      f.growth = (a.balance - w) * returnRate;
      a.balance = (a.balance - w) * (1 + returnRate);
      // Dividends are reinvested (cost basis); any tax the account pays comes off, by its dividends.
      const d = dividendsByAccount[a.id] ?? 0;
      f.dividends = d;
      if (d > 0) {
        const taxPaid = (dividendTax * d) / dividends;
        a.balance -= taxPaid;
        a.basis += d - taxPaid;
        f.dividendTax = taxPaid;
      }
    }
    const contributed = { pretax: 0, roth: 0, taxable: 0 };
    for (const m of made) {
      const to = accountFor(m.owner, m.type);
      to.balance += m.toAccount;
      flowOf(to).contributed += m.toAccount;
      contributed[m.type] += m.toAccount;
      if (m.excess > 0) {
        const side = accountFor(m.owner, 'taxable');
        side.balance += m.excess;
        side.basis += m.excess;
        flowOf(side).contributed += m.excess;
        contributed.taxable += m.excess;
      }
    }
    people.forEach((p, i) => {
      if (employerMade[i] > 0) {
        const to = accountFor(p.id, 'pretax');
        to.balance += employerMade[i];
        flowOf(to).employer += employerMade[i];
      }
    });
    if (reinvested > 0.005) {
      const side = accountFor(people[survivorYear ? 1 - deceased : 0].id, 'taxable');
      side.balance += reinvested;
      side.basis += reinvested;
      flowOf(side).reinvested += reinvested;
    }
    // A death this year (only the first, and not both at once): from the year end the deceased's
    // accounts are the survivor's, taxable ones with a step-up in basis.
    if (survivorRules && !survivorYear) {
      const dying = people.map((_, i) => ages[i] >= lastYearAlive[i]);
      if (dying.filter(Boolean).length === 1) {
        deceased = dying.indexOf(true);
        const s = 1 - deceased;
        const startAge = Math.max(ages[s] + 1, ss[s].ownStartAge, SURVIVOR_EARLIEST_AGE);
        const monthly = Number.isFinite(ss[deceased].pia)
          ? survivorBenefitMonthly({
              deceasedPia: ss[deceased].pia,
              deceasedBirthYear: people[deceased].birthYear,
              deceasedClaimAge: ss[deceased].ownStartAge,
              deathAge: ages[deceased],
              survivorBirthYear: people[s].birthYear,
              survivorStartAge: startAge,
            })
          : (ss[deceased].own / 12) * survivorAdjustmentFactor(startAge, people[s].birthYear);
        survivorSS = { annual: monthly * 12, startAge };
        for (const a of accounts) {
          if (a.owner !== people[deceased].id) continue;
          a.owner = people[1 - deceased].id;
          if (a.type === 'taxable') a.basis = a.balance;
        }
      }
    }
    const endBalances = byType(Object.fromEntries(accounts.map((a) => [a.id, a.balance])));
    for (const a of accounts) flowOf(a).end = a.balance;

    // The year's income, each source on its own line (row.detail.income).
    const income = [];
    const addIncome = (item) => {
      if (Math.abs(item.amount) > 0) income.push(item);
    };
    if (incomeRows) {
      for (const r of incomeRows) {
        const i = people.findIndex((p) => p.id === r.owner);
        if (EARNINGS.includes(r.type) && i >= 0 && alive[i] && counts(r)) addIncome({ kind: r.type, id: r.id, owner: r.owner, amount: r.amount });
      }
    } else {
      people.forEach((p, i) => {
        if (!alive[i]) return;
        const own = peopleThisYear[alive.slice(0, i).filter(Boolean).length];
        addIncome({ kind: 'w2', id: null, owner: p.id, amount: own.wages });
        addIncome({ kind: '1099', id: null, owner: p.id, amount: own.selfEmploymentIncome });
      });
    }
    if (survivorYear) {
      const s = 1 - deceased;
      const ownNow = ages[s] >= ss[s].ownStartAge ? ss[s].own : 0;
      addIncome({ kind: 'socialSecurity', owner: people[s].id, part: 'own', amount: ownNow });
      addIncome({ kind: 'socialSecurity', owner: people[s].id, part: 'survivor', amount: socialSecurity - ownNow });
    } else {
      people.forEach((p, i) => {
        addIncome({ kind: 'socialSecurity', owner: p.id, part: 'own', amount: ages[i] >= ss[i].ownStartAge ? ss[i].own : 0 });
        addIncome({ kind: 'socialSecurity', owner: p.id, part: 'spousal', amount: ages[i] >= ss[i].topUpStartAge ? ss[i].topUp : 0 });
      });
    }
    for (const p of pensions) addIncome({ kind: 'pension', owner: p.owner, index: p.index, amount: p.amount });
    for (const r of incomeRows ?? []) {
      if (r.type === 'other' && counts(r)) addIncome({ kind: 'other', id: r.id, owner: r.owner, treatment: r.treatment, amount: r.amount });
    }

    rows.push({
      year: calendarYear,
      ages,
      alive,
      filingStatus: filingStatusThisYear,
      working,
      socialSecurity,
      pension,
      rmd: rmdTotal,
      startBalances: { ...startBalances, total: startBalances.pretax + startBalances.roth + startBalances.taxable },
      withdrawals: { ...withdrawn, total: withdrawn.pretax + withdrawn.roth + withdrawn.taxable },
      conversions: conversions.reduce((s, c) => s + c.amount, 0),
      conversionTaxWithheld: withheld, // the conversions' tax held back from them (see the header)
      employerContributions: employerMade.reduce((s, e) => s + e, 0), // to Pre-tax, not in contributions
      contributions: { ...contributed, total: contributed.pretax + contributed.roth + contributed.taxable },
      wages: peopleThisYear.reduce((s, p) => s + p.wages + p.selfEmploymentIncome, 0),
      grossIncome: tax.lines.grossIncome,
      taxableSocialSecurity: tax.lines.taxableSocialSecurity,
      ordinaryTax: tax.ordinaryTax,
      capitalGainsTax: tax.capitalGainsTax,
      niit: tax.niit,
      incomeTax: tax.incomeTax,
      payrollTax: tax.payrollTax,
      totalTax: tax.totalTax,
      magi: tax.lines.magi,
      irmaa: irmaaThisYear, // Medicare Part B + D surcharges this year (0 when off or no one is 65+)
      irmaaTier: irmaa ? irmaa.tier : 0,
      effectiveRate: tax.effectiveRate,
      ordinaryBracketRate: tax.ordinaryBracketRate,
      marginalPretaxRate: tax.marginalRates.ordinaryIncome.incomeTax,
      bracketRoom: tax.bracketRoom.ordinary.room,
      need: needThisYear,
      returnRate, // this year's return (before or after retirement)
      afterTaxIncome: cash, // after all tax and this year's contributions
      surplus, // cash above the need (above today's paycheck while everyone works)
      reinvested: surplus > 0.005 ? reinvested : 0, // the surplus saved in a taxable account
      extraSpending: spendSurplus && surplus > 0.005 ? surplus : 0, // the surplus spent
      otherIncome: otherIncomeTotal, // the other income rows this year (rent, an annuity, ...)
      shortfall,
      dividends, // qualified dividends from the taxable accounts this year (in grossIncome and the tax)
      dividendTaxFromAccounts: dividendTax, // their tax when the accounts paid it (while everyone works)
      endBalances: { ...endBalances, total: endBalances.pretax + endBalances.roth + endBalances.taxable },
      taxableBasis: accounts.filter((a) => a.type === 'taxable').reduce((s, a) => s + a.basis, 0),
      // The parts behind the totals (phase 6 step a; projectionDetail.js reads them).
      detail: {
        income,
        accounts: [...flows.values()].filter(hasActivity),
        spending: {
          baseNeed, // the need before the survivor share
          need: needThisYear,
          afterTaxIncome: cash,
          surplus,
          extraSpending: spendSurplus && surplus > 0.005 ? surplus : 0,
          reinvested: surplus > 0.005 ? reinvested : 0,
          shortfall,
        },
        taxParams: taxParamsUsed, // what calculateYearTax was given, so yearTaxRows rebuilds the year
        tax,
      },
    });
  }
  return { rows, runOutYear, endAge: lastAge };
}
