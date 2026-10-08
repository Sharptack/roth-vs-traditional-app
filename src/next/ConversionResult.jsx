// The Roth conversion calculator's results (single year), as blocks: the conversion's tax cost, what it is
// made of, the conversion that would fill each bracket, and the bracket bar with the conversion's
// own slice marked. Renders lib/conversionCalculator.js's conversionResult; no math of its own.
import { conversionHeadlines } from '../lib/blockHeadlines.js';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import Blocks from './Blocks.jsx';
import { BracketBar } from './TaxResult.jsx';

const pct = (r) => formatPercent(r, 1);

export default function ConversionResult({ conversion: c, pretaxBalance }) {
  const irmaa = c.irmaa && c.irmaa.after.enrolled > 0 ? c.irmaa : null;
  const dragged = c.extraTaxableSocialSecurity > 0.5 || c.deductionLost > 0.5 || c.parts.capitalGainsTax > 0.5 || c.parts.niit > 0.5;
  const h = conversionHeadlines(c);
  const cost = (
      <>
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
          {irmaa && irmaa.added > 0.5 && (
            <>
              <div className="calc-row">
                <span>Medicare IRMAA in {irmaa.premiumYear} (tier {irmaa.before.tier} to {irmaa.after.tier})</span>
                <span>{$(irmaa.added)}</span>
              </div>
              <div className="calc-row total"><span>Tax cost plus IRMAA</span><span>{$(c.cost + irmaa.added)}</span></div>
            </>
          )}
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
        {irmaa && (
          <p className="hint">
            {irmaa.room === null
              ? `This year's income is already in the top Medicare IRMAA tier for ${irmaa.premiumYear}.`
              : `Medicare IRMAA in ${irmaa.premiumYear}: converting up to ${$(irmaa.room)} keeps this year's MAGI in ${irmaa.before.tier === 0 ? 'the no-surcharge tier' : `tier ${irmaa.before.tier}`}.`}{' '}
            The surcharge is set by this year&rsquo;s income and paid two years later, by anyone 65 or older by then.
          </p>
        )}
      </>
  );
  const fills = (
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
  );
  const where = (
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
  );
  return (
    <Blocks
      blocks={[
        { id: 'cost', title: 'Tax cost of the conversion', summary: h.cost, className: 'key-card', content: cost },
        c.fills.length > 0 && { id: 'fills', title: 'Converting to fill a bracket', summary: h.fills, content: fills },
        { id: 'bar', title: 'Where the conversion lands', summary: h.bar, content: where },
      ]}
      disclaimer="Estimates only — not tax or financial advice. One year, federal tax under current law. IRMAA at this year’s amounts (when included in Assumptions). Not modeled: state tax, the five-year rule on converted amounts. For conversions over several years, use the withdrawal strategies on the projection page."
    />
  );
}
