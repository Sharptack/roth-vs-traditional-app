// The Roth conversion calculator's results, as blocks (reworked 2026-10-09): the conversion over a
// lifetime (the three figures it turns on: lifetime tax, the legacy, retirement income, with and
// without it); this year's tax on it, with its effective rate; the bracket bar with the conversion's
// own slice and the conversion that fills each bracket marked; and charts (the tax paid each year as bars).
// Renders lib/conversionCalculator.js's conversionResult and lib/conversionLifetime.js's
// conversionLifetime; no math of its own.
import { conversionHeadlines } from '../lib/blockHeadlines.js';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import GroupedBarChart from '../components/charts/GroupedBarChart.jsx';
import Blocks from './Blocks.jsx';
import { BracketBar } from './TaxResult.jsx';

const pct = (r) => formatPercent(r, 1);
const short = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);
const signed = (v) => (Math.abs(v) < 0.5 ? '$0' : `${v >= 0 ? '+' : '−'}${$(Math.abs(v))}`);
// With the conversion = blue, without = grey.
const WITH_COLOR = 'var(--series-1)';
const WITHOUT_COLOR = 'var(--dim)';

// One of the three figures: with, without, and the difference (lowerIsBetter: lifetime tax).
function KeyFigure({ label, withIt, without, lowerIsBetter = false, sub }) {
  const d = withIt - without;
  const better = Math.abs(d) >= 0.5 && (lowerIsBetter ? d < 0 : d > 0);
  return (
    <div className="conversion-key">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{$(withIt)}</div>
      <div className="stat-sub">
        with the conversion; {$(without)} without:{' '}
        <strong className={better ? 'better' : undefined}>{signed(d)}</strong>
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Lifetime({ lifetime: l }) {
  const w = l.with.totals;
  const wo = l.without.totals;
  const d = l.difference;
  const end = l.years[l.years.length - 1];
  const heirs = Math.round(l.heirTaxRate * 100);
  return (
    <>
      <div className="conversion-keys">
        <KeyFigure label="Lifetime tax (federal income tax and IRMAA)" withIt={w.lifetimeTax} without={wo.lifetimeTax} lowerIsBetter />
        <KeyFigure
          label={`Legacy: the portfolio in ${end.year}`}
          withIt={w.legacy}
          without={wo.legacy}
          sub={
            <>
              After the heirs&rsquo; {heirs}% tax on Pre-tax money{l.charityShare > 0 ? ` (${Math.round(l.charityShare * 100)}% to charity, Pre-tax first, untaxed)` : ''}: {$(w.legacyAfterTax)} with, {$(wo.legacyAfterTax)} without (
              <strong className={d.legacyAfterTax > 0.5 ? 'better' : undefined}>{signed(d.legacyAfterTax)}</strong>)
            </>
          }
        />
        <KeyFigure label="Total retirement income" withIt={w.retirementIncome} without={wo.retirementIncome} />
      </div>
      {(l.with.runOutYear || l.without.runOutYear) && (
        <p className="alert">
          The money runs out {l.with.runOutYear ? `in ${l.with.runOutYear} with the conversion` : 'never with the conversion'} and{' '}
          {l.without.runOutYear ? `in ${l.without.runOutYear} without it` : 'never without it'}: after that, spending goes unmet and
          less tax is paid, so the figures above compare plans that both fall short.
        </p>
      )}
      <p className="hint">
        Both runs are the year-by-year projection to {end.year}, alike but for this year&rsquo;s {$(l.amount)} conversion:
        the same spending in retirement, withdrawal strategy and returns. Retirement income is everything withdrawn and
        received in the years anyone is retired (withdrawals, Social Security, pensions, other income); with spending fixed,
        lower taxes later mean less has to be withdrawn, so compare it with the tax and the legacy.
        {l.with.rows[0].conversionTaxWithheld > 0.5 &&
          ` While working, there are no withdrawals to pay the conversion's tax from, so it is held back from the conversion: ${$(
            l.with.rows[0].conversionTaxWithheld,
          )} of it, and ${$(l.amount - l.with.rows[0].conversionTaxWithheld)} reaches Roth.`}
      </p>
    </>
  );
}

// The charts block (decided 2026-10-09: its own block at the bottom; more charts may join it).
function Charts({ lifetime: l }) {
  const w = l.with.totals;
  const wo = l.without.totals;
  const end = l.years[l.years.length - 1];
  return (
    <>
      <h3 className="subhead">Tax paid each year</h3>
      <GroupedBarChart
        x={l.years.map((y) => y.year)}
        series={[
          { key: 'with', label: 'With the conversion', color: WITH_COLOR, values: l.years.map((y) => y.with) },
          { key: 'without', label: 'Without it', color: WITHOUT_COLOR, values: l.years.map((y) => y.without) },
        ]}
        formatX={(v) => `${v}`}
        formatY={(v) => $(v)}
        formatYTick={short}
        xLabel="Year"
        yLabel="Income tax + IRMAA (today's dollars)"
      />
      <div className="calc">
        <div className="calc-row total">
          <span>Total, every year to {end.year}</span>
          <span>
            {$(w.lifetimeTax)} with · {$(wo.lifetimeTax)} without
          </span>
        </div>
        {(w.irmaa > 0.5 || wo.irmaa > 0.5) && (
          <div className="calc-row sub">
            <span>of it, Medicare IRMAA</span>
            <span>
              {$(w.irmaa)} with · {$(wo.irmaa)} without
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// lifetimeError: why there is no lifetime view (the household's first error), when there is none.
export default function ConversionResult({ conversion: c, pretaxBalance, lifetime, lifetimeError }) {
  const irmaa = c.irmaa && c.irmaa.after.enrolled > 0 ? c.irmaa : null;
  const dragged = c.extraTaxableSocialSecurity > 0.5 || c.deductionLost > 0.5 || c.parts.capitalGainsTax > 0.5 || c.parts.niit > 0.5;
  const h = conversionHeadlines(c, lifetime);
  const cost = (
    <>
      <div className="conversion-cost">
        <div>
          <div className="stat-label">Tax this year</div>
          <div className="hero-value">{$(c.cost)}</div>
        </div>
        <div>
          <div className="stat-label">Effective rate of the conversion</div>
          <div className="hero-value">{pct(c.rate)}</div>
        </div>
      </div>
      <p className="hint">
        The rate is the tax the conversion adds ÷ the {$(c.amount)} converted: {$(c.after.incomeTax)} federal income tax with it,{' '}
        {$(c.before.incomeTax)} without.
      </p>
      {c.amount > pretaxBalance + 0.5 && <p className="alert">That is more than the {$(pretaxBalance)} in Pre-tax Existing Accounts.</p>}
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
  const where = (
    <BracketBar
      bar={c.bar}
      notes={c.fills.map((f) => ({ rate: f.rate, text: `converting ${$(f.amount)} fills it` }))}
      caption={
        <>
          The amber slice is what the conversion added (with any Social Security it made taxable). After it, ordinary taxable
          income reaches the <strong>{pct(c.bar.currentRate)}</strong> bracket, with <strong>{$(c.bar.room)}</strong> of room
          before the next one. Beside each bracket&rsquo;s top: the conversion that fills it, from this year&rsquo;s income
          without a conversion.
        </>
      }
    />
  );
  return (
    <Blocks
      blocks={[
        lifetime && { id: 'lifetime', title: 'Over a lifetime, with and without it', summary: h.lifetime, className: 'key-card', content: <Lifetime lifetime={lifetime} /> },
        !lifetime &&
          lifetimeError && {
            id: 'lifetime',
            title: 'Over a lifetime, with and without it',
            summary: 'Needs the inputs below',
            content: (
              <p className="hint">
                {lifetimeError} The lifetime view runs the year-by-year projection, which needs the household&rsquo;s spending in
                retirement (Spending, on the inputs page).
              </p>
            ),
          },
        { id: 'cost', title: 'This year’s tax on the conversion', summary: h.cost, className: lifetime ? undefined : 'key-card', content: cost },
        { id: 'bar', title: 'Where the conversion lands', summary: h.bar, content: where },
        lifetime && { id: 'charts', title: 'Charts', summary: 'Tax paid each year, with and without it', content: <Charts lifetime={lifetime} /> },
      ]}
      disclaimer="Estimates only — not tax or financial advice. Federal tax under current law, in today's dollars. IRMAA at this year’s amounts (when included in Assumptions). Not modeled: state tax, the five-year rule on converted amounts. One conversion this year; for conversions every year, use the withdrawal strategies on the projection page."
    />
  );
}
