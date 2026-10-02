// The tax calculator's results (roadmap phase 2): marginal rate, then effective rate, the other
// sources' marginal rates, the "fill up the bracket" bar, and the full calculation. Renders
// lib/taxCalculator.js's taxCalculatorResult; no math of its own.
import { formatCurrency as $, formatPercent } from '../lib/format.js';

const pct = (r) => formatPercent(r, 1);

function Row({ row }) {
  if (row.kind === 'heading') {
    return (
      <div className="calc-row heading">
        <span>{row.label}</span>
        <span />
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
  const { result: r, marginal, others, rows, bar } = tax;
  const hasPayroll = r.payrollTax > 0;
  return (
    <div className="results">
      <section className="card tax-result" aria-labelledby="tax-rates">
        <h2 id="tax-rates">Tax rates this year</h2>
        <div className="tax-rate-pair">
          <div className="rate-pair-item highlight">
            <div className="stat-label">Marginal rate</div>
            <div className="stat-value">{pct(marginal.incomeTax)}</div>
            <div className="stat-sub">
              Federal income tax on the next $100 of {marginal.phrase}
              {Math.abs(marginal.total - marginal.incomeTax) > 1e-9 && <>; {pct(marginal.total)} with payroll tax</>}
            </div>
          </div>
          <div className="rate-pair-item">
            <div className="stat-label">Effective rate</div>
            <div className="stat-value">{pct(r.effectiveRate)}</div>
            <div className="stat-sub">
              {$(r.incomeTax)} income tax ÷ {$(r.lines.grossIncome)} gross income
              {hasPayroll && <>; {pct(r.effectiveRateWithPayroll)} with {$(r.payrollTax)} payroll tax</>}
            </div>
          </div>
        </div>

        <h3 className="subhead">The next $100 of other income</h3>
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

        <h3 className="subhead">Filling up the brackets</h3>
        <BracketBar bar={bar} />

        <details className="details">
          <summary>Show the calculation</summary>
          <div className="details-body calc">
            {rows.map((row) => (
              <Row key={row.key} row={row} />
            ))}
          </div>
        </details>
      </section>
      <p className="disclaimer">
        Estimates only — not tax or financial advice. Federal tax for this year under current law: the standard
        deduction (with the age 65+ deductions), no itemizing, credits, AMT, QBI deduction or state tax.
      </p>
    </div>
  );
}
