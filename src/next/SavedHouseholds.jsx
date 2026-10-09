// The signed-in advisor's saved households (Supabase, row-level security: only their own).
// The dashboard and the inputs page show the whole card: every client in a dropdown (choosing one
// opens it), save the household on screen as new or over the one that's open, delete it. Every other page shows it
// compact (compact, decided 2026-10-08): only the household on screen, with Save changes, Re-open
// saved (back to the saved version) and saving as new; no list of clients.
import { useCallback, useEffect, useState } from 'react';
import Collapsible from '../components/Collapsible.jsx';
import { deleteHousehold, listHouseholds, loadHousehold, saveHousehold } from '../services/cloud.js';
import { HOME_HASH } from '../lib/route.js';
import { sameSavedHouseholdV2 } from '../lib/savedHousehold.js';

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const NOTICE =
  'Testing stage: name households with initials or a nickname. Don’t store client names, account numbers or Social Security numbers yet.';

// opened: { id, label, values } of the household on screen (values = as last opened or saved), or
// null; onOpen({ id, label, values }); onSaved({ id, label, values }) after a save, onSaved(null) when
// the open household is deleted. clearControl: the "Clear inputs" button (NextApp.jsx), shown on the card.
export default function SavedHouseholds({ client, values, opened, onOpen, onSaved, clearControl, compact = false }) {
  const [rows, setRows] = useState(null);
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState(null); // { kind: 'ok' | 'error', message }
  const [busy, setBusy] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setRows(await listHouseholds(client));
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    }
  }, [client]);
  useEffect(() => {
    if (!compact) refresh();
  }, [refresh, compact]);

  const act = async (fn, okMessage) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      if (okMessage) setStatus({ kind: 'ok', message: okMessage });
      if (!compact) await refresh();
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

  const changed = Boolean(opened) && !sameSavedHouseholdV2(values, opened.values);

  const onScreen = opened && (
    <p className="saved-on-screen">
      On screen: <strong>{opened.label}</strong>{' '}
      {changed ? <span className="saved-changed">Unsaved changes</span> : <span className="dim">Saved</span>}{' '}
      <button type="button" className="button secondary" disabled={busy || !changed} onClick={saveOver}>
        Save changes
      </button>{' '}
      {changed && (
        <button
          type="button"
          className="link-button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Re-open the saved ${opened.label}? Unsaved changes will be lost.`)) onOpen(opened);
          }}
        >
          Re-open saved
        </button>
      )}
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

  const openRow = (id) => {
    const r = rows.find((x) => x.id === id);
    if (!r || r.id === opened?.id) return;
    if (changed && !window.confirm(`Open "${r.label}"? Unsaved changes to ${opened.label} will be lost.`)) return;
    act(async () => onOpen(await loadHousehold(client, r.id)), `Opened ${r.label}.`);
  };
  const remove = () => {
    if (window.confirm(`Delete "${opened.label}"? This can't be undone.`)) {
      act(async () => {
        await deleteHousehold(client, opened.id);
        onSaved(null);
      }, `Deleted ${opened.label}.`);
    }
  };
  const picker =
    rows === null ? (
      <p className="hint">Loading&hellip;</p>
    ) : rows.length === 0 ? (
      <p className="hint">Nothing saved yet.</p>
    ) : (
      <div className="client-picker">
        <label htmlFor="client-select">Client</label>
        <select id="client-select" value={opened?.id ?? ''} disabled={busy} onChange={(e) => openRow(e.target.value)}>
          {!opened && <option value="">Choose a saved household&hellip;</option>}
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} ({when(r.updated_at)})
            </option>
          ))}
        </select>
        {opened && (
          <button type="button" className="link-button" disabled={busy} onClick={remove}>
            Delete
          </button>
        )}
      </div>
    );

  if (compact) {
    return (
      <section className="card saved-households compact" aria-label="Saved households">
        {onScreen ?? <p className="saved-on-screen dim">Not saved yet.</p>}
        {clearControl && <p className="saved-clear">{clearControl}</p>}
        {statusLine}
        <details className="details">
          <summary>{opened ? 'Save as a new household' : 'Save this household'}</summary>
          <p className="hint">{NOTICE}</p>
          {saveForm}
          <p className="hint">
            Open another client on the <a href={HOME_HASH}>dashboard</a>.
          </p>
        </details>
      </section>
    );
  }

  // The whole card (the dashboard and the inputs page): a block like the others (decided 2026-10-09).
  return (
    <Collapsible
      className="saved-households"
      headingId="saved-title"
      title="Clients"
      summary={opened ? `On screen: ${opened.label}${changed ? ' (unsaved changes)' : ''}` : 'Household on screen not saved'}
      open={cardOpen}
      onToggle={() => setCardOpen(!cardOpen)}
    >
      <p className="hint">{NOTICE}</p>
      {picker}
      {onScreen}
      {clearControl && <p className="saved-clear">{clearControl}</p>}
      {saveForm}
      {statusLine}
    </Collapsible>
  );
}
