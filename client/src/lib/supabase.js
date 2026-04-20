import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy client/.env.example to client/.env.local and fill them in.'
  );
}

// NOTE: the default `lock` option uses `navigator.locks` to serialize auth
// operations (token refresh, session writes). We've seen it wedge the entire
// SDK — every PostgREST query pauses waiting for a lock that never releases,
// which presents as the UI stuck on "Loading…" right after login. Supplying a
// pass-through lock bypasses the web-locks machinery: auth ops run eagerly,
// queries never block. The only trade-off is a benign race if multiple tabs
// refresh the token at the same millisecond (last-writer-wins — harmless).
const noopLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    lock: noopLock,
  },
});
