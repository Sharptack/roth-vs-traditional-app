import { useState } from 'react';
import { resultHeadlines } from '../lib/sectionSummaries.js';
import Collapsible, { toggleId } from './Collapsible.jsx';
import { formatCurrency, formatPercent, formatValue } from '../lib/format.js';
import { effectiveRateSteps } from '../lib/rateSteps.js';

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

/* ------------------------------------------------------------------ */
/* Section 1 — Retirement income number (its own section)              */
/* ------------------------------------------------------------------ */

function RetirementNumberMath({ result }) {
  const b = result.retirementNeed.breakdown;
  const { lifestyleFactor, beforeLifestyleAdjustment, target } = result.retirementNeed;
  const adjusted = lifestyleFactor !== 1;
  const hasSE = b.selfEmploymentIncome > 0;
  const hasPretax = b.pretaxDeduction > 0;
  const taxSaved = b.incomeTaxWithoutPretaxDeduction - b.incomeTax;
  const partlyDeducted = b.currentType === 'pretax' && b.pretaxDeduction < b.savings;
  return (
    <details className="details">
      <summary>How is this calculated?</summary>
      <div className="details-body">
        <p>
          Your take-home pay today, minus the costs that will be gone by retirement, minus what
          you&rsquo;re saving. What&rsquo;s left is the lifestyle you already live on.
        </p>
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
          <Row label="Standard deduction" value={minus(b.standardDeduction)} kind="sub" />
          <Row label="Taxable income" value={$(b.taxableIncome)} kind="total" />
          <Row label="Federal income tax on that" value={$(b.incomeTax)} kind="total" />

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
          {hasPretax ? (
            <>
              Your savings are Pre-tax, so they come out before income tax: that cuts your income
              tax by {$(taxSaved)} (it would be {$(b.incomeTaxWithoutPretaxDeduction)} without
              them). They&rsquo;re still subtracted in Step 2, because that money is saved, not
              spent. FICA still applies to them.
              {partlyDeducted && (
                <>
                  {' '}
                  Only the {$(b.pretaxDeduction)} that fits under the IRS limit is deducted; the rest
                  is treated as going to a taxable account.
                </>
              )}{' '}
            </>
          ) : (
            b.savings > 0 && (
              <>Your savings are Roth, so they come out after income tax and don&rsquo;t lower it. </>
            )
          )}
          FICA comes out of your paycheck now but stops when you stop working, so it isn&rsquo;t
          part of what you need to replace. Federal tax only; state tax isn&rsquo;t modeled.
          {hasSE && <> Half of your self-employment tax is deducted from your income before income tax.</>}
        </p>
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
/* Section 2 — Roth vs. Traditional                                     */
/* ------------------------------------------------------------------ */

function yearsWithoutSSVerdict(result) {
  const s = result.withoutSocialSecurity;
  const { winner, afterTaxIncomeDifference } = s.comparison;
  const now = formatPercent(result.rates.marginalNow);
  const later = formatPercent(s.effectiveRateRetirement);
  if (winner === 'even') {
    return `About even: your marginal rate today (${now}) and the effective rate on these withdrawals without Social Security (${later}) are nearly the same, so the tax treatment washes out.`;
  }
  const name = winner === 'pretax' ? 'Pre-tax (Traditional)' : 'Roth';
  const why =
    winner === 'pretax'
      ? `the effective rate on these withdrawals without Social Security (${later}) is below your marginal rate today (${now})`
      : `the effective rate on these withdrawals without Social Security (${later}) is above your marginal rate today (${now})`;
  return `${name} comes out ahead by about ${$(afterTaxIncomeDifference)} of after-tax income per year, because ${why}.`;
}

function YearsWithoutSocialSecurity({ result }) {
  const s = result.withoutSocialSecurity;
  const { annuity, retirementNeed, otherWithdrawals: o, rates } = result;
  const std = result.current.standardDeduction;
  const win = (side) => (s.comparison.winner === side ? 'win' : '');
  const withdrawalNeeded = s.grossUp.grossWithdrawal > 0;
  const extraTax = s.grossUp.solutionStack.totalTax - s.grossUp.baseStack.totalTax;
  const higherLifestyle = retirementNeed.lifestyleFactor > 1;
  const hasSide = annuity.roth.side.futureValue > 0 || annuity.pretax.side.futureValue > 0;

  return (
    <details className="details">
      <summary>Retirement years without Social Security</summary>
      <div className="details-body">
        <p>
          You may have years in retirement before Social Security starts, for example if you retire
          before you claim benefits, or you may want to plan without it. Here Social Security is set
          to $0, so your whole {$(retirementNeed.target)} retirement income number has to come from
          your accounts. With no Social Security to phase in, the tax is plain brackets, and the
          rate on these withdrawals is the blended rate: the extra tax they cause, divided by the
          withdrawals.
        </p>

        <div className="calc">
          <Row label="Retirement income without Social Security" kind="heading" />
          <Row label="Retirement income number" value={$(retirementNeed.target)} kind="sub" />
          <Row
            label="Existing Accounts, Pre-tax (4% withdrawal)"
            value={$(o.pretaxGross)}
            kind="sub"
          />
          {o.roth > 0 && <Row label="Existing Accounts, Roth (4%, tax-free)" value={$(o.roth)} kind="sub" />}
          {o.taxableGross > 0 && (
            <Row label="Existing Accounts, taxable (4% withdrawal)" value={$(o.taxableGross)} kind="sub" />
          )}
          <Row
            label="Pre-tax withdrawal needed from Future Contributions"
            value={$(s.grossUp.grossWithdrawal)}
            kind="sub"
          />
          {withdrawalNeeded ? (
            <>
              <Row
                label={`Taxable income after the ${$(std)} standard deduction`}
                value={$(s.taxableIncomeAtTop)}
                kind="sub"
              />
              <Row
                label="Extra tax caused by the Future Contributions withdrawal"
                value={$(extraTax)}
                kind="total"
              />
              <ExtraTaxSplit d={s.rateDrivers} />
              <Row
                label={`Effective rate on these withdrawals (${$(extraTax)} ÷ ${$(s.grossUp.grossWithdrawal)})`}
                value={formatPercent(s.effectiveRateRetirement)}
                kind="total"
              />
            </>
          ) : (
            <>
              <Row
                label="Future Contributions' own natural withdrawal (4% of their projected value)"
                value={$(s.grossUp.probeSize)}
                kind="sub"
              />
              <Row
                label={`Taxable income after the ${$(std)} standard deduction, with that withdrawal added`}
                value={$(s.grossUp.probeStack.ordinaryTaxableIncome)}
                kind="sub"
              />
              <Row label="Total tax, with that withdrawal added" value={$(s.grossUp.probeStack.totalTax)} kind="sub" />
              <Row label="Total tax without it (Existing Accounts only)" value={$(s.grossUp.baseStack.totalTax)} kind="sub" />
              <Row
                label={`Extra tax that withdrawal would cause (${$(s.grossUp.probeStack.totalTax)} − ${$(s.grossUp.baseStack.totalTax)})`}
                value={$(s.grossUp.probeExtraTax)}
                kind="total"
              />
              <ExtraTaxSplit d={s.rateDrivers} />
              <Row
                label={`Effective rate on these withdrawals (${$(s.grossUp.probeExtraTax)} ÷ ${$(s.grossUp.probeSize)})`}
                value={formatPercent(s.effectiveRateRetirement)}
                kind="total"
              />
            </>
          )}
          <Row
            label="Bracket the last dollar falls in (for reference)"
            value={formatPercent(s.marginalRateRetirement, 0)}
            kind="sub"
          />
        </div>

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
                <th scope="row">Future Contributions at retirement</th>
                <td>{$(annuity.roth.futureValue)}</td>
                <td>{$(annuity.pretax.futureValue)}</td>
              </tr>
              <tr>
                <th scope="row">
                  Annual withdrawal
                  <span className="th-sub">4% of Future Contributions</span>
                </th>
                <td>{$(annuity.roth.annualWithdrawal)}</td>
                <td>{$(annuity.pretax.annualWithdrawal)}</td>
              </tr>
              <tr>
                <th scope="row">Effective rate on the withdrawal</th>
                <td>0%</td>
                <td>{formatPercent(s.effectiveRateRetirement)}</td>
              </tr>
              {hasSide && (
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

        <p className="verdict simple-verdict">{yearsWithoutSSVerdict(result)}</p>

        <p className="hint">
          Your marginal rate today is {formatPercent(rates.marginalNow, 0)}. The blended rate on
          these withdrawals is lower than the bracket of their last dollar because the lower
          brackets are taxed first.
        </p>
        <p className="note">
          {withdrawalNeeded && !higherLifestyle && (
            <>
              <strong>Reading this:</strong> without Social Security, your retirement income is
              lower than your income today, so your retirement bracket can&rsquo;t be higher than
              your bracket now. This view can only tie or favor Pre-tax. Compare it with the main
              result above: the difference between the two is the effect of Social Security.
            </>
          )}
          {withdrawalNeeded && higherLifestyle && (
            <>
              <strong>Reading this:</strong> you expect to spend more in retirement than you do
              today, so your retirement bracket can end up higher than your bracket now. That is how
              a higher-earning future can favor Roth. Compare it with the main result above: the
              difference between the two is the effect of Social Security.
            </>
          )}
          {!withdrawalNeeded && (
            <>
              <strong>Reading this:</strong> your Existing Accounts alone already produce more taxable
              income than you need, so your bracket in retirement is set by those balances, not by
              your Future Contributions.
            </>
          )}
        </p>
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

// Section 2: the two rates the decision turns on, in their own block.
function RothVsTraditional({ result }) {
  return (
    <>
      <TaxRates result={result} />
    </>
  );
}

// The trade-off in dollars: Future Contributions only, in its own block below the rates.
function TradeOff({ result }) {
  const { lumpSum, annuity, contribution, contributionSplit, comparison, limitCheck, rates, years } =
    result;
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
      <details className="details">
        <summary>Why is the Pre-tax side bigger?</summary>
        <div className="details-body">
          <p>
            The two contributions cost you the same take-home pay. A Pre-tax dollar comes out of
            income that would have been taxed at your {formatPercent(rates.marginalNow, 0)} marginal
            rate, so Pre-tax puts more away for the same paycheck: the Pre-tax side invests the tax it
            saves today. The question is how much of it you keep. Every Pre-tax dollar that comes out
            is taxed at the effective rate on these withdrawals ({formatPercent(rates.effectiveRetirement)}),
            while Roth withdrawals are tax-free. Pre-tax leaves more after tax when that rate is below
            your marginal rate today.
          </p>
          {anySide && (
            <p>
              <strong>At the IRS limit.</strong> Only {$(limitCheck.limit)} a year can go into the
              account. Whatever that side&rsquo;s take-home pay would have bought beyond the limit is
              invested in a taxable account instead (for Pre-tax, that is the tax the contribution
              saves). That money is part of your Future Contributions: it grows at the same return
              and only its growth is taxed, as capital gains, so the figures above include it.
            </p>
          )}
          <p className="hint">
            These figures cover only your Future Contributions, not your Existing Accounts. The
            total portfolio tax comparison below includes both.
          </p>
        </div>
      </details>

      <YearsWithoutSocialSecurity result={result} />
    </>
  );
}


/* ------------------------------------------------------------------ */
/* Tax rates (top of section 2) and total portfolio comparison (3)      */
/* ------------------------------------------------------------------ */

const NIIT_THRESHOLD_TEXT = '$200,000 ($250,000 filing jointly)';

// Splits the extra tax into its parts, when capital gains are involved.
function ExtraTaxSplit({ d }) {
  if (!(d.extraCapitalGainsTax > 0.5 || d.extraNiit > 0.5)) return null;
  return (
    <>
      <Row label="…of which extra income tax" value={$(d.extraOrdinaryTax)} kind="sub" />
      <Row
        label="…of which extra capital-gains tax (gains pushed into a higher bracket)"
        value={$(d.extraCapitalGainsTax)}
        kind="sub"
      />
      {d.extraNiit > 0.5 && (
        <Row
          label="…of which extra Net Investment Income Tax (more gains over the MAGI threshold)"
          value={$(d.extraNiit)}
          kind="sub"
        />
      )}
    </>
  );
}

// "What sets the rate": where the withdrawal lands in the brackets (and what is
// taxed ahead of it), the Social Security phase-in, and capital-gains stacking.
function RateDrivers({ d }) {
  const bracket = (r) => formatPercent(r, 0);
  const W = $(d.withdrawal);
  const std = $(d.standardDeduction);
  const firstIncome = [
    d.otherPretaxWithdrawal > 0.5 && `${$(d.otherPretaxWithdrawal)} a year from your Pre-tax Existing Accounts`,
    d.taxableSSBefore > 0.5 && `${$(d.taxableSSBefore)} of taxable Social Security`,
  ].filter(Boolean);
  const deductionLeft = Math.max(0, d.standardDeduction - d.ordinaryIncomeBefore);

  let landing;
  if (firstIncome.length > 0) {
    landing = (
      <li>
        <strong>Income that&rsquo;s taxed first.</strong> {firstIncome.join(' and ')}{' '}
        {firstIncome.length > 1 ? 'are' : 'is'} taxed ahead of the Future Contributions withdrawal.{' '}
        {d.startBracket > 0 ? (
          <>
            That uses up the whole {std} standard deduction and fills the lower brackets, so this{' '}
            {W} withdrawal starts in the {bracket(d.startBracket)} bracket instead of at 0%
          </>
        ) : (
          <>
            That uses {$(d.deductionUsedBefore)} of the {std} standard deduction, so only the first{' '}
            {$(Math.min(deductionLeft, d.withdrawal))} of this {W} withdrawal is tax-free
          </>
        )}
        , and its last dollar lands in the {bracket(d.endBracket)} bracket. The more Pre-tax money
        you already have, the higher the Future Contributions withdrawals start.
      </li>
    );
  } else {
    landing = (
      <li>
        <strong>Where it lands.</strong> Nothing else is taxed ahead of this withdrawal, so the first{' '}
        {$(Math.min(d.standardDeduction, d.withdrawal))} of it is covered by the {std} standard
        deduction and its last dollar lands in the {bracket(d.endBracket)} bracket. Pre-tax Existing
        Accounts would change this: their withdrawals are taxed first and push this one into higher
        brackets.
      </li>
    );
  }

  return (
    <div className="note">
      <strong>What sets the rate on these withdrawals</strong>
      <ul className="drivers">
        {landing}
        {d.extraTaxableSS > 0.5 && (
          <li>
            <strong>The Social Security phase-in.</strong> This {W} withdrawal also pulls{' '}
            {$(d.extraTaxableSS)} more of your Social Security into taxable income, so{' '}
            {$(d.withdrawal + d.extraTaxableSS)} of income gets taxed, not just {W}. While your
            combined income sits between the IRS thresholds, each extra dollar you withdraw makes up
            to 85 cents of benefits taxable too. That is why this rate can be higher than your tax
            bracket.
          </li>
        )}
        {d.extraCapitalGainsTax > 0.5 && (
          <li>
            <strong>Capital gains pushed into a higher bracket.</strong> Your taxable-account
            withdrawals are taxed at capital-gains rates stacked on top of your ordinary income. This
            withdrawal raises that ordinary income, which pushes more of those gains into a higher
            capital-gains bracket and adds {$(d.extraCapitalGainsTax)} of capital-gains tax. That tax
            only exists because of this withdrawal, so it counts in the rate.
          </li>
        )}
        {d.extraNiit > 0.5 && (
          <li>
            <strong>The Net Investment Income Tax.</strong> Above {NIIT_THRESHOLD_TEXT} of modified
            AGI, taxable-account gains owe an extra 3.8%. This withdrawal isn&rsquo;t investment
            income itself, but it raises your modified AGI, so more of your gains go over the line
            and it adds {$(d.extraNiit)} of that tax.
          </li>
        )}
      </ul>
    </div>
  );
}

function EffectiveRateMath({ result }) {
  const { annuity } = result;
  const withdrawalNeeded = result.grossUp.grossWithdrawal > 0;

  return (
    <details className="details">
      <summary>How are the retirement rates calculated?</summary>
      <div className="details-body">
          <p className="note">
            <strong>How the rates fit together.</strong> Your <strong>marginal rate</strong> is the tax
            on your next dollar of income today, which is exactly what a Pre-tax contribution saves you.
            The <strong>effective rate on these withdrawals</strong> is the tax caused by the
            withdrawals from your Future Contributions, as a share of those withdrawals, including the extra tax
            that appears when Social Security benefits become taxable and when capital gains are pushed
            into a higher bracket. That is the rate that matters for the Roth vs. Pre-tax choice:
            Pre-tax comes out ahead when it is lower than your marginal rate today, and Roth when it is
            higher. Your <strong>overall effective rate</strong> is simply all the tax you owe in
            retirement divided by all the gross income you receive, Social Security and every account
            included.
          </p>

        <p>
          <strong>Future Contributions</strong> are the savings you make from now until retirement.
          Everything else &mdash; Social Security plus withdrawals from your{' '}
          <strong>Existing Accounts</strong> (the balances you already have) &mdash; is counted first.
        </p>
        <ol className="steps">
          <li>
            Work out how much Social Security and your Existing Accounts already deliver after tax
            in your first year of retirement.
          </li>
          <li>
            Whatever is still missing from your retirement income number has to come from
            your Future Contributions. We calculate the pre-tax withdrawal that delivers exactly
            that amount after tax.
          </li>
          <li>
            Add that withdrawal on top of that income and re-do the tax. The <em>extra</em>{' '}
            tax it causes, divided by the withdrawal, is the effective rate on these withdrawals.
            Total tax divided by total gross income is the overall effective rate.
          </li>
        </ol>

        <div className="calc">
          {effectiveRateSteps(result).map((row) => (
            <StepRow key={row.key} row={row} />
          ))}
        </div>

        {!withdrawalNeeded && (
          <p className="note">
            Social Security and your Existing Accounts already cover the retirement income number,
            so no withdrawal from Future Contributions is needed. The rate shown is what their own
            natural withdrawal &mdash; {$(annuity.pretax.annualWithdrawal)}, 4% of their projected
            value &mdash; <em>would</em> be taxed at on top of that income, since that is the size a
            withdrawal from them would actually be.
          </p>
        )}
        <RateDrivers d={result.rateDrivers} />
      </div>
    </details>
  );
}

// One short line under the two rates: which way they lean.
const LEAN_TEXT = {
  pretax: 'Tends to favor Pre-tax (Traditional)',
  roth: 'Tends to favor Roth',
  even: 'About even',
};

function RateLean({ rates }) {
  return (
    <p className="rate-lean">
      <strong>{LEAN_TEXT[rates.lean]}</strong>
    </p>
  );
}

function TaxRates({ result }) {
  const { rates } = result;
  return (
    <div className="tax-rates">
      <h3 className="subhead">Your tax rate now vs. later</h3>

      <div className="rate-pair">
        <div className="rate-pair-item">
          <div className="stat-label">Marginal rate while working</div>
          <div className="stat-value">{formatPercent(rates.marginalNow)}</div>
          <div className="stat-sub">Tax on your next dollar today</div>
        </div>
        <div className="rate-pair-vs">vs</div>
        <div className="rate-pair-item highlight">
          <div className="stat-label">Effective rate on these withdrawals</div>
          <div className="stat-value">{formatPercent(rates.effectiveRetirement)}</div>
          <div className="stat-sub">The rate that decides Roth vs. Pre-tax</div>
        </div>
      </div>

      <RateLean rates={rates} />

      <EffectiveRateMath result={result} />
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
        <p>
          Each scenario draws the same share of every account (scaled until the after-tax income
          matches your target). Social Security is added on top and is taxed under the IRS
          combined-income rules, using your Pre-tax withdrawals and taxable-account gains as the
          &ldquo;other income.&rdquo; Each taxable-account withdrawal is part cost basis (tax-free) and
          part gain, in proportion to the account; the gain is taxed at the real 0% / 15% / 20% capital-gains rates, stacked on top of your ordinary
          income &mdash; not a flat rate, so a withdrawal can be partly or fully tax-free when your
          ordinary income is modest.
          {owesNiit && (
            <> Above {NIIT_THRESHOLD_TEXT} of modified AGI the gain also owes the 3.8% Net Investment Income Tax.</>
          )}
        </p>
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
  const { portfolio, taxDifference, retirementNeed, socialSecurity } = result;
  const short = SCENARIOS.filter((c) => !portfolio[c.key].targetMet);
  const lowerTaxName = taxDifference.lowerTaxScenario === 'roth' ? 'All-Roth' : 'All-Pre-tax';
  const higherTaxName = taxDifference.lowerTaxScenario === 'roth' ? 'All-Pre-tax' : 'All-Roth';
  // Which scenario's portfolio delivers more after tax at a plain 4% withdrawal.
  const incomeGap = portfolio.pretax.atBaseline.afterTaxIncome - portfolio.roth.atBaseline.afterTaxIncome;
  const incomeLeader = Math.abs(incomeGap) < 0.5 ? null : incomeGap > 0 ? 'pretax' : 'roth';

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
                Withdrawal rate needed
                <span className="th-sub">Share of the portfolio drawn per year</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{formatPercent(portfolio[c.key].impliedWithdrawalRate)}</td>
              ))}
            </tr>
            <tr className="total-row">
              <th scope="row">
                After-tax income at a 4% withdrawal
                <span className="th-sub">
                  Per year: 4% of every account + Social Security − tax. What each portfolio buys
                </span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key} className={incomeLeader === c.key ? 'win' : ''}>
                  {$(portfolio[c.key].atBaseline.afterTaxIncome)}
                  {incomeLeader === c.key && (
                    <span className="th-sub">+{$(Math.abs(incomeGap))} a year</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <PortfolioMath result={result} />

      <div className="callout">
        <div className="callout-label">Total tax difference between scenarios</div>
        <div className="callout-value">{$(taxDifference.amount)} per year</div>
        <p>
          {taxDifference.lowerTaxScenario === 'even'
            ? 'Both approaches cost about the same in tax to deliver the same lifestyle.'
            : `That is the tax cost of getting the identical after-tax lifestyle: the ${lowerTaxName} scenario pays ${$(taxDifference.amount)} less in tax each year than the ${higherTaxName} scenario.`}
        </p>
      </div>

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
// heading's id (kept from the fixed-card layout, used for in-page links and tests).
const RESULT_CARDS = [
  { id: 'need', headingId: 'sec1', title: 'Retirement income number', Body: RetirementNumberSection },
  { id: 'rates', headingId: 'sec2', title: 'Roth vs. Traditional', Body: RothVsTraditional },
  { id: 'tradeoff', headingId: 'sec-tradeoff', title: 'The trade-off in dollars', Body: TradeOff },
  { id: 'portfolio', headingId: 'sec3', title: 'Total portfolio tax comparison', Body: PortfolioComparison },
];

export default function ResultsSummary({ result }) {
  // Every card starts open; closing one keeps its dropdowns as they were (the body is hidden, not removed).
  const [open, setOpen] = useState(() => new Set(RESULT_CARDS.map((card) => card.id)));
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
  const allOpen = RESULT_CARDS.every((card) => open.has(card.id));
  return (
    <div className="results">
      <div className="results-head">
        <h2 className="sr-only">Results</h2>
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen(new Set(allOpen ? [] : RESULT_CARDS.map((card) => card.id)))}
        >
          {allOpen ? 'Collapse all results' : 'Expand all results'}
        </button>
      </div>
      {RESULT_CARDS.map(({ id, headingId, title, Body }) => (
        <Collapsible
          key={id}
          headingId={headingId}
          title={title}
          summary={headlines[id]}
          open={open.has(id)}
          onToggle={() => setOpen(toggleId(open, id))}
        >
          <Body result={result} />
        </Collapsible>
      ))}
      <p className="disclaimer">
        Estimates only — not tax or financial advice. Based on {result.dataYear} federal tax rules,
        with no state tax, no inflation, and a simplified proportional withdrawal from every
        account. Results are in today&rsquo;s dollars.
      </p>
    </div>
  );
}
