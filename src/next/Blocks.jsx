// A calculator's results as blocks (round 2 phase 0, step c): collapsible cards in the Roth page's
// format (ResultsSummary.jsx), each with its title and a one-line headline that stays in view
// when it is closed (lib/blockHeadlines.js), and one "Expand all / Collapse all" for the page.
// Each block is self-contained, so a later page (the plan comparison) can reuse it.
import { useState } from 'react';
import Collapsible, { toggleId } from '../components/Collapsible.jsx';

// blocks: [{ id, title, summary, content, className, closed }] (falsy entries are skipped);
//   closed: starts closed (long detail, like the full tax calculation).
// disclaimer: the line under the blocks.
export default function Blocks({ blocks, disclaimer }) {
  const shown = blocks.filter(Boolean);
  const [open, setOpen] = useState(() => new Set(shown.filter((b) => !b.closed).map((b) => b.id)));
  const allOpen = shown.every((b) => open.has(b.id));
  return (
    <div className="results">
      <div className="results-head">
        <h2 className="sr-only">Results</h2>
        <button type="button" className="link-button" onClick={() => setOpen(new Set(allOpen ? [] : shown.map((b) => b.id)))}>
          {allOpen ? 'Collapse all results' : 'Expand all results'}
        </button>
      </div>
      {shown.map((b) => (
        <Collapsible
          key={b.id}
          headingId={`block-${b.id}`}
          className={b.className}
          title={b.title}
          summary={b.summary}
          open={open.has(b.id)}
          onToggle={() => setOpen(toggleId(open, b.id))}
        >
          {b.content}
        </Collapsible>
      ))}
      {disclaimer && <p className="disclaimer">{disclaimer}</p>}
    </div>
  );
}
