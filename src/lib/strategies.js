// Withdrawal strategies (roadmap phase 7). Pure. Each has the projection's strategy signature
//   ({ accounts, rmdByAccount, need, evaluate, ages, working, alive, household, taxYear, rateShift, filingStatus })
//     -> { withdrawals: { [accountId]: amount }, conversions: [{ from, amount }] }
// so the loop, the summary and the pages don't change. evaluate(withdrawals, conversions) is the
// engine's after-tax cash (and tax lines) for a choice; the engine still enforces at least the RMD
// and at most the balance. proportionalStrategy (v1) lives in projection.js.
import { proportionalStrategy } from './projection.js';
import { getBrackets } from './taxCalculations.js';
import { rmdStartAge } from './rmd.js';
import { solveMonotonicIncreasing } from './solver.js';

// Withdrawals that start from the RMDs (and any `floor` amounts) and then draw x more dollars from
// the accounts in the given order of types (accounts of one type in their listed order).
function sequentialAt(accounts, floor, typeOrder) {
  const ordered = accounts
    .filter((a) => typeOrder.includes(a.type))
    .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
  return (x) => {
    const w = Object.fromEntries(accounts.map((a) => [a.id, Math.min(a.balance, floor[a.id] ?? 0)]));
    let left = x;
    for (const a of ordered) {
      if (left <= 0) break;
      const take = Math.min(left, a.balance - w[a.id]);
      w[a.id] += take;
      left -= take;
    }
    return w;
  };
}

// Draw from `at` (x dollars more on top of the floors) until after-tax cash meets the need.
function solveDraw(at, accounts, floor, need, evaluate, conversions = []) {
  const room = accounts.reduce((s, a) => s + Math.max(0, a.balance - (floor[a.id] ?? 0)), 0);
  if (evaluate(at(0), conversions).cash >= need || room <= 0) return at(0);
  const { x } = solveMonotonicIncreasing((v) => evaluate(at(v), conversions).cash, need, {
    lo: 0,
    hiStart: room,
    maxHi: room,
    iterations: 50,
  });
  return at(Math.min(x, room));
}

// 1. Conventional order: RMDs first, then taxable, then Pre-tax, then Roth (the common default).
export function conventionalOrderStrategy({ accounts, rmdByAccount, need, evaluate }) {
  const at = sequentialAt(accounts, rmdByAccount, ['taxable', 'pretax', 'roth']);
  return { withdrawals: solveDraw(at, accounts, rmdByAccount, need, evaluate), conversions: [] };
}

// The Pre-tax amount (on top of `base` withdrawals and conversions) that brings ordinary taxable
// income to the top of the bracket whose rate is `rate` (from today's law; brackets are indexed, so
// fixed in today's dollars). Bisection: Pre-tax dollars can pull Social Security into tax with them.
function roomToBracketTop({ rate, filingStatus, taxYear, evaluate, base, conversions = [], addTo }) {
  const top = getBrackets(filingStatus, taxYear).find((b) => Math.abs(b.rate - rate) < 1e-9)?.upTo;
  if (!Number.isFinite(top)) return 0;
  const ordinaryAt = (extra) => evaluate(addTo(base, extra), conversions).tax.lines.ordinaryTaxableIncome;
  if (ordinaryAt(0) >= top) return 0;
  let lo = 0;
  let hi = top + 1e6;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ordinaryAt(mid) < top) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Spread `extra` Pre-tax dollars over the Pre-tax accounts (in order), on top of `base`.
function addPretax(accounts) {
  return (base, extra) => {
    const w = { ...base };
    let left = extra;
    for (const a of accounts.filter((x) => x.type === 'pretax')) {
      const take = Math.min(left, a.balance - (w[a.id] ?? 0));
      w[a.id] = (w[a.id] ?? 0) + take;
      left -= take;
      if (left <= 0) break;
    }
    return w;
  };
}

// 2. Fill a bracket from Pre-tax: each year take Pre-tax up to the top of the chosen ordinary
// bracket (more than the need is reinvested by the engine), then cover the rest from taxable, then
// Roth, then more Pre-tax.
export function fillBracketStrategy(rate) {
  const strategy = ({ accounts, rmdByAccount, need, evaluate, filingStatus, taxYear }) => {
    const base = Object.fromEntries(accounts.map((a) => [a.id, Math.min(a.balance, rmdByAccount[a.id] ?? 0)]));
    const fill = roomToBracketTop({ rate, filingStatus, taxYear, evaluate, base, addTo: addPretax(accounts) });
    const floor = addPretax(accounts)(base, fill);
    const at = sequentialAt(accounts, floor, ['taxable', 'roth', 'pretax']);
    return { withdrawals: solveDraw(at, accounts, floor, need, evaluate), conversions: [] };
  };
  strategy.label = `Fill the ${Math.round(rate * 100)}% bracket from Pre-tax`;
  return strategy;
}

// 3. Roth conversions: in retirement before each owner's RMDs start, convert Pre-tax to Roth up to
// the top of the chosen bracket. Spending comes from the conventional order; the conversion's tax
// is paid from that year's withdrawals (taxable first), or from Pre-tax/Roth when taxable runs out.
// The conversion is sized after the spending withdrawals, then the withdrawals are re-solved with
// the conversion's tax included (twice, since paying the tax can move the bracket).
export function rothConversionStrategy(rate) {
  const strategy = (args) => {
    const { accounts, rmdByAccount, need, evaluate, filingStatus, taxYear, household, ages, working, alive } = args;
    const at = sequentialAt(accounts, rmdByAccount, ['taxable', 'pretax', 'roth']);
    let withdrawals = solveDraw(at, accounts, rmdByAccount, need, evaluate);
    // Owners living, retired and below their RMD start age convert.
    const eligible = household.people
      .filter((p, i) => alive?.[i] !== false && !working[i] && ages[i] < rmdStartAge(p.birthYear))
      .map((p) => p.id);
    const sources = accounts.filter((a) => a.type === 'pretax' && eligible.includes(a.owner));
    if (sources.length === 0) return { withdrawals, conversions: [] };
    const asConversions = (amount) => {
      const out = [];
      let left = amount;
      for (const a of sources) {
        const take = Math.min(left, a.balance - (withdrawals[a.id] ?? 0));
        if (take > 0) out.push({ from: a.id, amount: take });
        left -= take;
        if (left <= 0) break;
      }
      return out;
    };
    let conversions = [];
    for (let pass = 0; pass < 2; pass++) {
      // The conversion that brings ordinary taxable income to the bracket top (bisection: it can pull
      // Social Security into tax with it).
      const top = getBrackets(filingStatus, taxYear).find((b) => Math.abs(b.rate - rate) < 1e-9)?.upTo;
      const ordinaryWith = (amount) => evaluate(withdrawals, asConversions(amount)).tax.lines.ordinaryTaxableIncome;
      let amount = 0;
      if (Number.isFinite(top) && ordinaryWith(0) < top) {
        let lo = 0;
        let hi = sources.reduce((s, a) => s + a.balance, 0);
        if (ordinaryWith(hi) <= top) lo = hi;
        else {
          for (let i = 0; i < 50; i++) {
            const mid = (lo + hi) / 2;
            if (ordinaryWith(mid) < top) lo = mid;
            else hi = mid;
          }
        }
        amount = lo;
      }
      conversions = asConversions(amount);
      withdrawals = solveDraw(at, accounts, rmdByAccount, need, evaluate, conversions);
    }
    return { withdrawals, conversions };
  };
  strategy.label = `Convert to Roth up to the ${Math.round(rate * 100)}% bracket before RMDs`;
  return strategy;
}

// The strategies the projection page offers, in order (simplest first).
export const STRATEGIES = [
  { id: 'proportional', label: 'Proportional (every account alike)', strategy: proportionalStrategy },
  { id: 'conventional', label: 'Taxable, then Pre-tax, then Roth', strategy: conventionalOrderStrategy },
  { id: 'fill12', label: 'Fill the 12% bracket from Pre-tax', strategy: fillBracketStrategy(0.12) },
  { id: 'fill22', label: 'Fill the 22% bracket from Pre-tax', strategy: fillBracketStrategy(0.22) },
  { id: 'convert12', label: 'Roth conversions to the top of 12%', strategy: rothConversionStrategy(0.12) },
  { id: 'convert22', label: 'Roth conversions to the top of 22%', strategy: rothConversionStrategy(0.22) },
  { id: 'convert24', label: 'Roth conversions to the top of 24%', strategy: rothConversionStrategy(0.24) },
];

export function strategyById(id) {
  return (STRATEGIES.find((s) => s.id === id) ?? STRATEGIES[0]).strategy;
}

