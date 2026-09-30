// TEMPORARY (2026-09-29): the "Old vs. new calculation" test page (#/old-vs-new). Runs the
// Visualization page's scenarios through compare.js and pulls out, side by side, the current
// (sideAwareRates.js) numbers and the restored pre-2026-09-28 ones (`result.old`), plus a
// benchmark neither rate calculation produces: the exact after-tax income each portfolio
// delivers at a plain 4% withdrawal from every account, solved by portfolioTax.js
// (`portfolio.X.atBaseline`). No new financial logic: wiring and extraction only. Goes away
// with `result.old` (see CLAUDE.md's removal checklist).
import { compareRothVsTraditional, winnerOf } from './compare.js';

const pct = (a, b) => (b !== 0 ? ((a - b) / b) * 100 : 0);

// One scenario -> both calculations' rates, verdicts and dollar differences, and the benchmark.
// Every "difference" is Pre-tax minus Roth after-tax income per year (positive = Pre-tax ahead).
export function runMethodPoint(base, overrides, year) {
  const inputs = { ...base, ...overrides, year };
  const r = compareRothVsTraditional(inputs);
  if (!r.valid) throw new Error(`Invalid scenario inputs: ${r.errors.join('; ')}`);
  const o = r.old;

  const exactRoth = r.portfolio.roth.atBaseline.afterTaxIncome;
  const exactPretax = r.portfolio.pretax.atBaseline.afterTaxIncome;
  const newRoth = r.annuity.roth.totalAfterTaxIncome;
  const newPretax = r.annuity.pretax.totalAfterTaxIncome;
  const oldRoth = o.annuity.roth.totalAfterTaxIncome;
  const oldPretax = o.annuity.pretax.totalAfterTaxIncome;

  return {
    inputs,
    marginalNow: r.rates.marginalNow,
    overLimit:
      r.contributionSplit.roth.excessToTaxable > 0 || r.contributionSplit.pretax.excessToTaxable > 0,
    retirementNeed: r.retirementNeed.target,
    new: {
      // What the rate is compared against: tax saved now, net of any tax on investing it.
      rateNow: r.rates.taxSavedNow,
      effective: r.rates.effectiveRetirement,
      // The withdrawal the effective rate is measured on: the account's own 4% withdrawal.
      measuredOn: r.annuity.pretax.annualWithdrawal,
      lean: r.rates.lean,
      winner: r.comparison.winner,
      difference: newPretax - newRoth,
      advantagePct: pct(newRoth, newPretax),
    },
    old: {
      // The old block compared its effective rate to the plain marginal rate.
      rateNow: o.rates.marginalNow,
      effective: o.rates.effectiveRetirement,
      // The gross-up withdrawal needed to reach the retirement income number on top of
      // Social Security + Existing Accounts (0 when they already cover it; the rate then
      // came from a probe the size of the account's own 4% withdrawal).
      measuredOn: o.grossUp.grossWithdrawal,
      lean: o.rates.lean,
      winner: o.comparison.winner,
      difference: oldPretax - oldRoth,
      advantagePct: pct(oldRoth, oldPretax),
    },
    exact: {
      winner: winnerOf(exactRoth, exactPretax),
      difference: exactPretax - exactRoth,
      advantagePct: pct(exactRoth, exactPretax),
    },
  };
}

// Why a point's two answers differ, as short tags (display only).
export function differenceCauses(point) {
  const causes = [];
  const { measuredOn: g } = point.old;
  const { measuredOn: w } = point.new;
  if (w > 0 && Math.abs(g - w) / w > 0.25) causes.push(g > w ? 'Old measured a bigger withdrawal' : 'Old measured a smaller withdrawal');
  if (point.overLimit) causes.push('Over the IRS limit (taxable side account)');
  if (point.inputs.retirementLifestyle !== 1) causes.push('Retirement lifestyle ≠ 1×');
  return causes;
}

export function runMethodBatch(batch, year) {
  return {
    ...batch,
    series: batch.series.map((series) => ({
      ...series,
      points: series.points.map(({ x, overrides }) => ({ x, ...runMethodPoint(batch.base, overrides, year) })),
    })),
  };
}

export function runMethodHeatmap(def, year) {
  return {
    ...def,
    rows: def.rows.map((row) => ({
      ...row,
      cells: def.incomes.map((income) => ({ income, ...runMethodPoint(def.base, def.overridesFor(income, row), year) })),
    })),
  };
}

// Every point of the run batches and heatmaps in one list, each labelled with where it came
// from; scenarios that appear in more than one place (the savings-rate heatmap repeats the
// savings-rate chart) are kept once.
export function flattenPoints(batches, heatmaps) {
  const seen = new Set();
  const out = [];
  const add = (point, source) => {
    const id = JSON.stringify(point.inputs);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ ...point, id, source });
  };
  for (const b of batches) {
    for (const s of b.series) {
      for (const p of s.points) add(p, { title: b.title, series: s.label, x: p.x, xType: b.xType });
    }
  }
  for (const h of heatmaps) {
    for (const row of h.rows) {
      for (const c of row.cells) add(c, { title: h.title, series: row.label, x: c.income, xType: 'currency' });
    }
  }
  return out;
}

// Headline counts. "Clear" = the benchmark picks a winner (not within the 0.5% "even" band);
// a verdict "contradicts" the benchmark when it names the other side as the winner.
export function summarize(points) {
  const clear = points.filter((p) => p.exact.winner !== 'even');
  const contradicts = (m) => clear.filter((p) => p[m].winner !== 'even' && p[m].winner !== p.exact.winner).length;
  const maxError = (m) => Math.max(0, ...points.map((p) => Math.abs(p[m].difference - p.exact.difference)));
  return {
    count: points.length,
    clearCount: clear.length,
    winnersDiffer: points.filter((p) => p.new.winner !== p.old.winner).length,
    leansDiffer: points.filter((p) => p.new.lean !== p.old.lean).length,
    newContradicts: contradicts('new'),
    oldContradicts: contradicts('old'),
    // The old block's own rate lean vs. its own dollar verdict (the new one can't disagree).
    oldLeanVsOwnWinner: points.filter((p) => p.old.lean !== p.old.winner).length,
    newMaxError: maxError('new'),
    oldMaxError: maxError('old'),
  };
}

// Compare-input numbers -> the calculator's form strings, for an "open in the calculator" link.
export function toFormValues(inputs) {
  const se = inputs.selfEmploymentIncome ?? 0;
  return {
    grossIncome: String(inputs.grossIncome),
    incomeType: se === 0 ? 'w2' : se >= inputs.grossIncome ? '1099' : 'both',
    selfEmploymentIncome: se > 0 && se < inputs.grossIncome ? String(se) : '',
    filingStatus: inputs.filingStatus,
    currentAge: String(inputs.currentAge),
    retirementAge: String(inputs.retirementAge),
    debtPayments: String(inputs.debtPayments ?? 0),
    otherExpenses: String(inputs.otherExpenses ?? 0),
    savings: String(inputs.savings),
    currentType: inputs.currentType,
    accountType: inputs.accountType,
    knowsSocialSecurity: inputs.knowsSocialSecurity ? 'yes' : 'no',
    socialSecurityBenefit: inputs.knowsSocialSecurity ? String(inputs.socialSecurityBenefit) : '',
    returnRate: String(inputs.returnRate),
    retirementLifestyle: String(inputs.retirementLifestyle),
    otherPretaxBalance: String(inputs.otherPretaxBalance ?? 0),
    otherRothBalance: String(inputs.otherRothBalance ?? 0),
    otherTaxableBalance: String(inputs.otherTaxableBalance ?? 0),
    otherTaxableBasis: String(inputs.otherTaxableBasis ?? 0),
  };
}
