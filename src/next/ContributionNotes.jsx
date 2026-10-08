// "Who can contribute": the Roth vs. Pre-tax page's notes on choices this household doesn't fully
// have (lib/contributionRules.js). Nothing is shown when every choice is open.
export default function ContributionNotes({ notes }) {
  if (!notes || notes.length === 0) return null;
  return (
    <section className="card alert contribution-notes" aria-labelledby="contribution-notes">
      <h2 id="contribution-notes">Who can contribute</h2>
      <ul>
        {notes.map((n) => (
          <li key={`${n.owner}-${n.kind}`}>{n.message}</li>
        ))}
      </ul>
    </section>
  );
}
