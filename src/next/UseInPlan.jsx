// "Use in the plan" on the Roth vs. Pre-tax page (the first one, a trial; round 2, How the plan
// fits together): the plan's choice today, which way the comparison leans, and a button that
// switches the plan's Future Contributions to the other type at the same take-home cost
// (lib/useInPlan.js). Pressing the other way switches back.
import { formatCurrency as $ } from '../lib/format.js';

const NAME = { roth: 'Roth', pretax: 'Pre-tax' };

export default function UseInPlan({ choice, onUse }) {
  if (!choice) return null;
  const { current, other, winner, currentTotal, otherTotal } = choice;
  const lean = winner === 'even' ? 'The comparison calls it about even.' : `The comparison leans ${NAME[winner]}.`;
  return (
    <section className="card use-in-plan" aria-labelledby="use-in-plan">
      <h2 id="use-in-plan">In the plan</h2>
      <p>
        The plan saves <strong>{$(currentTotal)} per year {NAME[current]}</strong>. {lean}
      </p>
      <button type="button" className={winner === other ? 'button' : 'button secondary'} onClick={onUse}>
        Use {NAME[other]} in the plan: {$(otherTotal)} per year
      </button>
      <p className="hint">
        The same take-home cost either way. This writes the choice into Future Contributions, which every calculator reads
        (the projection, the tax page...); press it again the other way to switch back. A trial of the plan&rsquo;s
        &ldquo;Use in the plan&rdquo; buttons.
      </p>
    </section>
  );
}
