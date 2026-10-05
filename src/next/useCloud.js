// The signed-in state for the #/next preview: whether a backend is configured, the client once it
// has loaded, whether the session has been read, and the session itself. After an email link the
// client exchanges the one-time code on load (supabaseClient.js, PKCE); this then takes the code
// out of the address bar.
//   override: a client for tests (null = no backend); undefined = load the configured one.
import { useEffect, useState } from 'react';
import { backendConfigured, loadSupabase } from '../services/supabaseClient.js';

export function useCloud(override) {
  const configured = override !== undefined ? Boolean(override) : backendConfigured;
  const [client, setClient] = useState(override ?? null);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (override !== undefined) {
      setClient(override);
      return undefined;
    }
    let alive = true;
    loadSupabase().then((c) => alive && setClient(c));
    return () => {
      alive = false;
    };
  }, [override]);

  useEffect(() => {
    if (!client) return undefined;
    let alive = true;
    client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data?.session ?? null);
      setReady(true);
      const params = new URLSearchParams(window.location.search);
      if (params.has('code')) {
        params.delete('code');
        const query = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data?.subscription?.unsubscribe();
    };
  }, [client]);

  return { configured, client, ready, session, email: session?.user?.email ?? null };
}
