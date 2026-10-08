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
// Simplifications (v1): spending is flat in today's dollars; earnings are flat (no raises); no
// survivor years (filing status and both benefits continue to the end age); returns are constant.
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
import { IRMAA_LOOKBACK_YEARS } from '../data/irmaa.js';

export const DEFAULT_END_AGE = 95;

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
function socialSecuritySchedule(household) {
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
export function runProjection(household, { need = 0, strategy = proportionalStrategy, contributions, endAge, retirementRateShift } = {}) {
  const { year, people, filingStatus, futureContributions: fc, assumptions } = household;
  // The household's own what-if (assumptions.retirementRateShift) unless a caller sets one.
  const rateShiftInRetirement = retirementRateShift ?? assumptions.retirementRateShift ?? 0;
  const returnRate = assumptions.returnRate;
  const inflation = assumptions.inflationRate ?? 0;
  const lastAge = endAge ?? assumptions.endAge ?? DEFAULT_END_AGE;
  const age0 = people.map((p) => year - p.birthYear);
  const ss = socialSecuritySchedule(household);
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
    const working = people.map((p, i) => ages[i] < p.retirementAge);
    const anyRetired = working.some((w) => !w);
    const thresholdScale = 1 / (1 + inflation) ** t;
    const socialSecurity = ss.reduce(
      (acc, s, i) => acc + (ages[i] >= s.ownStartAge ? s.own : 0) + (ages[i] >= s.topUpStartAge ? s.topUp : 0),
      0,
    );
    const pension = pensionIncomeInYear(household, t); // today's dollars (pensionIncome.js)

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

    // Medicare IRMAA this year (set by MAGI two years back; see the header). evaluate() subtracts it.
    const enrolled = assumptions.medicareIrmaa ? medicareEnrollees(ages) : 0;
    let irmaa = null;
    let irmaaThisYear = 0;

    const peopleThisYear = people.map((p, i) => ({
      age: assumptions.ageDeductions ? ages[i] : undefined,
      wages: working[i] ? p.wages : 0,
      selfEmploymentIncome: working[i] ? p.selfEmploymentIncome : 0,
    }));
    const taxParams = (withdrawals, conversions = []) => {
      let ordinaryIncome = pension + conversions.reduce((s, c) => s + c.amount, 0);
      let preferentialIncome = 0;
      for (const a of accounts) {
        const w = withdrawals[a.id] ?? 0;
        if (!(w > 0)) continue;
        if (a.type === 'pretax') ordinaryIncome += w;
        if (a.type === 'taxable') preferentialIncome += w * (a.balance > 0 ? Math.max(0, 1 - a.basis / a.balance) : 0);
      }
      return {
        filingStatus,
        year, // today's law, in today's dollars
        calendarYear,
        people: peopleThisYear,
        pretaxDeferrals,
        income: { ordinaryIncome, preferentialIncome, socialSecurity },
        thresholdScale,
        rateShift: anyRetired ? rateShiftInRetirement : 0,
        qbi: Boolean(assumptions.qualifiedBusinessIncome), // QBI on 1099 earnings while working (qbi.js)
        itemizedDeductions: household.deductions?.itemized ?? 0, // every year, in today's dollars
        ...dependentsInYear(household, t), // children while under 17; other dependents this year
      };
    };
    // Totals only while solving; the row below runs the full engine once (marginal rates, room).
    const evaluate = (withdrawals, conversions = [], full = false) => {
      const params = taxParams(withdrawals, conversions);
      const tax = full ? calculateYearTax(params) : calculateYearTaxTotals(params);
      const withdrawn = Object.values(withdrawals).reduce((s, w) => s + w, 0);
      const earned = peopleThisYear.reduce((s, p) => s + p.wages + p.selfEmploymentIncome, 0);
      return { tax, cash: earned + socialSecurity + pension + withdrawn - tax.totalTax - contributionCash - irmaaThisYear };
    };

    const live = accounts.filter((a) => a.balance > 0);
    const needThisYear = anyRetired ? need : 0;
    const solveYear = () => {
      // 4. Withdrawals: the strategy once anyone has retired; RMDs only while everyone works.
      const proposed = anyRetired
        ? strategy({
            year: calendarYear,
            ages,
            working,
            household,
            taxYear: year,
            rateShift: rateShiftInRetirement,
            accounts: live.map((a) => ({ ...a })),
            rmdByAccount,
            need: needThisYear,
            socialSecurity,
            filingStatus,
            evaluate,
          })
        : { withdrawals: { ...rmdByAccount }, conversions: [] };
      // The engine's rules, whatever the strategy returned: at least the RMD, at most the balance.
      const withdrawals = {};
      for (const a of live) {
        const w = Math.max(proposed.withdrawals?.[a.id] ?? 0, rmdByAccount[a.id] ?? 0);
        withdrawals[a.id] = Math.min(a.balance, Math.max(0, w));
      }
      // Conversions (Roth conversions, phase 7): only from Pre-tax accounts, never more than what is
      // left after this year's withdrawals; taxed as ordinary income this year (taxParams).
      const conversions = (proposed.conversions ?? [])
        .map((c) => {
          const a = accounts.find((x) => x.id === c.from && x.type === 'pretax');
          return a ? { from: a.id, owner: a.owner, amount: Math.max(0, Math.min(c.amount, a.balance - (withdrawals[a.id] ?? 0))) } : null;
        })
        .filter((c) => c && c.amount > 0);
      const { tax, cash } = evaluate(withdrawals, conversions, true);
      return { withdrawals, conversions, tax, cash };
    };
    if (enrolled > 0) {
      const back = t - IRMAA_LOOKBACK_YEARS;
      const lookbackMagi = back >= 0 ? rows[back].magi : rows.length > 0 ? rows[0].magi : solveYear().tax.lines.magi;
      irmaa = irmaaCost({ magi: lookbackMagi, filingStatus, year, enrolled });
      irmaaThisYear = irmaa.total;
    }
    const { withdrawals, conversions, tax, cash } = solveYear();
    // Surplus to reinvest: once retired, cash above the need; while everyone works, the after-tax
    // money from any RMD (cash with it minus cash without it), since the paycheck covers spending.
    const surplus = anyRetired ? Math.max(0, cash - needThisYear) : rmdTotal > 0 ? Math.max(0, cash - evaluate({}).cash) : 0;
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
    for (const c of conversions) {
      accounts.find((x) => x.id === c.from).balance -= c.amount;
      accountFor(c.owner, 'roth').balance += c.amount;
    }
    for (const a of accounts) {
      const w = withdrawals[a.id] ?? 0;
      if (a.type === 'taxable' && a.balance > 0) a.basis *= 1 - w / a.balance;
      a.balance = (a.balance - w) * (1 + returnRate);
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
    if (surplus > 0.005) {
      const side = accountFor(people[0].id, 'taxable');
      side.balance += surplus;
      side.basis += surplus;
    }
    const endBalances = byType(Object.fromEntries(accounts.map((a) => [a.id, a.balance])));

    rows.push({
      year: calendarYear,
      ages,
      working,
      socialSecurity,
      pension,
      rmd: rmdTotal,
      startBalances: { ...startBalances, total: startBalances.pretax + startBalances.roth + startBalances.taxable },
      withdrawals: { ...withdrawn, total: withdrawn.pretax + withdrawn.roth + withdrawn.taxable },
      conversions: conversions.reduce((s, c) => s + c.amount, 0),
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
      afterTaxIncome: cash, // after all tax and this year's contributions
      surplus,
      shortfall,
      endBalances: { ...endBalances, total: endBalances.pretax + endBalances.roth + endBalances.taxable },
      taxableBasis: accounts.filter((a) => a.type === 'taxable').reduce((s, a) => s + a.basis, 0),
    });
  }
  return { rows, runOutYear, endAge: lastAge };
}
