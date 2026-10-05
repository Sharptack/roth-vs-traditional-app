// The Supabase client for the #/next preview's sign-in and saved households.
// Configured from Vite env vars (local .env.local, and Netlify's environment for the site):
//   VITE_SUPABASE_URL       https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY  the project's anon (public) key
// The anon key is public by design: it can do nothing on its own, because every table is behind
// row-level security (supabase/migrations). NEVER put the service_role key in the app or the repo.
// Without both variables there is no backend and the preview simply has no sign-in.
//
// Loaded on demand (a dynamic import), so the library only downloads when a preview page asks for
// it; the public calculator never fetches it.
const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const backendConfigured = Boolean(url && anonKey);

let pending = null;

// -> Promise of the client (one per page load), or of null when no backend is configured.
export function loadSupabase() {
  if (!backendConfigured) return Promise.resolve(null);
  pending ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anonKey, {
      auth: {
        // PKCE: the email link carries a one-time code (in the query string, so it coexists with
        // the app's hash routes), which only the browser that asked for the link can exchange.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }),
  );
  return pending;
}
