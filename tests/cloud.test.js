import { describe, it, expect } from 'vitest';
import { deleteHousehold, friendlyError, listHouseholds, loadHousehold, saveHousehold, sendSignInLink } from '../src/services/cloud.js';
import { caseFromValues } from '../src/lib/savedHousehold.js';
import { PREVIEW_DEFAULT_VALUES } from '../src/lib/household.js';

// A fake Supabase client: records every call, answers with `reply`.
function fakeClient(reply = { data: null, error: null }) {
  const calls = [];
  const chain = (path) =>
    new Proxy(
      {},
      {
        get(_, name) {
          if (name === 'then') return (resolve) => resolve(typeof reply === 'function' ? reply(path) : reply);
          return (...args) => chain([...path, [name, ...args]]);
        },
      },
    );
  return {
    calls,
    from: (table) => {
      calls.push(['from', table]);
      return chain([['from', table]]);
    },
    rpc: (fn, args) => {
      calls.push(['rpc', fn, args]);
      return chain([['rpc', fn, args]]);
    },
    auth: {
      signInWithOtp: async (args) => (calls.push(['signInWithOtp', args]), { data: {}, error: null }),
      signOut: async () => (calls.push(['signOut']), { error: null }),
    },
    lastPath: null,
  };
}
// The steps of the query a call built (names only), via a reply function that captures them.
function recording(data = null, error = null) {
  const seen = [];
  const client = fakeClient((path) => (seen.push(path), { data, error }));
  return { client, seen: () => seen.map((p) => p.map(([name, ...args]) => [name, ...args])) };
}

describe('cloud: sign-in', () => {
  it('asks for a link without creating a user (invite only)', async () => {
    const c = fakeClient();
    await sendSignInLink(c, '  advisor@firm.test ', 'https://app.test/');
    expect(c.calls).toEqual([
      ['signInWithOtp', { email: 'advisor@firm.test', options: { shouldCreateUser: false, emailRedirectTo: 'https://app.test/' } }],
    ]);
  });
  it('refuses something that is not an email address', async () => {
    await expect(sendSignInLink(fakeClient(), 'nope', 'x')).rejects.toThrow('Enter a valid email address.');
  });
});

describe('cloud: saved households', () => {
  it('lists only id, label and date, newest first', async () => {
    const r = recording([{ id: '1', label: 'J', updated_at: 't' }]);
    expect(await listHouseholds(r.client)).toEqual([{ id: '1', label: 'J', updated_at: 't' }]);
    expect(r.seen()[0]).toEqual([['from', 'saved_households'], ['select', 'id, label, updated_at'], ['order', 'updated_at', { ascending: false }]]);
  });

  it('saves new with a cleaned label and the cleaned form values; no owner sent (the database sets it)', async () => {
    const r = recording({ id: 'n1', label: 'The J. household', updated_at: 't' });
    await saveHousehold(r.client, { label: '  The   J. household ', values: { ...PREVIEW_DEFAULT_VALUES, sneaky: 'x' } });
    const [path] = r.seen();
    expect(path[1][0]).toBe('insert');
    expect(path[1][1]).toEqual({ label: 'The J. household', data: caseFromValues(PREVIEW_DEFAULT_VALUES), schema_version: 1 });
    expect(path[1][1].owner_id).toBeUndefined();
    expect(path.slice(2)).toEqual([['select', 'id, label, updated_at'], ['single']]);
  });

  it('saves over an existing one by id', async () => {
    const r = recording({ id: 'n1', label: 'J', updated_at: 't' });
    await saveHousehold(r.client, { id: 'n1', label: 'J', values: PREVIEW_DEFAULT_VALUES });
    const [path] = r.seen();
    expect(path[1][0]).toBe('update');
    expect(path[2]).toEqual(['eq', 'id', 'n1']);
  });

  it('will not save without a name', async () => {
    await expect(saveHousehold(fakeClient(), { label: ' ', values: PREVIEW_DEFAULT_VALUES })).rejects.toThrow('Give the household a short name.');
  });

  it('loads and cleans; a row that is not ours is refused', async () => {
    const good = recording({ id: 'n1', label: 'J', data: caseFromValues({ ...PREVIEW_DEFAULT_VALUES, grossIncome: '80000' }) });
    expect((await loadHousehold(good.client, 'n1')).values.grossIncome).toBe('80000');
    // Through the logged database function, never a direct read of the contents.
    expect(good.seen()[0]).toEqual([['rpc', 'open_saved_household', { target_id: 'n1' }], ['single']]);
    const bad = recording({ id: 'n2', label: 'X', data: ['not', 'ours'] });
    await expect(loadHousehold(bad.client, 'n2')).rejects.toThrow('That saved household could not be read.');
  });

  it('deletes by id; server errors surface as messages', async () => {
    const r = recording(null);
    await deleteHousehold(r.client, 'n1');
    expect(r.seen()[0]).toEqual([['from', 'saved_households'], ['delete'], ['eq', 'id', 'n1']]);
    const failing = recording(null, { message: 'permission denied for table saved_households' });
    await expect(listHouseholds(failing.client)).rejects.toThrow('permission denied for table saved_households');
  });
});

describe('cloud: errors', () => {
  it('network failures and the email cap read plainly; other server messages pass through', () => {
    expect(friendlyError('Failed to fetch')).toBe("Couldn't reach the sign-in service. Check the connection and try again.");
    expect(friendlyError('Email rate limit exceeded')).toBe(
      'Too many sign-in emails have been sent in the last hour. Wait up to an hour, then ask for a new link.',
    );
    expect(friendlyError('email rate limit exceeded')).toMatch(/^Too many sign-in emails/);
    expect(friendlyError('For security purposes, you can only request this after 42 seconds.')).toBe(
      'For security purposes, you can only request this after 42 seconds.',
    );
    expect(friendlyError(undefined)).toBe('Something went wrong talking to the server.');
  });
});
