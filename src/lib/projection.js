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
// before the first projected year are taken to have the first year's MAGI (for the first year
// itself, as worked out before its surcharge). While everyone is still working the surcharge is
// recorded but, like tax, comes out of the paycheck. In the first retirement year of a
// one-person household this is exactly what the total portfolio section computes (tested).
//
// Survivor years (phase 2, decided 2026-10-09): a couple filing jointly where each person has a
// plan-to age. Each person lives through the year they reach it; only the first death is modeled
// (the survivor lives to the end age). The year of death stays joint; from the next year:
//   - filing status single (brackets, deductions, SS taxability, NIIT, IRMAA all follow it);
//     qualifying surviving spouse status (needs a dependent child) is not modeled
//   - Social Security: the larger of the survivor's own benefit (with any spousal top-up) and the
//     deceased's own, the deceased's from the survivor's age 60 (phase 5 refines the survivor rules)
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
// taxable account; 'spend' spends it (spending rises in those years).
//
// A conversion this year (option convertNow, the Roth conversion calculator's lifetime view, decided
// 2026-10-09): that many dollars move from the Pre-tax accounts (pro rata by balance) to Roth in the
// first projected year, taxed as ordinary income that year. Once anyone has retired, the year's
// withdrawals cover its tax, as for the strategy's own conversions. While everyone still works there is
// no withdrawal to pay it from, so the tax is held back from the conversion (less reaches Roth; the
// row's conversionTaxWithheld).
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
import { checkContributionLimit } from './contributionLimits.js';
import { requiredMinimumDistribution } from './rmd.js';
import { solveMonotonicIncreasing } from './solver.js';
import { splitAtTakeHome } from './compare.js';
import { irmaaCost, medicareEnrollees } from './irmaa.js';
import { dependentsInYear } from './dependents.js';
import { pensionIncomeInYear } from './pensionIncome.js';
import { employerContributionFor } from './employerContributions.js';
import { IRMAA_LOOKBACK_YEARS } from '../data/irmaa.js';

export const DEFAULT_END_AGE = 95;
// Spending in survivor years, as a share of the couple's (assumptions.survivorSpending).
export const DEFAULT_SURVIVOR_SPENDING = 0.8;
// The earliest age a survivor benefit is paid.
const SURVIVOR_BENEFIT_AGE = 60;

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
// or for life when the row starts at or after retirement.
export function incomeRowCounts(row, age, retirementAge) {
  if (row.fromAge !== null && row.fromAge !== undefined && age < row.fromAge) return false;
  if (row.toAge !== null && row.toAge !== undefined) return age <= row.toAge;
  const startsRetired = row.fromAge !== null && row.fromAge !== undefined && row.fromAge >= retirementAge;
  return startsRetired || age < retirementAge;
}

export function socialSecuritySchedule(household) {
  const { year, people } = household;
  const ageOf = (p) => year - p.birthYear;
  const ss = estimateHouseholdSocialSecurity({
    earners: people.map((p) => {
      const pay = calculateEmploymentTaxes({ wages: p.wages, selfEmploymentIncome: p.selfEmploymentIncome, filingStatus: household.filingStatus, year });
      return {
        earnings: p.wages + pay.selfEmployment.netEarnings,
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
    const claimAge = s.known ? Math.min(70, Math.max(62, p.socialSecurity.claimAge ?? p.retirementAge)) : s.claimingAge;
    return {
      own: s.ownBenefit,
      ownStartAge: claimAge,
      topUp: s.spousalTopUp ?? 0,
      topUpStartAge: s.spousalStartAge ?? Infinity,
    };
  });
}

// The household's Social Security in year t (0 = this year): each part that has started by then.
export function socialSecurityInYear(household, t) {
  // An age not entered yet (the form shows the error): nothing to work out.
  if (!household.people.every((p) => Number.isFinite(p.birthYear) && Number.isFinite(p.retirementAge))) return 0;
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
//   contributions    optional override, one entry per saver: [{ owner, amount, type: 'pretax' | 'roth' }],
//                    or [{ owner, takeHomeCost, rate, type }] (phase 6: the Roth and Pre-tax scenarios at
//                    the SAME take-home cost, split each year at that year's limit by splitAtTakeHome, so
//                    a Pre-tax saver over the limit invests the tax saved in a taxable account).
//                    Default: the household's Future Contributions as entered.
//   endAge           person 1's age in the last projected year (default household.assumptions.endAge or 95).
//   retirementRateShift  added to every ordinary bracket rate in the years anyone is retired (a tax-law
//                    what-if: "rates 3 points higher in retirement"); default: the household's
//                    assumptions.retirementRateShift, else 0.
//   convertNow       a Roth conversion in the first projected year, in dollars (see the header).
export function runProjection(household, { need = 0, strategy = proportionalStrategy, contributions, endAge, retirementRateShift, convertNow = 0 } = {}) {
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
  const spendSurplus = assumptions.surplus === 'spend';
  // Version 2: the income rows (earnings and other income) by their ages; version 1: none.
  const incomeRows = Array.isArray(household.incomes) ? household.incomes : null;
  let deceased = -1; // the index of the person who has died, from the year after their death
  const plan =
    contributions ??
    fc.contributions.map((c) => ({ owner: c.owner, amount: c.amount, type: c.currentType ?? fc.currentType }));
  // Each saver's account type (their own, else the household's) sets their IRS limit.
  const accountTypeOf = (owner) => fc.contributions.find((c) => c.owner === owner)?.accountType ?? fc.accountType;

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
  for (let t = 0; age0[0] + t <= lastAge; t++) {
    const calendarYear = year + t;
    const ages = age0.map((a) => a + t);
    const alive = people.map((_, i) => i !== deceased);
    const survivorYear = deceased >= 0;
    const filingStatusThisYear = survivorYear ? 'single' : filingStatus;
    const working = people.map((p, i) => alive[i] && ages[i] < p.retirementAge);
    const anyRetired = people.some((_, i) => alive[i] && !working[i]);
    const returnRate = working.some(Boolean) ? workingReturn : retiredReturn;
    const thresholdScale = 1 / (1 + inflation) ** t;
    const ssOf = (i) => (ages[i] >= ss[i].ownStartAge ? ss[i].own : 0) + (ages[i] >= ss[i].topUpStartAge ? ss[i].topUp : 0);
    let socialSecurity;
    if (survivorYear) {
      const s = 1 - deceased;
      socialSecurity = Math.max(ssOf(s), ages[s] >= SURVIVOR_BENEFIT_AGE ? ss[deceased].own : 0);
    } else socialSecurity = people.reduce((acc, _, i) => acc + ssOf(i), 0);
    // today's dollars (pensionIncome.js)
    const pension = pensionIncomeInYear(household, t, { deceased: survivorYear ? people[deceased].id : null });

    // 2. This year's contributions (paid in at the end of the year).
    const made = [];
    for (const c of plan) {
      const i = people.findIndex((p) => p.id === c.owner);
      if (i < 0 || !working[i] || !((c.amount ?? c.takeHomeCost) > 0)) continue;
      if (c.takeHomeCost !== undefined) {
        const limit = checkContributionLimit(c.takeHomeCost, accountTypeOf(c.owner), year, ages[i]).limit;
        const split = splitAtTakeHome(c.takeHomeCost, 'roth', c.rate, limit)[c.type];
        made.push({ owner: c.owner, type: c.type, toAccount: split.toAccount, excess: split.excessToTaxable });
        continue;
      }
      const limit = checkContributionLimit(c.amount, accountTypeOf(c.owner), year, ages[i]).limit;
      const toAccount = Math.min(c.amount, limit);
      made.push({ owner: c.owner, type: c.type, toAccount, excess: c.amount - toAccount });
    }
    const pretaxDeferrals = made.filter((m) => m.type === 'pretax').reduce((s, m) => s + m.toAccount, 0);
    // The employers' contributions (Pre-tax, paid in at the end of the year).
    const employerMade = people.map((p, i) => (working[i] ? employerContributionFor(household, p, ages[i]) : 0));
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
      return i >= 0 && incomeRowCounts(r, ages[i], people[i].retirementAge);
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
      return { tax, cash: earned + other + socialSecurity + pension + withdrawn - tax.totalTax - contributionCash - irmaaThisYear };
    };

    const live = accounts.filter((a) => a.balance > 0);
    const needThisYear = anyRetired ? need * (survivorYear ? survivorSpending : 1) : 0;
    // The one-time conversion (first year only): from every Pre-tax account, pro rata by balance.
    const pretaxLive = live.filter((a) => a.type === 'pretax');
    const pretaxTotal = pretaxLive.reduce((s, a) => s + a.balance, 0);
    const oneTime = t === 0 && convertNow > 0 && pretaxTotal > 0 ? Math.min(convertNow, pretaxTotal) : 0;
    const oneTimeConversions = oneTime > 0 ? pretaxLive.map((a) => ({ from: a.id, amount: (oneTime * a.balance) / pretaxTotal, oneTime: true })) : [];
    // The strategy sees the year's cash with the one-time conversion's tax in it.
    const evaluateWithOneTime = oneTime > 0 ? (w, conv = [], ...rest) => evaluate(w, [...conv, ...oneTimeConversions], ...rest) : evaluate;
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
            evaluate: evaluateWithOneTime,
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
      const conversions = [...(proposed.conversions ?? []), ...oneTimeConversions]
        .map((c) => {
          const a = accounts.find((x) => x.id === c.from && x.type === 'pretax');
          if (!a) return null;
          const amount = Math.max(0, Math.min(c.amount, a.balance - (withdrawals[a.id] ?? 0) - (used[a.id] ?? 0)));
          used[a.id] = (used[a.id] ?? 0) + amount;
          return { from: a.id, owner: a.owner, amount, ...(c.oneTime && { oneTime: true }) };
        })
        .filter((c) => c && c.amount > 0);
      const { tax, cash } = evaluate(withdrawals, conversions, true);
      // While everyone works, the one-time conversion's tax is held back from it (see the header): the
      // year's cash doesn't pay it.
      const withheld =
        !anyRetired && conversions.some((c) => c.oneTime)
          ? tax.totalTax - evaluate(withdrawals, conversions.filter((c) => !c.oneTime)).tax.totalTax
          : 0;
      return { withdrawals, conversions, tax, cash: cash + withheld, withheld };
    };
    if (enrolled > 0) {
      const back = t - IRMAA_LOOKBACK_YEARS;
      const lookbackMagi = back >= 0 ? rows[back].magi : rows.length > 0 ? rows[0].magi : solveYear().tax.lines.magi;
      irmaa = irmaaCost({ magi: lookbackMagi, filingStatus: filingStatusThisYear, year, enrolled });
      irmaaThisYear = irmaa.total;
    }
    const solved = solveYear();
    const { withdrawals, conversions, tax, withheld } = solved;
    const dividendsByAccount = dividendsOf(withdrawals);
    const dividends = sum(dividendsByAccount);
    // While everyone works the dividends' tax comes out of the dividends (reinvested less), not the
    // paycheck: the year's cash leaves it out.
    const accountPaysDividendTax = !anyRetired && dividends > 0;
    const cash = accountPaysDividendTax ? evaluate(withdrawals, conversions, false, { withDividends: false }).cash + withheld : solved.cash;
    const dividendTax = accountPaysDividendTax ? cash - solved.cash : 0;
    // Surplus: once retired, cash above the need; while everyone works, cash above what today's
    // paycheck alone leaves (an RMD's or other income's after-tax money), since the paycheck covers
    // spending. Saved (reinvested) or spent, by assumptions.surplus.
    const surplus = anyRetired
      ? Math.max(0, cash - needThisYear)
      : Math.max(0, cash - evaluate({}, [], false, { withDividends: false, paycheckOnly: true }).cash);
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
    // Conversions move from the Pre-tax account to the owner's Roth before growth.
    const oneTimeTotal = conversions.filter((c) => c.oneTime).reduce((s, c) => s + c.amount, 0);
    for (const c of conversions) {
      accounts.find((x) => x.id === c.from).balance -= c.amount;
      // (the one-time conversion's tax held back, while everyone works, by each part's share)
      accountFor(c.owner, 'roth').balance += c.amount - (c.oneTime ? (withheld * c.amount) / oneTimeTotal : 0);
    }
    for (const a of accounts) {
      const w = withdrawals[a.id] ?? 0;
      if (a.type === 'taxable' && a.balance > 0) a.basis *= 1 - w / a.balance;
      a.balance = (a.balance - w) * (1 + returnRate);
      // Dividends are reinvested (cost basis); any tax the account pays comes off, by its dividends.
      const d = dividendsByAccount[a.id] ?? 0;
      if (d > 0) {
        const taxPaid = (dividendTax * d) / dividends;
        a.balance -= taxPaid;
        a.basis += d - taxPaid;
      }
    }
    const contributed = { pretax: 0, roth: 0, taxable: 0 };
    for (const m of made) {
      accountFor(m.owner, m.type).balance += m.toAccount;
      contributed[m.type] += m.toAccount;
      if (m.excess > 0) {
        const side = accountFor(m.owner, 'taxable');
        side.balance += m.excess;
        side.basis += m.excess;
        contributed.taxable += m.excess;
      }
    }
    people.forEach((p, i) => {
      if (employerMade[i] > 0) accountFor(p.id, 'pretax').balance += employerMade[i];
    });
    if (reinvested > 0.005) {
      const side = accountFor(people[survivorYear ? 1 - deceased : 0].id, 'taxable');
      side.balance += reinvested;
      side.basis += reinvested;
    }
    // A death this year (only the first, and not both at once): from the year end the deceased's
    // accounts are the survivor's, taxable ones with a step-up in basis.
    if (survivorRules && !survivorYear) {
      const dying = people.map((_, i) => ages[i] >= lastYearAlive[i]);
      if (dying.filter(Boolean).length === 1) {
        deceased = dying.indexOf(true);
        for (const a of accounts) {
          if (a.owner !== people[deceased].id) continue;
          a.owner = people[1 - deceased].id;
          if (a.type === 'taxable') a.basis = a.balance;
        }
      }
    }
    const endBalances = byType(Object.fromEntries(accounts.map((a) => [a.id, a.balance])));

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
      conversionTaxWithheld: withheld, // the one-time conversion's tax held back from it (while everyone works)
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
    });
  }
  return { rows, runOutYear, endAge: lastAge };
}
