// The preview's share link: every household input, accounts included (lib/householdLink.js).
// Optionally view only: the link opens locked, with an "Edit a copy" button.
import { useState } from 'react';
import { householdLinkSearch } from '../lib/householdLink.js';
import { NEXT_HASH } from '../lib/route.js';

export default function ShareHousehold({ values }) {
  const [viewOnly, setViewOnly] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'copied' | 'manual'
  const [url, setUrl] = useState('');

  const copy = async () => {
    const { origin, pathname } = window.location;
    const link = `${origin}${pathname}${householdLinkSearch(values, { viewOnly })}${NEXT_HASH}`;
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  };

  return (
    <div className="share-inputs">
      <button type="button" className="button secondary" onClick={copy}>
        Copy link to this household
      </button>
      <label className="checkbox">
        <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} /> View only
      </label>
      {status === 'copied' && (
        <span className="hint" role="status">
          Copied{viewOnly ? ' (opens locked, with an "Edit a copy" button)' : ''}.
        </span>
      )}
      {status === 'manual' && (
        <textarea className="share-text" readOnly value={url} rows={3} aria-label="Link to copy" onFocus={(e) => e.target.select()} />
      )}
    </div>
  );
}
