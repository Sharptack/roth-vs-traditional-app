// The signed-in advisor's saved households (Supabase, row-level security: only their own).
// Save the household on screen as new or over the one that's open, open one, delete one.
// The homepage shows the whole card; a calculator page shows it compact (compact): the household on
// screen and Save changes, with saving as new and the list behind a closed section.
import { useCallback, useEffect, useState } from 'react';
import { deleteHousehold, listHouseholds, loadHousehold, saveHousehold } from '../services/cloud.js';
import { sameSavedHousehold } from '../lib/savedHousehold.js';

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const NOTICE =
  'Testing stage: name households with initials or a nickname. Don’t store client names, account numbers or Social Security numbers yet.';

// opened: { id, label, values } of the household on screen (values = as last opened or saved), or
// null; onOpen({ id, label, values }); onSaved({ id, label, values }) after a save, onSaved(null) when
// the open household is deleted.
export default function SavedHouseholds({ client, values, opened, onOpen, onSaved, compact = false }) {
  const [rows, setRows] = useState(null);
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState(null); // { kind: 'ok' | 'error', message }
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows(await listHouseholds(client));
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    }
  }, [client]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (fn, okMessage) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      if (okMessage) setStatus({ kind: 'ok', message: okMessage });
      await refresh();
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const saveNew = () =>
    act(async () => {
      const saved = await saveHousehold(client, { label, values });
      onSaved({ id: saved.id, label: saved.label, values });
      setLabel('');
    }, 'Saved.');
  const saveOver = () =>
    act(async () => {
      const saved = await saveHousehold(client, { id: opened.id, label: opened.label, values });
      onSaved({ id: saved.id, label: saved.label, values });
    }, 'Changes saved.');

  const changed = Boolean(opened) && !sameSavedHousehold(values, opened.values);

  const onScreen = opened && (
    <p className="saved-on-screen">
      On screen: <strong>{opened.label}</strong>{' '}
      {changed ? <span className="saved-changed">Unsaved changes</span> : <span className="dim">Saved</span>}{' '}
      <button type="button" className="button secondary" disabled={busy || !changed} onClick={saveOver}>
        Save changes
      </button>
    </p>
  );

  const saveForm = (
    <form
      className="save-form"
      onSubmit={(e) => {
        e.preventDefault();
        saveNew();
      }}
    >
      <label htmlFor={compact ? 'save-label-compact' : 'save-label'}>
        {opened ? 'Or save as a new household' : 'Save this household as'}
      </label>
      <input
        id={compact ? 'save-label-compact' : 'save-label'}
        type="text"
        maxLength={80}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. J.M. 2026"
      />
      <button type="submit" className="button secondary" disabled={busy}>
        Save
      </button>
    </form>
  );

  const statusLine = status && (
    <p className={status.kind === 'error' ? 'hint error-text' : 'hint'} role="status">
      {status.message}
    </p>
  );

  const list =
    rows === null ? (
      <p className="hint">Loading&hellip;</p>
    ) : rows.length === 0 ? (
      <p className="hint">Nothing saved yet.</p>
    ) : (
      <ul className="saved-list">
        {rows.map((r) => (
          <li key={r.id} className={opened?.id === r.id ? 'current' : undefined}>
            <span className="saved-label">{r.label}</span>
            <span className="dim">{when(r.updated_at)}</span>
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={() => {
                if (changed && !window.confirm(`Open "${r.label}"? Unsaved changes to ${opened.label} will be lost.`)) return;
                act(async () => onOpen(await loadHousehold(client, r.id)), `Opened ${r.label}.`);
              }}
            >
              Open
            </button>
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete "${r.label}"? This can't be undone.`)) {
                  act(async () => {
                    await deleteHousehold(client, r.id);
                    if (opened?.id === r.id) onSaved(null);
                  }, `Deleted ${r.label}.`);
                }
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    );

  if (compact) {
    return (
      <section className="card saved-households compact" aria-label="Saved households">
        {onScreen ?? <p className="saved-on-screen dim">Not saved yet.</p>}
        {statusLine}
        <details className="details">
          <summary>{opened ? 'Save as new or open another household' : 'Save or open a household'}</summary>
          <p className="hint">{NOTICE}</p>
          {saveForm}
          {list}
        </details>
      </section>
    );
  }

  return (
    <section className="card saved-households" aria-labelledby="saved-title">
      <h2 id="saved-title">Saved households</h2>
      <p className="hint">{NOTICE}</p>
      {onScreen}
      {saveForm}
      {statusLine}
      {list}
    </section>
  );
}
