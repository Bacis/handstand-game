import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function hydrate(session, profile) {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email || null,
    username: profile?.username ?? null,
    isAnonymous: session.user.is_anonymous === true,
  };
}

// Anonymous sign-in is required for duels/lobby — every visitor needs a uid
// to show up in matches.host_id / guest_id. Fails silently if the project
// hasn't enabled anon sign-ins (the toggle lives in Auth → Providers).
async function signInAnon() {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn('[auth] anonymous sign-in failed:', error.message);
      return null;
    }
    return data?.session ?? null;
  } catch (e) {
    console.warn('[auth] anonymous sign-in threw:', e);
    return null;
  }
}

function clearStoredSupabaseKeys() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('sb-'))
    .forEach((k) => localStorage.removeItem(k));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Watchdog: a corrupt/expired stored token can make supabase's internal
    // refresh stall forever, blocking every PostgREST call (the SDK pauses
    // all queries while auth is "in flight"). If getSession doesn't resolve
    // in 4s, we assume the token is rotten, nuke it locally, and try a fresh
    // anonymous sign-in — better than an indefinitely-frozen page.
    const sessionTimeout = new Promise((resolve) =>
      setTimeout(() => resolve({ __timedOut: true }), 4000),
    );

    (async () => {
      let session = null;
      const res = await Promise.race([supabase.auth.getSession(), sessionTimeout]);
      if (cancelled) return;

      if (res.__timedOut) {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
        clearStoredSupabaseKeys();
      } else {
        session = res.data?.session ?? null;
      }

      if (!session?.user) {
        session = await signInAnon();
      }
      if (cancelled) return;

      if (session?.user) {
        const profile = session.user.is_anonymous
          ? null
          : await fetchProfile(session.user.id).catch(() => null);
        if (!cancelled) setUser(hydrate(session, profile));
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      const profile = session.user.is_anonymous
        ? null
        : await fetchProfile(session.user.id).catch(() => null);
      setUser(hydrate(session, profile));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const register = useCallback(async ({ email, password, username }) => {
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) {
      throw new Error('Username must be 3–24 chars (letters, digits, _ or -)');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const current = sessionData?.session?.user;

    // Upgrade path: promote the current anonymous user to a real email/password
    // account without changing their uid. This keeps their duel W/L, attempts,
    // and anything else keyed by auth.uid().
    if (current?.is_anonymous) {
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) throw new Error(error.message);
      const { error: pErr } = await supabase
        .from('profiles')
        .insert({ id: current.id, username });
      if (pErr) {
        if (pErr.code === '23505') throw new Error('Username is taken');
        throw new Error(pErr.message);
      }
      setUser({ id: current.id, email, username, isAnonymous: false });
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    const uid = data.user?.id;
    if (!uid) throw new Error('Signup returned no user — check your email for a confirmation link.');
    const { error: pErr } = await supabase.from('profiles').insert({ id: uid, username });
    if (pErr) {
      if (pErr.code === '23505') throw new Error('Username is taken');
      throw new Error(pErr.message);
    }
    setUser({ id: uid, email: data.user.email, username, isAnonymous: false });
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // Drop back to an anonymous session so the user can keep playing duels
    // without signing in again. Matches the "anonymous-first" posture.
    const session = await signInAnon();
    setUser(session?.user ? hydrate(session, null) : null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
