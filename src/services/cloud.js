// Sign-in and saved households, on top of a Supabase client (src/services/supabaseClient.js).
// Every function takes the client, so tests pass a fake one. Errors are thrown as Error with a
// plain message; the UI shows it. Access control is NOT done here: the database's row-level
// security limits every query to the signed-in advisor's own rows (supabase/migrations).
import { SAVED_SCHEMA_VERSION, caseFromValues, cleanLabel, valuesFromCase } from '../lib/savedHousehold.js';

const TABLE = 'saved_households';

// Server and network errors as plain messages.
export function friendlyError(message) {
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message ?? '')) {
    return "Couldn't reach the sign-in service. Check the connection and try again.";
  }
  // The project-wide cap on sign-in emails per hour (very low with Supabase's built-in sender).
  if (/email rate limit/i.test(message ?? '')) {
    return 'Too many sign-in emails have been sent in the last hour. Wait up to an hour, then ask for a new link.';
  }
  return message || 'Something went wrong talking to the server.';
}

function check({ data, error }) {
  if (error) throw new Error(friendlyError(error.message));
  return data;
}

// Email a sign-in link. shouldCreateUser: false — invite only: an address the project doesn't
// already know gets no account, even if public sign-up were switched on by mistake.
export async function sendSignInLink(client, email, redirectTo) {
  const address = String(email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.');
  check(await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } }));
}

export async function signOut(client) {
  check(await client.auth.signOut());
}

// The signed-in advisor's households, newest first (no data, just the list).
export async function listHouseholds(client) {
  return check(await client.from(TABLE).select('id, label, updated_at').order('updated_at', { ascending: false }));
}

// -> { id, label, values } (form values, cleaned), or throws.
export async function loadHousehold(client, id) {
  const row = check(await client.from(TABLE).select('id, label, data, updated_at').eq('id', id).single());
  const values = valuesFromCase(row.data);
  if (!values) throw new Error('That saved household could not be read.');
  return { id: row.id, label: row.label, values };
}

// Save as new (no id) or over an existing one (id). -> { id, label, updated_at }.
export async function saveHousehold(client, { id, label, values }) {
  const clean = cleanLabel(label);
  if (clean.error) throw new Error(clean.error);
  const row = { label: clean.label, data: caseFromValues(values), schema_version: SAVED_SCHEMA_VERSION };
  const query = id ? client.from(TABLE).update(row).eq('id', id) : client.from(TABLE).insert(row);
  return check(await query.select('id, label, updated_at').single());
}

export async function deleteHousehold(client, id) {
  check(await client.from(TABLE).delete().eq('id', id));
}
