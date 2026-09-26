import { useId } from 'react';

// A section that opens and closes from its header. The header always shows the title
// and a one-line summary (sectionSummaries.js), so a closed section still says what's in
// it. A closed body is `hidden`, not unmounted: inputs, open dropdowns and anything
// typed survive closing and reopening.
//
// variant 'card' = a results card (h2); 'row' = one row of the inputs list (h3).
// headingId: optional id for the heading (the results cards keep their sec1… ids).
export default function Collapsible({
  title,
  summary,
  open,
  onToggle,
  changed = false,
  variant = 'card',
  headingId,
  className = '',
  children,
}) {
  const bodyId = useId();
  const autoId = useId();
  const labelId = headingId ?? autoId;
  const Heading = variant === 'card' ? 'h2' : 'h3';
  const classes = [
    'collapsible',
    variant === 'card' ? 'card collapsible-card' : 'collapsible-row',
    open && 'open',
    changed && 'changed',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} aria-labelledby={labelId}>
      <Heading className="collapsible-heading">
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span className="collapsible-chevron" aria-hidden="true" />
          <span className="collapsible-title" id={labelId}>
            {title}
          </span>
          {summary && <span className="collapsible-summary">{summary}</span>}
          {changed && <span className="collapsible-flag">changed</span>}
        </button>
      </Heading>
      <div id={bodyId} className="collapsible-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

// Open/closed state for a list of sections: a Set of open ids.
export function toggleId(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
