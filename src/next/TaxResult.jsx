// The tax calculator's results (roadmap phase 2), as blocks: the marginal rate, the effective marginal
// rate (EMTR) and the average tax rate with AGI and the total tax under them; the full calculation
// (above the chart, decided 2026-10-09); the two buckets; the other sources' marginal rates; IRMAA.
// Renders lib/taxCalculator.js's taxCalculatorResult; no math of its own.
import { useMemo } from 'react';
import { taxHeadlines } from '../lib/blockHeadlines.js';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import Blocks from './Blocks.jsx';
import RateBuckets from './RateBuckets.jsx';
import { docsHash } from '../lib/docs.js';

const pct = (r) => formatPercent(r, 1);

// The rows, with the ordinary brackets folded into a "By bracket" dropdown.
function CalculationRows({ rows }) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    // Only the ordinary brackets fold away; the capital-gains rows (0%, 15%, 20%) stay in view.
    if (rows[i].kind !== 'bracket' || !rows[i].key.startsWith('ordinary')) {
      out.push(<Row key={rows[i].key} row={rows[i]} />);
      continue;
    }
    const run = [];
    while (i < rows.length && rows[i].kind === 'bracket' && rows[i].key.startsWith('ordinary')) run.push(rows[i++]);
    i -= 1;
    out.push(
      <details key={`${run[0].key}-brackets`} className="details calc-brackets">
        <summary>By bracket ({run.length})</summary>
        {run.map((r) => (
          <Row key={r.key} row={r} />
        ))}
      </details>,
    );
  }
  return out;
}

function Row({ row }) {
  if (row.kind === 'heading') {
    return (
      <div className="calc-row heading">
        <span>{row.label}</span>
        <span />
      </div>
    );
  }
  if (row.kind === 'tax') {
    return (
      <div className="calc-row sub calc-tax">
        <span>{row.label}</span>
        <span>({$(row.value)})</span>
      </div>
    );
  }
  const value = row.kind === 'sub' ? `− ${$(row.value)}` : $(row.value);
  return (
    <div className={`calc-row ${row.kind === 'bracket' ? 'sub' : row.kind}`}>
      <span>{row.label}</span>
      <span>{value}</span>
    </div>
  );
}

// The ordinary brackets as a vertical bar, bottom to top: the part of income sheltered by
// deductions, then each bracket, filled as far as ordinary taxable income reaches.
// A segment's optional `added` (the conversion calculator) is drawn as its own slice at the top of
// the fill; `caption` replaces the default caption.
export function BracketBar({ bar, caption }) {
  const W = 360;
  const H = 340;
  const barX = 150;
  const barW = 64;
  const total = bar.deduction + bar.segments[bar.segments.length - 1].to;
  const y = (dollars) => H - 8 - ((H - 16) * dollars) / total; // dollars from the bottom of the bar
  const blocks = [
    { key: 'deduction', label: `Deductions ${$(bar.deduction)}`, rate: 0, from: 0, to: bar.deduction, filled: bar.deductionUsed, top: null },
    ...bar.segments.map((s, i) => ({
      key: `b${i}`,
      label: pct(s.rate),
      rate: s.rate,
      from: bar.deduction + s.from,
      to: bar.deduction + s.to,
      filled: s.filled,
      added: s.added ?? 0,
      top: s.to, // taxable income at the top of this bracket
    })),
  ];
  const incomeTop = bar.deduction + bar.ordinaryTaxableIncome;
  const markerY = bar.ordinaryTaxableIncome > 0 ? y(incomeTop) : y(bar.deductionUsed);
  return (
    <figure className="bracket-bar">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Taxable income fills brackets up to ${pct(bar.currentRate)}, with ${$(bar.room)} of room left in that bracket.`}>
        {blocks.map((b) => {
          const top = y(b.to);
          const bottom = y(b.from);
          const fillTop = y(b.from + b.filled);
          return (
            <g key={b.key}>
              <rect x={barX} y={top} width={barW} height={bottom - top} className="bb-empty" />
              {b.filled > 0 && <rect x={barX} y={fillTop} width={barW} height={bottom - fillTop} className={b.key === 'deduction' ? 'bb-sheltered' : 'bb-filled'} />}
              {b.added > 0 && <rect x={barX} y={fillTop} width={barW} height={y(b.from + b.filled - b.added) - fillTop} className="bb-added" />}
              <line x1={barX} x2={barX + barW} y1={top} y2={top} className="bb-edge" />
              <text x={barX - 8} y={(top + bottom) / 2} className="bb-label" textAnchor="end" dominantBaseline="middle">
                {b.label}
              </text>
              <text x={barX + barW + 8} y={top} className="bb-amount" dominantBaseline="middle">
                {b.top !== null ? $(b.top) : ''}
              </text>
            </g>
          );
        })}
        <line x1={barX - 4} x2={barX + barW + 4} y1={markerY} y2={markerY} className="bb-marker" />
      </svg>
      <figcaption>
        {caption ?? (
          <>
        Ordinary taxable income reaches the <strong>{pct(bar.currentRate)}</strong> bracket, with{' '}
        <strong>{$(bar.room)}</strong> of room before the next one. The bottom block is income covered by
        deductions; the figures on the right are taxable income at each bracket&rsquo;s top. Long-term gains and
        qualified dividends are taxed separately, at their own rates, on top.
          </>
        )}
      </figcaption>
    </figure>
  );
}

export default function TaxResult({ tax }) {
  const { result: r, marginal, others, rows, irmaa: i } = tax;
  const ages = useMemo(() => (tax.params.people ?? []).map((p) => p.age).filter(Number.isFinite), [tax.params]);
  const hasPayroll = r.payrollTax > 0;
  // The rates are measured over $1,000 when the child tax credit applies (yearTax.js MARGINAL_PROBE).
  const probe = tax.params.children > 0 || tax.params.otherDependents > 0 ? '$1,000' : '$100';
  const h = taxHeadlines(tax);
  return (
    <Blocks
      blocks={[
        {
          id: 'rates',
          title: 'Tax rates this year',
          summary: h.rates,
          className: 'key-card tax-result',
          fixed: true,
          content: (
            <div className="tax-rate-pair tax-rate-three">
              <div className="rate-pair-item">
                <div className="stat-label">Marginal rate</div>
                <div className="stat-value">{formatPercent(r.bracketRoom.ordinary.rate, 0)}</div>
                <div className="stat-sub">
                  {r.lines.ordinaryGross <= r.lines.deductions
                    ? 'Still under the deductions: no ordinary taxable income yet'
                    : 'The tax bracket of the last dollar of ordinary income'}
                </div>
              </div>
              <div className="rate-pair-item highlight">
                <div className="stat-label">Effective marginal rate (EMTR)</div>
                <div className="stat-value">{pct(marginal.incomeTax)}</div>
                <div className="stat-sub">
                  The real federal income tax on the next {probe} of {marginal.phrase}, with everything it sets off
                  {Math.abs(marginal.total - marginal.incomeTax) > 1e-9 && <>; {pct(marginal.total)} with payroll tax</>}
                </div>
              </div>
              <div className="rate-pair-item">
                <div className="stat-label">Average tax rate</div>
                <div className="stat-note">(also called the effective tax rate)</div>
                <div className="stat-value">{pct(r.effectiveRate)}</div>
                <div className="stat-sub">
                  {$(r.incomeTax)} income tax ÷ {$(r.lines.grossIncome)} total income
                  {hasPayroll && <>; {pct(r.effectiveRateWithPayroll)} with {$(r.payrollTax)} payroll tax</>}
                </div>
              </div>
              <div className="tax-totals">
                <div>
                  <span className="stat-label">Adjusted gross income (AGI)</span>
                  <strong>{$(r.lines.agi)}</strong>
                </div>
                <div>
                  <span className="stat-label">Taxable income</span>
                  <strong>{$(r.lines.taxableIncome)}</strong>
                </div>
                <div>
                  <span className="stat-label">Federal income tax</span>
                  <strong>{$(r.incomeTax)}</strong>
                </div>
                {hasPayroll && (
                  <div>
                    <span className="stat-label">Payroll tax</span>
                    <strong>{$(r.payrollTax)}</strong>
                  </div>
                )}
                <div className="tax-total">
                  <span className="stat-label">Total tax paid</span>
                  <strong>{$(r.totalTax)}</strong>
                </div>
              </div>
              <p className="hint tax-rate-link">
                <a href={docsHash('rates')}>What these three rates mean &rarr;</a>
              </p>
            </div>
          ),
        },
        {
          id: 'calculation',
          title: 'The calculation',
          summary: h.calculation,
          closed: true,
          content: (
            <div className="calc">
              <CalculationRows rows={rows} />
            </div>
          ),
        },
        {
          id: 'buckets',
          title: 'Tax bracket visual',
          summary: h.buckets,
          content: <RateBuckets params={tax.params} irmaa={Boolean(i)} ages={ages} />,
        },
        others.length > 0 && {
          id: 'others',
          title: `The next ${probe} of other income`,
          summary: h.others,
          content: (
            <>
              <div className="calc">
                {others.map((o) => (
                  <div className="calc-row" key={o.source}>
                    <span>{o.label}</span>
                    <span>
                      {pct(o.incomeTax)}
                      {Math.abs(o.total - o.incomeTax) > 1e-9 && <span className="dim"> ({pct(o.total)} with payroll)</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="hint">
                Each is the extra federal tax from $100 more of that income alone. They differ because each kind is taxed
                differently: the next Pre-tax dollar can pull Social Security into tax with it, and gains can sit in the 0%
                bracket.
              </p>
            </>
          ),
        },
        h.irmaa && {
          id: 'irmaa',
          title: `Medicare premiums in ${i.premiumYear}`,
          summary: h.irmaa,
          content: (
            <>
              <div className="calc">
                <div className="calc-row"><span>MAGI this year (sets the {i.premiumYear} premiums)</span><span>{$(i.magi)}</span></div>
                <div className="calc-row"><span>IRMAA tier</span><span>{i.tier === 0 ? 'None' : `${i.tier} of 5`}</span></div>
                <div className="calc-row">
                  <span>Surcharge in {i.premiumYear}</span>
                  <span>
                    {$(i.total)} a year
                    {i.enrolled > 1 && i.total > 0 && <span className="dim"> ({$(i.annual)} each)</span>}
                  </span>
                </div>
                <div className="calc-row">
                  <span>Room before the next tier</span>
                  <span>{i.roomToNext === null ? 'Top tier' : <>{$(i.roomToNext)} <span className="dim">(next tier above {$(i.nextThreshold)})</span></>}</span>
                </div>
              </div>
              <p className="hint">
                Part B and Part D surcharges for anyone 65 or older by {i.premiumYear}, at this year&rsquo;s amounts. Each tier is a
                cliff: one dollar over the line costs the whole step.
              </p>
            </>
          ),
        },
      ]}
      disclaimer="Estimates only — not tax or financial advice. Federal tax for this year under current law: the standard deduction (with the age 65+ deductions) or itemized deductions as one total; no credits, AMT or state tax. The QBI deduction on 1099 income uses the basic rule (above the income threshold, a business with no employees or property)."
    />
  );
}
