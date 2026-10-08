// The preview's sharing: a link carrying every household input, accounts included
// (lib/householdLink.js), optionally view only (it opens locked, with an "Edit a copy" button);
// and a plain-text summary of the inputs and every calculator's headline, with the link
// (lib/householdText.js), for pasting into a conversation or an email.
import { useState } from 'react';
import { householdLinkSearchV2 } from '../lib/householdLink.js';
import { householdShareText } from '../lib/householdText.js';
import { HOME_HASH } from '../lib/route.js';

// household, getTiles: for the summary; getTiles() -> [{ title, headline, detail }] per calculator,
// called only when the summary is copied (some calculators are worked out on demand).
export default function ShareHousehold({ values, household, getTiles }) {
  const [viewOnly, setViewOnly] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'copied' | 'manual'
  const [copied, setCopied] = useState(''); // what was (or should be) copied
  const [what, setWhat] = useState('link');

  const link = () => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}${householdLinkSearchV2(values, { viewOnly })}${HOME_HASH}`;
  };
  const copy = async (kind) => {
    const text = kind === 'link' ? link() : householdShareText({ household, tiles: getTiles(), url: link() });
    setWhat(kind);
    setCopied(text);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  };

  return (
    <div className="share-inputs">
      <button type="button" className="button secondary" onClick={() => copy('link')}>
        Copy link to this household
      </button>
      <label className="checkbox">
        <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} /> View only
      </label>
      {household && getTiles && (
        <button type="button" className="link-button share-summary" onClick={() => copy('summary')}>
          Copy summary (inputs, results, link)
        </button>
      )}
      {status === 'copied' && (
        <span className="hint" role="status">
          {what === 'link' ? 'Link copied' : 'Summary copied'}
          {viewOnly ? ' (the link opens locked, with an "Edit a copy" button)' : ''}.
        </span>
      )}
      {status === 'manual' && (
        <textarea
          className="share-text"
          readOnly
          value={copied}
          rows={what === 'link' ? 3 : 12}
          aria-label={what === 'link' ? 'Link to copy' : 'Summary to copy'}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
