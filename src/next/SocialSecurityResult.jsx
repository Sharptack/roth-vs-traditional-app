// The Social Security calculator's results (phase 5): the household's lifetime benefits under the
// plan's claiming ages and the best pair, each person's table by claiming age, break-even ages, and
// for a couple the grid of every pair. Renders lib/socialSecurityCalculator.js's view; no math of
// its own. onUse(personId, age): "Use in the plan" (absent: view only).
import { useState } from 'react';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { socialSecurityHeadlines } from '../lib/blockHeadlines.js';
import Blocks from './Blocks.jsx';

export const WHO = { p1: 'You', p2: 'Your spouse' };
const whose = { p1: 'Your', p2: 'Your spouse’s' };
const k = (x) => `$${Math.round(x / 1000).toLocaleString('en-US')}k`;
const ageText = (a) => {
  if (a === null) return 'never (by 119)';
  const months = Math.round((a % 1) * 12);
  const years = Math.floor(a) + (months === 12 ? 1 : 0);
  return months % 12 ? `${years} and ${months} months` : `${years}`;
};

export default function SocialSecurityResult({ view, onUse }) {
  const [picked, setPicked] = useState(null); // a grid cell's claiming ages
  if (!view) {
    return (
      <section className="card">
        <h2>Needs inputs</h2>
        <p>Fill in each person&rsquo;s age and Social Security on the inputs page to work it out.</p>
      </section>
    );
  }
  const { people, plan, tables, grid, discountRate } = view;
  const couple = people.length === 2;
  const discounted = discountRate > 0;
  const totalWord = discounted ? `discounted at ${formatPercent(discountRate, 0)}` : 'before tax';
  const h = socialSecurityHeadlines(view);
  const planAges = people.map((p) => p.planClaimAge);
  const ageLabel = (p, a) => (a === null ? 'receiving now' : `${a}`);
  const best = couple ? grid.best : tables[0].best ? { claimAges: [tables[0].best.claimAge], discountedTotal: tables[0].best.householdTotal } : null;
  const bestIsPlan = best && best.claimAges.every((a, i) => a === planAges[i]);
  const applyAges = (ages) => ages.forEach((a, i) => a !== null && a !== planAges[i] && onUse(people[i].id, a));

  const summary = (
    <>
      <div className="hero">
        <div className="hero-value">{$(plan.discountedTotal)}</div>
        <div className="hero-sub">
          {couple ? (
            <>
              Household Social Security over both lifetimes ({totalWord}), claiming as the plan does:{' '}
              {people.map((p, i) => `${WHO[p.id].toLowerCase()} ${ageLabel(p, planAges[i])}`).join(', ')}. Each person to their life expectancy (
              {people.map((p) => `${WHO[p.id].toLowerCase()} ${p.planToAge}`).join(', ')}).
            </>
          ) : (
            <>
              Social Security over your lifetime ({totalWord}), claiming {planAges[0] === null ? 'as you do now' : `at ${planAges[0]}, as the plan does`}, to your life
              expectancy ({people[0].planToAge}).
            </>
          )}
        </div>
      </div>
      {best && (
        <p className="rate-lean">
          <strong>
            {bestIsPlan
              ? 'The plan’s claiming ages pay the most.'
              : `Most: ${people.map((p, i) => `${WHO[p.id].toLowerCase()} ${ageLabel(p, best.claimAges[i])}`).join(', ')}, ${$(best.discountedTotal)} (${$(best.discountedTotal - plan.discountedTotal)} more).`}
          </strong>
        </p>
      )}
      {best && !bestIsPlan && onUse && (
        <button type="button" className="button" onClick={() => applyAges(best.claimAges)}>
          Use these claiming ages in the plan
        </button>
      )}
      <div className="calc">
        {couple && people.map((p, i) => (
          <div key={p.id}>
            <div className="calc-row"><span>{whose[p.id]} own</span><span>{$(plan.people[i].own)}</span></div>
            {plan.people[i].spousal > 0 && <div className="calc-row sub"><span>{whose[p.id]} spousal benefit (on top)</span><span>{$(plan.people[i].spousal)}</span></div>}
            {plan.people[i].survivor > 0 && <div className="calc-row sub"><span>{whose[p.id]} survivor benefit (on top, after the first death)</span><span>{$(plan.people[i].survivor)}</span></div>}
          </div>
        ))}
        <div className="calc-row total"><span>Before tax, not discounted</span><span>{$(plan.total)}</span></div>
      </div>
      <p className="hint">Today&rsquo;s dollars: benefits rise with prices. Tax on the benefits is in the other calculators.</p>
    </>
  );

  const personBlock = (t, i) => {
    const p = people[i];
    if (t.receiving) {
      return {
        id: `person-${p.id}`,
        title: `${WHO[p.id]}: already receiving`,
        summary: `${$(t.monthly)} per month`,
        content: <p>{WHO[p.id]} already receive{p.id === 'p1' ? '' : 's'} {$(t.monthly)} a month, so the claiming age is settled; it counts from this year to age {p.planToAge}.</p>,
      };
    }
    return {
      id: `person-${p.id}`,
      title: couple ? `${WHO[p.id]}: when to claim` : 'When to claim',
      summary: h.people[i],
      content: (
        <>
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">Claim at</th>
                <th scope="col">Per month</th>
                <th scope="col">{couple ? `${whose[p.id]} own, to ${p.planToAge}` : `Lifetime, to ${p.planToAge}`}</th>
                {couple && <th scope="col">Household ({totalWord})</th>}
                {onUse && <th scope="col"><span className="sr-only">Use</span></th>}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.claimAge} className={r.inPlan ? 'chosen-row' : undefined}>
                  <th scope="row">{r.claimAge}{r.inPlan ? ' (the plan)' : ''}{r === t.best ? ' ★' : ''}</th>
                  <td>{$(r.monthly)}</td>
                  <td>{$(r.ownTotal)}</td>
                  {couple && <td>{$(r.householdTotal)}</td>}
                  {onUse && (
                    <td>
                      {!r.inPlan && (
                        <button type="button" className="link-button nowrap" onClick={() => onUse(p.id, r.claimAge)}>
                          Use in the plan
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {t.pia > 0 ? <>From a benefit at full retirement age of {$(t.pia)} a month{p.mode === 'estimate' ? ' (estimated from earnings; enter it from ssa.gov for a precise figure)' : ''}. </> : <>No benefit of their own (a full-retirement-age benefit of $0). </>}
            ★ the most for the household{couple ? `, with ${WHO[people[1 - i].id].toLowerCase()} claiming as the plan does` : ''}.
            {couple && ' The household column includes spousal and survivor benefits.'}
          </p>
          {t.breakEvens.length > 0 && (
            <div className="calc">
              {t.breakEvens.map((b) => (
                <div key={`${b.earlyAge}-${b.lateAge}`} className="calc-row">
                  <span>Claiming at {b.lateAge} instead of {b.earlyAge} has paid more by age</span>
                  <span>{ageText(b.age)}</span>
                </div>
              ))}
            </div>
          )}
          {t.breakEvens.length > 0 && <p className="hint">Break-even ages on {whose[p.id].toLowerCase()} own benefit, {discounted ? `each year discounted at ${formatPercent(discountRate, 0)}` : 'not discounted'}.</p>}
        </>
      ),
    };
  };

  const gridBlock = grid && grid.cells.length > 1 && {
    id: 'grid',
    title: 'Every pair of claiming ages',
    summary: h.grid,
    content: (
      <>
        <div className="table-scroll">
          <table className="compare-table ss-grid">
            <thead>
              <tr>
                <th scope="col">You \ Your spouse</th>
                {grid.ages[1].map((b) => <th key={b} scope="col">{b ?? 'receiving'}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.ages[0].map((a) => (
                <tr key={a}>
                  <th scope="row">{a ?? 'receiving'}</th>
                  {grid.ages[1].map((b) => {
                    const c = grid.cells.find((x) => x.claimAges[0] === a && x.claimAges[1] === b);
                    const isBest = c === grid.best;
                    const isPlan = a === planAges[0] && b === planAges[1];
                    const isPicked = picked && picked[0] === a && picked[1] === b;
                    const cls = [isPlan && 'chosen-row', isBest && 'best-cell', isPicked && 'picked-cell'].filter(Boolean).join(' ');
                    return (
                      <td key={b} className={cls || undefined}>
                        <button type="button" className="link-button" onClick={() => setPicked([a, b])} aria-pressed={Boolean(isPicked)}>
                          {k(c.discountedTotal)}{isBest ? ' ★' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Household lifetime benefits ({totalWord}) for each pair: own, spousal and survivor. ★ the most; shaded: the plan. Choose a cell to see it.</p>
        {picked && (() => {
          const c = grid.cells.find((x) => x.claimAges[0] === picked[0] && x.claimAges[1] === picked[1]);
          const isPlan = picked.every((a, i) => a === planAges[i]);
          return (
            <div className="calc">
              {people.map((p, i) => (
                <div key={p.id} className="calc-row">
                  <span>{whose[p.id]} at {picked[i] ?? 'now'}: own {$(c.people[i].own)}{c.people[i].spousal > 0 ? `, spousal ${$(c.people[i].spousal)}` : ''}{c.people[i].survivor > 0 ? `, survivor ${$(c.people[i].survivor)}` : ''}</span>
                  <span>{$(c.people[i].own + c.people[i].spousal + c.people[i].survivor)}</span>
                </div>
              ))}
              <div className="calc-row total"><span>Household ({totalWord})</span><span>{$(c.discountedTotal)}</span></div>
              {onUse && !isPlan && (
                <button type="button" className="button secondary" onClick={() => applyAges(picked)}>
                  Use you {picked[0] ?? 'now'}, your spouse {picked[1] ?? 'now'} in the plan
                </button>
              )}
            </div>
          );
        })()}
      </>
    ),
  };

  return (
    <Blocks
      blocks={[
        { id: 'plan', title: 'Lifetime Social Security', summary: h.plan, className: 'key-card', content: summary },
        ...tables.map(personBlock),
        gridBlock,
      ]}
      disclaimer="Estimates only — not tax or financial advice. Gross benefits in today’s dollars. SSA’s rules for reductions, delayed credits, spousal and survivor benefits; not modeled: the earnings test, benefits for children or ex-spouses."
    />
  );
}
