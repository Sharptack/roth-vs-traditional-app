// "Send feedback", on every page (round 2, "throughout"): a short form, sent through Netlify Forms
// (lib/feedback.js). No sign-in. The page it was sent from is filled in automatically.
import { useId, useState } from 'react';
import { feedbackBody, feedbackErrors } from '../lib/feedback.js';

export default function Feedback() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({ message: '', contact: '', botField: '' });
  const [status, setStatus] = useState({ kind: 'idle' }); // idle | sending | sent | error
  const set = (name) => (e) => setFields({ ...fields, [name]: e.target.value });

  const send = async (e) => {
    e.preventDefault();
    const errors = feedbackErrors(fields);
    if (errors.length > 0) return setStatus({ kind: 'error', message: errors[0] });
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: feedbackBody({ ...fields, page: window.location.hash || '#/' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setFields({ message: '', contact: '', botField: '' });
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({ kind: 'error', message: "Couldn't send it. Check the connection and try again." });
    }
  };

  if (!open) {
    return (
      <p className="feedback">
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Send feedback
        </button>
        {status.kind === 'sent' && <span className="hint"> Thanks, it was sent.</span>}
      </p>
    );
  }
  return (
    <form className="card feedback-form" onSubmit={send} noValidate>
      <h2>Send feedback</h2>
      <p className="hint">Anything that is wrong, unclear or missing. The page you are on is sent with it.</p>
      <div className="field">
        <label htmlFor={`${id}-message`}>Message</label>
        <textarea id={`${id}-message`} rows={5} maxLength={5000} value={fields.message} onChange={set('message')} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-contact`}>Your name or email (optional, if you'd like a reply)</label>
        <input id={`${id}-contact`} type="text" maxLength={200} autoComplete="email" value={fields.contact} onChange={set('contact')} />
      </div>
      {/* The honeypot: hidden from people, filled in only by bots. */}
      <p className="sr-only" aria-hidden="true">
        <label>
          Leave this empty <input name="bot-field" tabIndex={-1} autoComplete="off" value={fields.botField} onChange={set('botField')} />
        </label>
      </p>
      {status.kind === 'error' && (
        <p className="hint error-text" role="status">
          {status.message}
        </p>
      )}
      <div className="row-actions">
        <button type="submit" className="button" disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setOpen(false);
            setStatus({ kind: 'idle' });
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
