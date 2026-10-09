import { useState } from 'react';
import { resultHeadlines } from '../lib/sectionSummaries.js';
import Collapsible, { toggleId } from './Collapsible.jsx';
import { formatCurrency, formatPercent, formatValue } from '../lib/format.js';
import { sideAwareRateSteps } from '../lib/rateSteps.js';
import { ARTICLE_SECTIONS, articleHash } from '../lib/route.js';
import { explainFullTax } from '../lib/taxBreakdown.js';
import LineChart from './charts/LineChart.jsx';

const $ = (n) => formatCurrency(n);
const minus = (n) => `−${formatCurrency(n)}`;
const signedPercent = (factor) => {
  const pct = Math.round((factor - 1) * 100);
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
};

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// One line of a step-by-step calculation.
// kind: 'total' (bold, rule above), 'sub' (indented), 'heading' (section label)
function Row({ label, value, kind = '' }) {
  return (
    <div className={`calc-row ${kind}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// One row from a shared step list (lib/rateSteps.js): its label, plus the
// scenario's own arithmetic in brackets when there is some.
export function StepRow({ row }) {
  const label = row.detail ? `${row.label} (${row.detail})` : row.label;
  return <Row label={label} value={row.kind === 'heading' ? undefined : formatValue(row.value, row.format)} kind={row.kind} />;
}

// The explanation lives in the article ("How this works"), not on this page: one line linking
// to the section(s) that cover what the numbers above it mean.
function Explained({ sections }) {
  return (
    <p className="hint explained">
      Explained in How this works:{' '}
      {sections.map((section, i) => (
        <span key={section}>
          {i > 0 && ' · '}
          <a href={articleHash(section)}>{ARTICLE_SECTIONS[section]}</a>
        </span>
      ))}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Section 1 — Retirement income number (its own section)              */
/* ------------------------------------------------------------------ */

function RetirementNumberMath({ result }) {
  const b = result.retirementNeed.breakdown;
  const { lifestyleFactor, beforeLifestyleAdjustment, target } = result.retirementNeed;
  const adjusted = lifestyleFactor !== 1;
  const hasSE = b.selfEmploymentIncome > 0;
  const hasPretax = b.pretaxDeduction > 0;
  const partlyDeducted = b.currentType === 'pretax' && b.pretaxDeduction < b.savings;
  return (
    <details className="details">
      <summary>How is this calculated?</summary>
      <div className="details-body">
        <div className="calc">
          <Row label="Step 1: federal income tax" kind="heading" />
          <Row label="Gross income" value={$(b.grossIncome)} />
          {hasPretax && (
            <Row
              label="Pre-tax savings for retirement (not taxed now)"
              value={minus(b.pretaxDeduction)}
              kind="sub"
            />
          )}
          {hasSE && (
            <Row
              label="Half of self-employment tax"
              value={minus(b.selfEmploymentDeduction)}
              kind="sub"
            />
          )}
          {b.itemizedDeductions > 0 ? (
            <Row label="Itemized deductions" value={minus(b.itemizedDeductions)} kind="sub" />
          ) : (
            <Row label="Standard deduction" value={minus(b.standardDeduction)} kind="sub" />
          )}
          {b.qbiDeduction > 0 && <Row label="Qualified business income (QBI) deduction" value={minus(b.qbiDeduction)} kind="sub" />}
          <Row label="Taxable income" value={$(b.taxableIncome)} kind="total" />
          <details className="calc-row-details">
            <summary className="calc-row total">
              <span>
                {b.childTaxCredit > 0 ? `Federal income tax on that, less the ${$(b.childTaxCredit)} child tax credit` : 'Federal income tax on that'}
              </span>
              <span>{$(b.incomeTax)}</span>
            </summary>
            {(b.taxBrackets ?? []).map((t) => (
              <Row
                key={t.rate}
                label={`${formatPercent(t.rate, 0)} on ${$(t.amount)}${Number.isFinite(t.to) ? ` (taxable income ${$(t.from)} to ${$(t.to)})` : ` (over ${$(t.from)})`}`}
                value={$(t.tax)}
                kind="sub"
              />
            ))}
            {b.childTaxCredit > 0 && <Row label="Child tax credit" value={minus(b.childTaxCredit)} kind="sub" />}
          </details>

          <Row label="Step 2: what you live on" kind="heading" />
          <Row label="Gross income" value={$(b.grossIncome)} />
          <Row label="Federal income tax" value={minus(b.incomeTax)} kind="sub" />
          <Row
            label={hasSE ? 'FICA and self-employment tax' : 'FICA (Social Security + Medicare)'}
            value={minus(b.fica)}
            kind="sub"
          />
          <Row label="Take-home pay" value={$(b.takeHome)} kind="total" />
          <Row label="Debt payments that will end" value={minus(b.debtPayments)} kind="sub" />
          <Row label="Other expenses that will end" value={minus(b.otherExpenses)} kind="sub" />
          <Row label="Savings for retirement" value={minus(b.savings)} kind="sub" />
          <Row
            label={adjusted ? 'Spending today' : 'Retirement income number'}
            value={$(beforeLifestyleAdjustment)}
            kind="total"
          />
          {adjusted && (
            <>
              <Row
                label={`Adjustment for your expected retirement lifestyle (${signedPercent(lifestyleFactor)})`}
                value={`${target >= beforeLifestyleAdjustment ? '+' : '−'}${$(Math.abs(target - beforeLifestyleAdjustment))}`}
                kind="sub"
              />
              <Row label="Retirement income number" value={$(target)} kind="total" />
            </>
          )}
        </div>
        <p className="hint">
          {partlyDeducted && (
            <>
              Only the {$(b.pretaxDeduction)} that fits under the IRS limit is deducted; the rest is
              treated as going to a taxable account.{' '}
            </>
          )}
          FICA stops when you stop working, so it isn&rsquo;t replaced. Federal tax only.
        </p>
        <Explained sections={['estimate']} />
      </div>
    </details>
  );
}

function RetirementNumberSection({ result }) {
  const { retirementNeed, socialSecurity } = result;
  const adjusted = retirementNeed.lifestyleFactor !== 1;
  const direction = retirementNeed.lifestyleFactor > 1 ? 'higher' : 'lower';
  const portfolioNeed = Math.max(0, retirementNeed.target - socialSecurity.annualBenefit);
  return (
    <>
      <div className="hero">
        <div className="hero-value">{$(retirementNeed.target)}</div>
        <div className="hero-sub">After-tax income per year</div>
      </div>

      <dl className="facts lead-facts">
        <div>
          <dt>Social Security benefit used</dt>
          <dd>
            {$(socialSecurity.annualBenefit)} / year
            {socialSecurity.estimated && (
              <span className="dim">
                {' '}
                — Estimated — see{' '}
                <a href="https://www.ssa.gov" target="_blank" rel="noreferrer">
                  ssa.gov
                </a>{' '}
                for a precise figure
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Income needed from your portfolio</dt>
          <dd>{$(portfolioNeed)} / year</dd>
        </div>
      </dl>

      <p className="note">
        <strong>What this number is:</strong> the after-tax amount you need each year in retirement
        to keep the same lifestyle you have while working. It&rsquo;s the amount you actually
        spend.
        {adjusted && (
          <>
            {' '}
            You chose a retirement lifestyle {direction} than today&rsquo;s, so it&rsquo;s scaled by{' '}
            {signedPercent(retirementNeed.lifestyleFactor)}.
          </>
        )}
      </p>

      {retirementNeed.raw <= 0 && (
        <p className="alert">
          Your debt, other expenses and savings already use up your take-home pay, so the
          retirement income number is $0. Check those inputs.
        </p>
      )}

      <RetirementNumberMath result={result} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section 1b — Your portfolio at retirement                            */
/* ------------------------------------------------------------------ */

// What each scenario contributes this year and what that grows to, what the Existing Accounts
// grow to, and the total. No new math: every number here already exists on `result`
// (contribution, annuity, grown, portfolio).
function PortfolioBuildup({ result }) {
  const { contribution, contributionSplit, grown, annuity, portfolio, years } = result;
  const existingTotal = grown.pretax + grown.roth + grown.taxable;

  return (
    <>
      <div className="table-wrap">
        <table className="compare-table tradeoff-table">
          <thead>
            <tr>
              <th scope="col" className="row-head"></th>
              <th scope="col">Roth</th>
              <th scope="col">Pre-tax (Traditional)</th>
            </tr>
          </thead>
          <tbody>
            <GroupRow title="Future Contributions" />
            <tr>
              <th scope="row">
                Your contribution this year
                <span className="th-sub">For the same take-home pay</span>
              </th>
              <td>
                {$(contribution.roth)}
                <SideNote amount={contributionSplit.roth.excessToTaxable} />
              </td>
              <td>
                {$(contribution.pretax)}
                <SideNote amount={contributionSplit.pretax.excessToTaxable} />
              </td>
            </tr>
            <tr>
              <th scope="row">
                Grown to retirement
                <span className="th-sub">Contributing every year for {years} years</span>
              </th>
              <td>
                {$(annuity.roth.totalFutureValue)}
                <SideNote amount={annuity.roth.side.futureValue} />
              </td>
              <td>
                {$(annuity.pretax.totalFutureValue)}
                <SideNote amount={annuity.pretax.side.futureValue} />
              </td>
            </tr>
          </tbody>
          <tbody>
            <GroupRow title="Existing Accounts" />
            <tr>
              <th scope="row">
                Grown to retirement
                <span className="th-sub">Same either way</span>
              </th>
              <td>{$(existingTotal)}</td>
              <td>{$(existingTotal)}</td>
            </tr>
          </tbody>
          <tbody>
            <tr className="total-row">
              <th scope="row">Total portfolio at retirement</th>
              <td>
                {$(portfolio.roth.totalValue)}
                <BucketBreakdown buckets={portfolio.roth.buckets} />
              </td>
              <td>
                {$(portfolio.pretax.totalValue)}
                <BucketBreakdown buckets={portfolio.pretax.buckets} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">
        The Pre-tax total hasn&rsquo;t been taxed yet, so a bigger total isn&rsquo;t the verdict. The
        tax rate comparison below settles what you keep.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Section 2 — Tax rate comparison                                      */
/* ------------------------------------------------------------------ */

function yearsWithoutSSVerdict(result) {
  const s = result.withoutSocialSecurity.sideAware;
  const { winner, afterTaxIncomeDifference } = result.withoutSocialSecurity.comparison;
  if (!s.available) return 'There is nothing saved to compare.';
  const now = formatPercent(s.taxSavedNow);
  const later = formatPercent(s.effectiveRate);
  if (winner === 'even') {
    return `About even: the tax saved now (${now}) and the effective rate on the account withdrawal without Social Security (${later}) are nearly the same, so the tax treatment washes out.`;
  }
  const name = winner === 'pretax' ? 'Pre-tax (Traditional)' : 'Roth';
  const why =
    winner === 'pretax'
      ? `the effective rate on the account withdrawal without Social Security (${later}) is below the tax saved now (${now})`
      : `the effective rate on the account withdrawal without Social Security (${later}) is above the tax saved now (${now})`;
  return `${name} comes out ahead by about ${$(afterTaxIncomeDifference)} of after-tax income per year, because ${why}.`;
}

function YearsWithoutSocialSecurity({ result }) {
  const s = result.withoutSocialSecurity;
  const win = (side) => (s.comparison.winner === side ? 'win' : '');
  const withdrawalNeeded = s.sideAware.available;

  return (
    <details className="details">
      <summary>Retirement years without Social Security</summary>
      <div className="details-body">
        <p className="hint">
          Social Security set to $0: for the years before you claim, or to plan without it.
        </p>

        <RateWalkthrough
          sideAware={s.sideAware}
          socialSecurity={{ annualBenefit: 0 }}
          otherWithdrawals={result.otherWithdrawals}
          summary="How are these rates calculated, without Social Security?"
        />

        {withdrawalNeeded && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="row-head"></th>
                  <th scope="col" className={win('roth')}>Roth</th>
                  <th scope="col" className={win('pretax')}>Pre-tax (Traditional)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Effective rate on the account withdrawal</th>
                  <td>0%</td>
                  <td>{formatPercent(s.sideAware.effectiveRate)}</td>
                </tr>
                {(s.annuity.roth.side.futureValue > 0 || s.annuity.pretax.side.futureValue > 0) && (
                  <tr>
                    <th scope="row">
                      Plus the taxable account (over the IRS limit)
                      <span className="th-sub">4% withdrawal, after capital-gains tax</span>
                    </th>
                    <td>{$(s.annuity.roth.side.afterTaxWithdrawal)}</td>
                    <td>{$(s.annuity.pretax.side.afterTaxWithdrawal)}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">After-tax income</th>
                  <td className={win('roth')}>{$(s.annuity.roth.totalAfterTaxIncome)}</td>
                  <td className={win('pretax')}>{$(s.annuity.pretax.totalAfterTaxIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="verdict simple-verdict">{yearsWithoutSSVerdict(result)}</p>

        <Explained sections={['withoutSocialSecurity']} />
      </div>
    </details>
  );
}

function GroupRow({ title, sub }) {
  return (
    <tr className="group-row">
      <th scope="colgroup" colSpan={3}>
        {title}
        {sub && <span className="th-sub">{sub}</span>}
      </th>
    </tr>
  );
}

// "incl. $5,640 in a taxable account": the part of Future Contributions over the IRS limit.
function SideNote({ amount, per = '' }) {
  if (!(amount > 0.5)) return null;
  return (
    <span className="th-sub">
      incl. {$(amount)}
      {per} in a taxable account (over the IRS limit)
    </span>
  );
}

// How "After-tax income it generates" is worked out: each side's account withdrawal taxed at
// that scenario's own rate (tax-free for Roth, at the effective rate on the account withdrawal
// for Pre-tax), plus the taxable side account's own withdrawal and tax, when there is one.
function AfterTaxIncomeMath({ result }) {
  const { annuity, rates } = result;
  const hasSide = annuity.roth.side.futureValue > 0.5 || annuity.pretax.side.futureValue > 0.5;
  const pretaxAccountTax = annuity.pretax.annualWithdrawal - annuity.pretax.afterTaxWithdrawal;
  return (
    <details className="details">
      <summary>Show the calculation</summary>
      <div className="details-body">
        <div className="table-wrap">
          <table className="calc-table">
            <thead>
              <tr>
                <th scope="col" className="row-head"></th>
                <th scope="col">Roth</th>
                <th scope="col">Pre-tax (Traditional)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Account withdrawal (4% of Future Contributions)</th>
                <td>{$(annuity.roth.annualWithdrawal)}</td>
                <td>{$(annuity.pretax.annualWithdrawal)}</td>
              </tr>
              <tr>
                <th scope="row">Tax on it</th>
                <td>$0, tax-free</td>
                <td>
                  {formatPercent(rates.effectiveRetirement)} of {$(annuity.pretax.annualWithdrawal)} =
                  {' '}{$(pretaxAccountTax)}
                </td>
              </tr>
              <tr className="total-row">
                <th scope="row">After-tax</th>
                <td>{$(annuity.roth.afterTaxWithdrawal)}</td>
                <td>{$(annuity.pretax.afterTaxWithdrawal)}</td>
              </tr>
              {hasSide && (
                <>
                  <tr>
                    <th scope="row">
                      Taxable side account withdrawal
                      <span className="th-sub">Over the IRS limit, 4% of its projected value</span>
                    </th>
                    <td>{$(annuity.roth.side.annualWithdrawal)}</td>
                    <td>{$(annuity.pretax.side.annualWithdrawal)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Tax on it</th>
                    <td>{formatPercent(annuity.roth.side.taxRate)}</td>
                    <td>{formatPercent(annuity.pretax.side.taxRate)}</td>
                  </tr>
                  <tr className="total-row">
                    <th scope="row">After-tax</th>
                    <td>{$(annuity.roth.side.afterTaxWithdrawal)}</td>
                    <td>{$(annuity.pretax.side.afterTaxWithdrawal)}</td>
                  </tr>
                </>
              )}
              <tr className="total-row">
                <th scope="row">After-tax income it generates</th>
                <td>{$(annuity.roth.totalAfterTaxIncome)}</td>
                <td>{$(annuity.pretax.totalAfterTaxIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

// Section 2: the two rates the decision turns on, in their own block.
// After-tax comparison (the trade-off in dollars): Future Contributions only, in its own block below the rates.
function TradeOff({ result }) {
  const { lumpSum, annuity, contribution, contributionSplit, comparison, limitCheck, years } = result;
  const win = (side) => (comparison.winner === side ? 'win' : '');
  const anySide = contributionSplit.roth.excessToTaxable > 0 || contributionSplit.pretax.excessToTaxable > 0;
  return (
    <>

      {limitCheck.atLimit && <p className="alert">{limitCheck.message}</p>}

      <div className="table-wrap">
        <table className="compare-table tradeoff-table">
          <thead>
            <tr>
              <th scope="col" className="row-head"></th>
              <th scope="col" className={win('roth')}>
                Roth
              </th>
              <th scope="col" className={win('pretax')}>
                Pre-tax (Traditional)
              </th>
            </tr>
          </thead>
          <tbody>
            <GroupRow title="What you put in" />
            <tr>
              <th scope="row">
                Current possible contribution
                <span className="th-sub">Per year, for the same take-home pay</span>
              </th>
              <td>
                {$(contribution.roth)}
                <SideNote amount={contributionSplit.roth.excessToTaxable} />
              </td>
              <td>
                {$(contribution.pretax)}
                <SideNote amount={contributionSplit.pretax.excessToTaxable} />
              </td>
            </tr>
          </tbody>
          <tbody>
            <GroupRow title="A single year&rsquo;s contribution" sub={`Grown for ${years} years`} />
            <tr>
              <th scope="row">Value at retirement</th>
              <td>{$(lumpSum.roth.totalFutureValue)}</td>
              <td>{$(lumpSum.pretax.totalFutureValue)}</td>
            </tr>
            <tr className="total-row">
              <th scope="row">After-tax value</th>
              <td className={win('roth')}>{$(lumpSum.roth.totalAfterTaxValue)}</td>
              <td className={win('pretax')}>{$(lumpSum.pretax.totalAfterTaxValue)}</td>
            </tr>
          </tbody>
          <tbody>
            <GroupRow title="Contributing every year until retirement" />
            <tr>
              <th scope="row">Future Contributions at retirement</th>
              <td>
                {$(annuity.roth.totalFutureValue)}
                <SideNote amount={annuity.roth.side.futureValue} />
              </td>
              <td>
                {$(annuity.pretax.totalFutureValue)}
                <SideNote amount={annuity.pretax.side.futureValue} />
              </td>
            </tr>
            <tr className="total-row">
              <th scope="row">
                After-tax income it generates
                <span className="th-sub">Per year, from a 4% withdrawal</span>
              </th>
              <td className={win('roth')}>{$(annuity.roth.totalAfterTaxIncome)}</td>
              <td className={win('pretax')}>{$(annuity.pretax.totalAfterTaxIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AfterTaxIncomeMath result={result} />
      <p className="hint">
        Future Contributions only. Your Existing Accounts are added in the total future portfolio
        comparison below.
      </p>
      <Explained sections={anySide ? ['rates', 'limit'] : ['rates']} />

      <YearsWithoutSocialSecurity result={result} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Splitting your contribution (blend.js): a Roth/Pre-tax mix explorer  */
/* ------------------------------------------------------------------ */

// A compact stat row for the blend explorer's own small facts list (not the shared `Stat`,
// which is sized for the hero number).
function BlendFact({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BlendExplorer({ result }) {
  const { blend, contributionSplit } = result;
  const optimalIndex = blend.available ? Math.round(blend.best.rothShare * 100) : 50;
  const [index, setIndex] = useState(optimalIndex);
  if (!blend.available) {
    return <p className="hint">There is nothing saved yet to split.</p>;
  }
  const clampedIndex = Math.min(100, Math.max(0, index));
  const point = blend.points[clampedIndex];
  // Every mix but all-Roth, which has no Pre-tax part to put a rate on.
  const ratePoints = blend.points.slice(0, -1);
  const pure0 = blend.points[0];
  const pure1 = blend.points[100];
  const betterPure = Math.max(pure0.totalAfterTaxIncome, pure1.totalAfterTaxIncome);
  const gainOverBetterPure = blend.best.totalAfterTaxIncome - betterPure;
  const atOptimal = clampedIndex === optimalIndex;
  const hasInteriorOptimum = optimalIndex > 0 && optimalIndex < 100 && gainOverBetterPure > 0.5;

  return (
    <>
      <p className="hint">
        Instead of putting all of it in one or the other, this splits Future Contributions&rsquo;{' '}
        {$(contributionSplit.takeHomeCost)} take-home cost between Roth and Pre-tax within the
        same account &mdash; the same thing a real 401(k)&rsquo;s Roth/Traditional deferral
        election splits &mdash; and re-runs the tax at every mix from all-Pre-tax to all-Roth.
      </p>

      {hasInteriorOptimum ? (
        <p className="note">
          <strong>Here, blending helps.</strong> The best mix ({optimalIndex}% Roth) delivers{' '}
          {$(gainOverBetterPure)} a year more than either pure strategy &mdash; because the
          effective rate on the Pre-tax slice climbs as that slice grows (brackets, the Social
          Security phase-in, or capital-gains stacking), a mix can land below where either
          extreme lands.
        </p>
      ) : (
        <p className="note">
          <strong>Here, a pure strategy already wins.</strong> The curve below only falls (or only
          rises) from one end to the other, so the best mix is {optimalIndex === 0 ? 'all Pre-tax' : 'all Roth'}{' '}
          &mdash; blending doesn&rsquo;t find anything a pure strategy didn&rsquo;t already have.
        </p>
      )}

      <div className="blend-slider">
        <label htmlFor="blend-range">
          Roth share of the contribution: <strong>{clampedIndex}%</strong>
          {atOptimal && <span className="blend-optimal-flag"> (the best mix)</span>}
        </label>
        <input
          id="blend-range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={clampedIndex}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
      </div>

      <dl className="facts blend-facts">
        <BlendFact label="To Roth" value={$(point.rothToAccount)} />
        <BlendFact label="To Pre-tax" value={$(point.pretaxToAccount)} />
        {point.excessToTaxable > 0.5 && (
          <BlendFact label="To a taxable account (over the IRS limit)" value={$(point.excessToTaxable)} />
        )}
        <BlendFact label="Tax saved now" value={formatPercent(point.taxSavedNow)} />
        <BlendFact
          label="Effective rate on the Pre-tax withdrawal"
          value={point.effectiveRate === null ? '— (nothing in Pre-tax)' : formatPercent(point.effectiveRate)}
        />
        <BlendFact label="After-tax income it generates" value={$(point.totalAfterTaxIncome)} />
      </dl>

      <button type="button" className="link-button" onClick={() => setIndex(optimalIndex)}>
        Jump to the best mix ({optimalIndex}% Roth, {$(blend.best.totalAfterTaxIncome)}/yr)
      </button>

      <LineChart
        series={[
          {
            key: 'blend',
            label: 'After-tax income it generates',
            points: blend.points.map((p, i) => ({ x: i, y: p.totalAfterTaxIncome })),
          },
        ]}
        xTicks={blend.points.map((_, i) => i)}
        formatX={(x) => `${x}%`}
        formatY={(y) => $(y)}
        xLabel="Roth share of the contribution"
        yLabel="After-tax income it generates"
        includeZero={false}
      />

      <LineChart
        series={[
          {
            key: 'saved',
            label: 'Tax saved now',
            points: ratePoints.map((p, i) => ({ x: i, y: p.taxSavedNow })),
          },
          {
            key: 'effective',
            label: 'Effective rate on the Pre-tax withdrawal',
            points: ratePoints.map((p, i) => ({ x: i, y: p.effectiveRate })),
          },
        ]}
        xTicks={ratePoints.map((_, i) => i)}
        formatX={(x) => `${x}%`}
        formatY={(y) => formatPercent(y)}
        formatYTick={(y) => formatPercent(y, 0)}
        xLabel="Roth share of the contribution"
        yLabel="Tax rate"
      />
      <p className="hint">
        Both rates are measured the same way as in the tax rate comparison, for the Pre-tax part of
        each mix (all-Roth has no Pre-tax part, so the chart stops at 99%). The effective rate is an
        average over the whole Pre-tax part, so it rises as that part grows. Any mix where it sits
        below tax saved now beats all-Roth; the best mix is where the rate on the next Pre-tax
        dollar would reach (or jump past) tax saved now, which is why the effective rate is usually
        still well below it there.
      </p>

      <details className="details">
        <summary>Show the numbers</summary>
        <div className="details-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Roth share</th>
                  <th scope="col">To Roth</th>
                  <th scope="col">To Pre-tax</th>
                  <th scope="col">Tax saved now</th>
                  <th scope="col">Effective rate</th>
                  <th scope="col">After-tax income</th>
                </tr>
              </thead>
              <tbody>
                {blend.points
                  .filter((_, i) => i % 5 === 0 || i === optimalIndex)
                  .map((p) => (
                    <tr
                      key={p.rothShare}
                      className={Math.round(p.rothShare * 100) === optimalIndex ? 'total-row' : ''}
                    >
                      <th scope="row">
                        {formatPercent(p.rothShare, 0)}
                        {Math.round(p.rothShare * 100) === optimalIndex && ' (best)'}
                      </th>
                      <td>{$(p.rothToAccount)}</td>
                      <td>{$(p.pretaxToAccount)}</td>
                      <td>{formatPercent(p.taxSavedNow)}</td>
                      <td>{formatPercent(p.effectiveRate)}</td>
                      <td>{$(p.totalAfterTaxIncome)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Every 5 percentage points, plus the single best mix found. The chart above is drawn
            from all 101 points (every 1%); hover or focus it for the exact figure at any share.
          </p>
        </div>
      </details>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tax rates (top of section 2) and total portfolio comparison (3)      */
/* ------------------------------------------------------------------ */

const NIIT_THRESHOLD_TEXT = '$200,000 ($250,000 filing jointly)';

// One short line under the two rates: which way they lean.
const LEAN_TEXT = {
  pretax: 'Tends to favor Pre-tax (Traditional)',
  roth: 'Tends to favor Roth',
  even: 'About even',
};

// Every ordinary and capital-gains bracket this stack touches, plus the Social Security
// and NIIT math behind it — the full "how the IRS actually gets to that number" view.
function BracketRows({ rows, unit }) {
  return rows.map((r) => (
    <Row
      key={`${unit}-${r.from}`}
      label={`${formatPercent(r.rate, 0)} on ${$(r.amount)} (${$(r.from)} to ${r.to === Infinity ? '∞' : $(r.to)})`}
      value={$(r.tax)}
      kind="sub"
    />
  ));
}

function FullTaxCalculation({ title, d }) {
  return (
    <div className="full-tax-scenario">
      <p className="subhead">{title}</p>
      <div className="calc">
        <Row label="Social Security benefit" value={$(d.ssBenefit)} kind="sub" />
        <Row label="Taxable part of Social Security" value={$(d.taxableSS)} kind="sub" />
        <Row label="Pre-tax withdrawals" value={$(d.pretaxWithdrawal)} kind="sub" />
        <Row label="Adjusted gross income (AGI)" value={$(d.grossOrdinaryIncome + d.capitalGains)} kind="sub" />
        <Row label="Standard deduction" value={minus(d.baseStandardDeduction ?? d.standardDeduction)} kind="sub" />
        {d.additional65Deduction > 0 && (
          <Row label="Additional standard deduction, age 65 or older" value={minus(d.additional65Deduction)} kind="sub" />
        )}
        {d.seniorDeduction > 0 && (
          <Row label="Senior deduction (2025–2028, age 65 or older)" value={minus(d.seniorDeduction)} kind="sub" />
        )}
        <Row label="Ordinary taxable income" value={$(d.ordinaryTaxableIncome)} kind="total" />
        {d.ordinaryRows.length > 0 ? (
          <BracketRows rows={d.ordinaryRows} unit="ord" />
        ) : (
          <Row label="Fully sheltered by the standard deduction" value="$0" kind="sub" />
        )}
        <Row label="Income tax" value={$(d.ordinaryTax)} kind="total" />

        {d.taxableWithdrawal > 0 && (
          <>
            <Row label="Taxable-account withdrawal" value={$(d.taxableWithdrawal)} kind="sub" />
            <Row label="…of which cost basis (tax-free, returned)" value={$(d.taxableBasis)} kind="sub" />
            <Row label="…of which capital gain, stacked on top of ordinary income" value={$(d.capitalGains)} kind="sub" />
            {d.gainsRows.length > 0 ? (
              <BracketRows rows={d.gainsRows} unit="cg" />
            ) : (
              <Row label="Fully sheltered by unused standard deduction" value="$0" kind="sub" />
            )}
            <Row label="Capital-gains tax" value={$(d.capitalGainsTax)} kind="total" />
            <Row label="Modified AGI (for the NIIT test)" value={$(d.magi)} kind="sub" />
            <Row
              label={`NIIT: ${formatPercent(d.niitRate, 1)} × the lesser of gains and MAGI over ${$(d.niitThreshold)}`}
              value={$(d.niitBase)}
              kind="sub"
            />
            <Row label="Net Investment Income Tax" value={$(d.niit)} kind="total" />
          </>
        )}
        <Row label="Total tax" value={$(d.totalTax)} kind="total" />
      </div>
    </div>
  );
}

function FullTaxBreakdown({ stackDetails: st }) {
  return (
    <details className="details">
      <summary>Show the full tax calculation</summary>
      <div className="details-body full-tax-breakdown">
        <FullTaxCalculation title="Roth scenario" d={explainFullTax(st.rothWorld)} />
        <FullTaxCalculation title="Pre-tax scenario" d={explainFullTax(st.preTaxWorld)} />
      </div>
    </details>
  );
}

// The rates walk-through: three steps (income from elsewhere -> the difference that
// matters -> add in the withdrawal), plus the full bracket-by-bracket calculation. Shared by
// the main rates card and "Retirement years without Social Security" — both build a
// `sideAware` object (sideAwareRates.js) and this renders either one.
function RateWalkthrough({ sideAware: s, socialSecurity, otherWithdrawals, summary = 'How are these rates calculated?' }) {
  return (
    <details className="details">
      <summary>{summary}</summary>
      <div className="details-body">
        {!s.available ? (
          <p className="hint">There is no withdrawal from Future Contributions to measure, so there is no rate to compare.</p>
        ) : (
          <>
            <div className="calc">
              {sideAwareRateSteps({ sideAware: s, socialSecurity, otherWithdrawals }).map((row) => (
                <StepRow key={row.key} row={row} />
              ))}
            </div>
            <FullTaxBreakdown stackDetails={s.stackDetails} />
            <Explained sections={['estimate', 'socialSecurity']} />
          </>
        )}
      </div>
    </details>
  );
}

function TaxRates({ result }) {
  const s = result.sideAware;
  if (!s.available) {
    return <p className="hint">There is no withdrawal from Future Contributions to measure, so there is no rate to compare.</p>;
  }
  const hasSide = s.extraSide.withdrawal > 0.5;
  const ahead = s.dollarDifference >= 0 ? 'Pre-tax' : 'Roth';
  // The #/next preview can measure the saving across the whole contribution (an average rate)
  // instead of the marginal rate; the current calculator always uses the marginal rate.
  const average = result.rates.contributionRateBasis === 'average';
  const rateNow = average ? result.rates.contributionRate : s.marginalNow;
  return (
    <div className="tax-rates">
      <div className="rate-pair">
        <div className="rate-pair-item">
          <div className="stat-label">Tax saved now, after any tax on investing it</div>
          <div className="stat-value">{formatPercent(s.taxSavedNow)}</div>
          <div className="stat-sub">
            {hasSide
              ? `Your ${formatPercent(rateNow)} ${average ? 'average rate on the contribution' : 'marginal rate'}, less ${formatPercent(s.extraSideRate)} later tax on the taxable account the savings go into`
              : average
                ? `The tax the whole contribution saves today, averaged across it (your marginal rate is ${formatPercent(s.marginalNow)})`
                : 'Your marginal rate: the tax on your next dollar today'}
          </div>
        </div>
        <div className="rate-pair-vs">vs</div>
        <div className="rate-pair-item highlight">
          <div className="stat-label">Effective rate on the account withdrawal</div>
          <div className="stat-value">{formatPercent(s.effectiveRate)}</div>
          <div className="stat-sub">Extra tax the Pre-tax withdrawal causes, with each scenario&rsquo;s taxable account in the stack</div>
        </div>
      </div>

      <p className="rate-lean">
        <strong>{LEAN_TEXT[s.lean]}</strong>
      </p>
      <p className="hint">
        In dollars: {ahead} comes out ahead by {$(Math.abs(s.dollarDifference))} a year after tax.
      </p>

      <RateWalkthrough sideAware={s} socialSecurity={result.socialSecurity} otherWithdrawals={result.otherWithdrawals} />
    </div>
  );
}

function BucketBreakdown({ buckets }) {
  return (
    <ul className="breakdown">
      <li>Pre-tax {$(buckets.pretax)}</li>
      <li>Roth {$(buckets.roth)}</li>
      <li>Taxable {$(buckets.taxable)}</li>
    </ul>
  );
}

const SCENARIOS = [
  { key: 'roth', title: 'All-Roth scenario' },
  { key: 'pretax', title: 'All-Pre-tax scenario' },
];

// Walks each scenario from account withdrawals + Social Security to after-tax
// income, so the Social Security effect is visible in the arithmetic.
function PortfolioMath({ result }) {
  const { portfolio, socialSecurity: ss, current } = result;
  const std = current.standardDeduction;
  const owesNiit = SCENARIOS.some((c) => portfolio[c.key].niit > 0.5);
  const rows = [
    { label: 'Pre-tax account withdrawals', get: (p) => $(p.withdrawals.pretax) },
    { label: 'Roth account withdrawals (tax-free)', get: (p) => $(p.withdrawals.roth) },
    {
      label: 'Taxable account withdrawals',
      get: (p) => $(p.withdrawals.taxable),
      sub: (p) => (p.withdrawals.taxable > 0 ? `${$(p.taxableGains)} of it gains, the rest cost basis` : ''),
    },
    { label: 'Social Security benefit', get: () => $(ss.annualBenefit) },
    {
      label: 'Gross income (withdrawals + Social Security)',
      kind: 'total',
      get: (p) => $(p.totalGrossWithdrawal + ss.annualBenefit),
    },
    {
      label: 'Taxable part of Social Security',
      get: (p) => $(p.taxableSS),
      sub: (p) =>
        ss.annualBenefit > 0 ? `${formatPercent(p.taxableSS / ss.annualBenefit, 0)} of benefit` : '',
    },
    {
      label: 'Adjusted gross income, AGI (Pre-tax withdrawals + taxable-account gains + taxable Social Security)',
      get: (p) => $(p.withdrawals.pretax + p.taxableGains + p.taxableSS),
    },
    {
      label: `Ordinary taxable income (Pre-tax withdrawals + taxable Social Security − ${$(std)} standard deduction)`,
      get: (p) => $(p.ordinaryTaxableIncome),
    },
    { label: 'Federal income tax', get: (p) => $(p.ordinaryTax) },
    {
      label: 'Capital gains tax (real 0% / 15% / 20% brackets on the gains, on top of ordinary income)',
      get: (p) => $(p.capitalGainsTax),
      sub: (p) =>
        p.withdrawals.taxable > 0
          ? `${formatPercent(p.capitalGainsTax / p.withdrawals.taxable)} of the taxable withdrawal`
          : '',
    },
    ...(owesNiit
      ? [
          {
            label: `Net Investment Income Tax (3.8% on gains, limited to modified AGI above ${NIIT_THRESHOLD_TEXT})`,
            get: (p) => $(p.niit),
          },
        ]
      : []),
    { label: 'Total tax', kind: 'total', get: (p) => $(p.totalTaxPaid) },
    {
      label: 'After-tax income (gross income − total tax)',
      kind: 'total',
      get: (p) => $(p.achievedAfterTaxIncome),
    },
  ];
  return (
    <details className="details">
      <summary>Show the calculation</summary>
      <div className="details-body">
        <div className="table-wrap">
          <table className="calc-table">
            <thead>
              <tr>
                <th scope="col" className="row-head"></th>
                {SCENARIOS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={r.kind === 'total' ? 'total-row' : ''}>
                  <th scope="row">{r.label}</th>
                  {SCENARIOS.map((c) => (
                    <td key={c.key}>
                      {r.get(portfolio[c.key])}
                      {r.sub && r.sub(portfolio[c.key]) && (
                        <span className="th-sub">{r.sub(portfolio[c.key])}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function PortfolioComparison({ result }) {
  const { portfolio, retirementNeed, socialSecurity } = result;
  const short = SCENARIOS.filter((c) => !portfolio[c.key].targetMet);
  // Which scenario's portfolio delivers more after tax at a plain 4% withdrawal.
  const incomeGap = portfolio.pretax.atBaseline.afterTaxIncome - portfolio.roth.atBaseline.afterTaxIncome;
  const incomeLeader = Math.abs(incomeGap) < 0.5 ? null : incomeGap > 0 ? 'pretax' : 'roth';
  // The card's verdict: which portfolio funds the same lifestyle with the lower withdrawal rate.
  // No winner when either falls short of the target, or when they match to 0.005 points.
  const rateGap = portfolio.pretax.impliedWithdrawalRate - portfolio.roth.impliedWithdrawalRate;
  const rateLeader =
    short.length > 0 || Math.abs(rateGap) < 0.00005 ? null : rateGap < 0 ? 'pretax' : 'roth';

  return (
    <>
      <p className="hint">
        Same after-tax lifestyle in both columns, funded from your whole portfolio (Existing Accounts
        plus Future Contributions, grown to retirement) together with Social Security.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" className="row-head"></th>
              {SCENARIOS.map((c) => (
                <th key={c.key} scope="col">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total future portfolio value</th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>
                  {$(portfolio[c.key].totalValue)}
                  <BucketBreakdown buckets={portfolio[c.key].buckets} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Social Security benefit
                <span className="th-sub">Per year; received in full, only part is taxed</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>
                  {$(socialSecurity.annualBenefit)}
                  <span className="th-sub">{$(portfolio[c.key].taxableSS)} taxable</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Total gross withdrawal needed
                <span className="th-sub">Per year, from portfolio accounts</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{$(portfolio[c.key].totalGrossWithdrawal)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Total tax paid
                <span className="th-sub">Per year, federal</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{$(portfolio[c.key].totalTaxPaid)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                After-tax income achieved
                <span className="th-sub">
                  Withdrawals + Social Security − tax. Should equal {$(retirementNeed.target)}
                </span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{$(portfolio[c.key].achievedAfterTaxIncome)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                After-tax income at a 4% withdrawal
                <span className="th-sub">
                  Per year: 4% of every account + Social Security − tax. Same difference as the
                  after-tax comparison above
                </span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>
                  {$(portfolio[c.key].atBaseline.afterTaxIncome)}
                  {incomeLeader === c.key && (
                    <span className="th-sub">+{$(Math.abs(incomeGap))} a year</span>
                  )}
                </td>
              ))}
            </tr>
            <tr className="total-row">
              <th scope="row">
                Withdrawal rate needed
                <span className="th-sub">
                  Share of the portfolio drawn per year for the same lifestyle. Lower means less strain
                </span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key} className={rateLeader === c.key ? 'win' : ''}>
                  {formatPercent(portfolio[c.key].impliedWithdrawalRate, 2)}
                  {rateLeader === c.key && (
                    <span className="th-sub">{(Math.abs(rateGap) * 100).toFixed(2)} pts lower</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <PortfolioMath result={result} />
      <Explained sections={['existing']} />

      {short.length > 0 && (
        <p className="alert">
          With these balances, the {short.map((c) => c.title).join(' and ')} can&rsquo;t reach your
          target. Add savings or lower your retirement income number.
        </p>
      )}
    </>
  );
}

// The results cards, in page order. Each opens and closes from its header, which shows the
// card's headline (sectionSummaries.js). `id` keys the headline; `headingId` is the
// heading's id (kept from the fixed-card layout, used for in-page links and tests). The tax rate
// comparison is the number the decision turns on, so it gets a subtle accent (`key-card`).
const RESULT_CARDS = [
  { id: 'need', headingId: 'sec1', title: 'Retirement income number', Body: RetirementNumberSection },
  { id: 'buildup', headingId: 'sec-portfolio', title: 'Your portfolio at retirement', Body: PortfolioBuildup },
  { id: 'rates', headingId: 'sec2', title: 'Tax rate comparison', Body: TaxRates, className: 'key-card' },
  { id: 'tradeoff', headingId: 'sec-tradeoff', title: 'After-tax comparison', Body: TradeOff },
  { id: 'portfolio', headingId: 'sec3', title: 'Total future portfolio comparison', Body: PortfolioComparison },
];

// The Roth/Pre-tax mix explorer: shown only where asked for (the #/next preview), after the
// after-tax comparison. The public calculator leaves it out.
const BLEND_CARD = { id: 'blend', headingId: 'sec-blend', title: 'Splitting your contribution', Body: BlendExplorer };

const cardsFor = (showBlend) =>
  showBlend ? RESULT_CARDS.flatMap((card) => (card.id === 'tradeoff' ? [card, BLEND_CARD] : [card])) : RESULT_CARDS;

// The page's closing line. The calculators page puts it under everything on the Roth page.
export function RothDisclaimer({ dataYear }) {
  return (
    <p className="disclaimer">
      Estimates only — not tax or financial advice. Based on {dataYear} federal tax rules,
      with no state tax, no inflation, and a simplified proportional withdrawal from every
      account. Results are in today&rsquo;s dollars.
    </p>
  );
}

export default function ResultsSummary({ result, showBlend = false, disclaimer = true }) {
  const cards = cardsFor(showBlend);
  // Every card starts open; closing one keeps its dropdowns as they were (the body is hidden, not removed).
  const [open, setOpen] = useState(() => new Set(cards.map((card) => card.id)));
  if (!result.valid) {
    return (
      <section className="card" aria-labelledby="sec0">
        <h2 id="sec0">Results</h2>
        <p>Fill in the form above to see your comparison.</p>
        <ul className="errors">
          {result.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>
    );
  }

  const headlines = resultHeadlines(result);
  const allOpen = cards.every((card) => open.has(card.id));
  return (
    <div className="results">
      <div className="results-head">
        <h2 className="sr-only">Results</h2>
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen(new Set(allOpen ? [] : cards.map((card) => card.id)))}
        >
          {allOpen ? 'Collapse all results' : 'Expand all results'}
        </button>
      </div>
      {cards.map(({ id, headingId, title, Body, className }) => (
        <Collapsible
          key={id}
          headingId={headingId}
          className={className}
          title={title}
          summary={headlines[id]}
          open={open.has(id)}
          onToggle={() => setOpen(toggleId(open, id))}
        >
          <Body result={result} />
        </Collapsible>
      ))}
      {disclaimer && <RothDisclaimer dataYear={result.dataYear} />}
    </div>
  );
}
