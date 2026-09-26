import { useState } from 'react';
import { shareText, valuesToSearch } from '../lib/shareInputs.js';

// "Copy inputs": puts a plain-text summary of the scenario (every input, the headline
// results, and a link that reopens it) on the clipboard, ready to paste into a chat
// or an email. If the browser won't allow clipboard access, shows the text to copy by hand.
export default function ShareInputs({ values, compareValues, year }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'copied' | 'manual'
  const [text, setText] = useState('');

  const copy = async () => {
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}${valuesToSearch(values, compareValues)}`;
    const summary = shareText({ values, compareValues, year, url });
    setText(summary);
    try {
      await navigator.clipboard.writeText(summary);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  };

  return (
    <div className="share-inputs">
      <button type="button" className="button secondary" onClick={copy}>
        Copy inputs to share
      </button>
      {status === 'copied' && (
        <span className="hint" role="status">
          Copied: every input, the headline results, and a link that reopens this scenario.
        </span>
      )}
      {status === 'manual' && (
        <textarea
          className="share-text"
          readOnly
          value={text}
          rows={12}
          aria-label="Scenario to copy"
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
