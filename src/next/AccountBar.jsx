// Sign-in for the #/next preview: an email link (no passwords), invite only. Shown only when a
// backend is configured (src/services/supabaseClient.js).
import { useState } from 'react';
import { sendSignInLink, signOut } from '../services/cloud.js';
import { HOME_HASH } from '../lib/route.js';

export default function AccountBar({ client, cloud, onSignedOut }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ kind: 'idle' }); // idle | sending | sent | error
  if (!cloud.configured || !cloud.ready || !client) return null;

  if (cloud.session) {
    return (
      <p className="account-bar">
        Signed in as <strong>{cloud.email}</strong>{' '}
        <button
          type="button"
          className="link-button"
          onClick={async () => {
            await signOut(client).catch(() => {});
            onSignedOut?.();
          }}
        >
          Sign out
        </button>
      </p>
    );
  }

  const send = async (e) => {
    e.preventDefault();
    setStatus({ kind: 'sending' });
    try {
      const { origin, pathname } = window.location;
      await sendSignInLink(client, email, `${origin}${pathname}${HOME_HASH}`);
      setStatus({ kind: 'sent' });
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    }
  };

  return (
    <div className="account-bar">
      {!open ? (
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Sign in to save households
        </button>
      ) : status.kind === 'sent' ? (
        <p role="status">
          If <strong>{email.trim()}</strong> has an account, a sign-in link is on its way. Open it in this browser.
        </p>
      ) : (
        <form className="account-form" onSubmit={send}>
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="button secondary" disabled={status.kind === 'sending'}>
            Email me a sign-in link
          </button>
          {status.kind === 'error' && <span className="hint error-text">{status.message}</span>}
          <span className="hint">Accounts are by invitation.</span>
        </form>
      )}
    </div>
  );
}
