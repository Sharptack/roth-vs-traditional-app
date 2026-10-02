// The Roth conversion calculator's results (single year): the conversion's tax cost, what it is
// made of, the conversion that would fill each bracket, and the bracket bar with the conversion's
// own slice marked. Renders lib/conversionCalculator.js's conversionResult; no math of its own.
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { BracketBar } from './TaxResult.jsx';

const pct = (r) => formatPercent(r, 1);

export default function ConversionResult({ conversion: c, pretaxBalance }) {
  const dragged = c.extraTaxableSocialSecurity > 0.5 || c.deductionLost > 0.5 || c.parts.capitalGainsTax > 0.5 || c.parts.niit > 0.5;
  return (
    <div className="results">
      <section className="card key-card" aria-labelledby="conv-cost">
        <h2 id="conv-cost">Tax cost of the conversion</h2>
        <div className="hero">
          <div className="hero-value">{$(c.cost)}</div>
          <div className="hero-sub">
            {pct(c.rate)} of the {$(c.amount)} converted: {$(c.after.incomeTax)} federal income tax with it, {$(c.before.incomeTax)}{' '}
            without.
          </div>
        </div>
        {c.amount > pretaxBalance + 0.5 && (
          <p className="alert">
            That is more than the {$(pretaxBalance)} in Pre-tax Existing Accounts.
          </p>
        )}
        <div className="calc">
          <div className="calc-row"><span>More ordinary income tax</span><span>{$(c.parts.ordinaryTax)}</span></div>
          {c.parts.capitalGainsTax > 0.5 && (
            <div className="calc-row"><span>More capital-gains tax (gains pushed into a higher bracket)</span><span>{$(c.parts.capitalGainsTax)}</span></div>
          )}
          {c.parts.niit > 0.5 && <div className="calc-row"><span>More Net Investment Income Tax</span><span>{$(c.parts.niit)}</span></div>}
          <div className="calc-row total"><span>Tax cost</span><span>{$(c.cost)}</span></div>
          {c.extraTaxableSocialSecurity > 0.5 && (
            <div className="calc-row sub"><span>Social Security the conversion made taxable</span><span>{$(c.extraTaxableSocialSecurity)}</span></div>
          )}
          {c.deductionLost > 0.5 && (
            <div className="calc-row sub"><span>Senior deduction lost to the phase-out</span><span>{$(c.deductionLost)}</span></div>
          )}
        </div>
        <p className="hint">
          {dragged
            ? `The rate is above the ${pct(c.after.ordinaryBracketRate)} bracket because the conversion drags other income into tax with it.`
            : 'The cost is the year’s tax with the conversion minus the tax without it.'}{' '}
          Paying the tax from money outside the Pre-tax account lets the whole amount go to Roth.
        </p>
      </section>

      {c.fills.length > 0 && (
        <section className="card" aria-labelledby="conv-fills">
          <h2 id="conv-fills">Converting to fill a bracket</h2>
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">Fill to the top of</th>
                <th scope="col">Convert</th>
                <th scope="col">Tax cost</th>
                <th scope="col">Rate</th>
              </tr>
            </thead>
            <tbody>
              {c.fills.map((f) => (
                <tr key={f.rate}>
                  <th scope="row">the {formatPercent(f.rate, 0)} bracket</th>
                  <td>{$(f.amount)}</td>
                  <td>{$(f.cost)}</td>
                  <td>{pct(f.costRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card" aria-labelledby="conv-bar">
        <h2 id="conv-bar">Where the conversion lands</h2>
        <BracketBar
          bar={c.bar}
          caption={
            <>
              The amber slice is what the conversion added (with any Social Security it made taxable). After it, ordinary taxable
              income reaches the <strong>{pct(c.bar.currentRate)}</strong> bracket, with <strong>{$(c.bar.room)}</strong> of
              room before the next one.
            </>
          }
        />
      </section>

      <p className="disclaimer">
        Estimates only — not tax or financial advice. One year, federal tax under current law. Not modeled: IRMAA
        (Medicare premium surcharges two years later), state tax, the five-year rule on converted amounts. For
        conversions over several years, use the withdrawal strategies on the projection page.
      </p>
    </div>
  );
}
