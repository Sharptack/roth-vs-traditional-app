// The Retirement spending page's results (roadmap phase 3 step c), as blocks: what the resources
// allow beside the spending need, the legacy goal, and "Use in the plan". Renders
// lib/retirementSpending.js's retirementSpendingView; no math of its own.
import { formatCurrency as $ } from '../lib/format.js';
import Blocks from './Blocks.jsx';

// Headlines for the blocks (shown when closed, and on the dashboard tile).
export function retirementSpendingHeadlines(view) {
  if (!view.reachable) return { allow: 'The legacy goal is out of reach', legacy: 'Out of reach' };
  return {
    allow: `${$(view.sustainable)} per year after tax`,
    legacy: view.legacy.target > 0 ? `${$(view.legacy.target)} left, costing ${$(view.withoutGoal - view.sustainable)} per year` : 'None set: spend it all',
  };
}

// error: why there is no view (the spending need's reason), when there is none.
// choice / onUse: "Use in the plan" (lib/retirementSpending.js spendingChoice), absent when locked.
export default function RetirementSpendingResult({ view, error, choice, onUse }) {
  if (!view) {
    return (
      <section className="card">
        <h2>Retirement spending</h2>
        <p>{error ?? 'Fill in the household inputs to work it out.'}</p>
      </section>
    );
  }
  const h = retirementSpendingHeadlines(view);
  const { sustainable, need, difference, legacy } = view;
  const goal = legacy.target > 0;
  const afterTax = legacy.measure === 'afterTax' ? ' after tax' : '';
  const room = Math.abs(difference) < 1 ? 'the same as' : difference > 0 ? `${$(difference)} more than` : `${$(-difference)} less than`;
  const allow = view.reachable ? (
    <>
      <div className="hero">
        <div className="hero-value">{$(sustainable)}</div>
        <div className="hero-sub">
          per year after tax, in today&rsquo;s dollars, to {view.endLabel}
          {goal ? `, leaving the ${$(legacy.target)} legacy goal${afterTax}` : ''}
        </div>
      </div>
      <dl className="facts lead-facts">
        <div>
          <dt>The spending need (retirement income number)</dt>
          <dd>{$(need)} per year</dd>
        </div>
        <div>
          <dt>The difference</dt>
          <dd>
            {difference >= 0 ? '+' : '−'}
            {$(Math.abs(difference))} per year
          </dd>
        </div>
      </dl>
      <p className="note">
        The resources allow {room} the household plans to spend. {difference < -0.5 && 'At the spending need, the money runs out or the goal is missed: spend less, save more, or lower the goal. '}
        This is the highest steady after-tax spending that never falls short and leaves the goal, with every other part of the
        plan as it stands (income, Social Security, the withdrawal strategy, survivor years).
      </p>
      {choice && onUse && (
        <div className="use-in-plan">
          <button type="button" className="button" onClick={onUse}>
            Use in the plan: spend {$(choice.need)} per year
          </button>
          <p className="hint">
            Sets retirement spending to the budget, {$(choice.baseline)} per year
            {choice.baseline !== Math.floor(choice.spending) ? ' today (the costs that end and the lifestyle setting take it to this figure in retirement)' : ''}.
            Every calculator reads it.
          </p>
        </div>
      )}
    </>
  ) : (
    <p className="alert">
      Even spending nothing, the plan leaves less than the {$(legacy.target)} legacy goal{afterTax} at {view.endLabel}. Lower the goal to see
      what the resources allow.
    </p>
  );
  const legacyBlock = goal ? (
    <>
      <p>
        Leaving {$(legacy.target)}
        {afterTax} costs <strong>{$(view.withoutGoal - sustainable)} per year</strong> of spending: with no goal the resources allow{' '}
        {$(view.withoutGoal)} per year.
      </p>
      <p className="hint">
        At {$(sustainable)} per year, {$(view.endingValue)} is left{afterTax}
        {legacy.measure === 'afterTax' ? `, Pre-tax money counted at the heirs' ${Math.round((legacy.heirTaxRate ?? 0) * 100)}% rate` : ''}.
        Set the goal under Legacy goal.
      </p>
    </>
  ) : (
    <p>
      No legacy goal is set, so this spends the money down to $0 at {view.endLabel}. Set one under Legacy goal to see what leaving
      money costs.
    </p>
  );
  return (
    <Blocks
      blocks={[
        { id: 'allow', title: 'What the resources allow', summary: h.allow, className: 'key-card', content: allow },
        { id: 'legacy', title: 'The legacy goal', summary: h.legacy, content: legacyBlock },
      ]}
      disclaimer="Estimates only — not tax or financial advice. Today’s dollars at constant after-inflation returns; spending flat (lower after the first death for a couple, by the assumption); the same plan as the year-by-year projection; no state tax."
    />
  );
}
