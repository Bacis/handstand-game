import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { formatTime } from '../hooks/useTimer.js';

const INPUT =
  'w-full bg-ink-900 border border-brand-border rounded-sm px-3 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:border-brand-accent transition';

const LABEL =
  'font-mono uppercase tracking-[0.22em] text-[10px] text-white/55';

export default function SaveScoreModal({ open, durationMs, onSave, onDiscard, submitting, error }) {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [authErr, setAuthErr] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setAuthErr(null);
      setForm({ username: '', email: '', password: '' });
      setMode('register');
    }
  }, [open]);

  if (!open) return null;

  const authAndSave = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthErr(null);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ email: form.email, password: form.password, username: form.username });
      }
      await onSave();
    } catch (e2) {
      setAuthErr(e2.message);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onDiscard}
    >
      <div
        className="bg-brand-paper rounded-md border border-brand-border w-full max-w-sm overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5 text-center border-b border-brand-border">
          <div className={LABEL}>· Nice hold</div>
          <div className="font-sans font-black tabular-nums text-5xl mt-2 leading-none">
            {formatTime(durationMs)}
          </div>
          <div className="font-serif italic font-light text-brand-accent text-sm mt-1.5">
            submit to the ladder?
          </div>
        </div>

        <div className="p-5">
          {user ? (
            <>
              <p className={`${LABEL} text-center mb-4 normal-case tracking-[0.12em]`}>
                Saving as{' '}
                <span className="text-white font-bold tracking-[0.14em]">{user.username}</span>
              </p>
              {error && (
                <div className="font-mono text-[11px] tracking-[0.12em] text-[#ff6d5c] uppercase mb-3 text-center">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <BtnGhost onClick={onDiscard} disabled={submitting}>Discard</BtnGhost>
                <BtnPrimary onClick={onSave} disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save score'}
                </BtnPrimary>
              </div>
            </>
          ) : (
            <>
              <p className="font-sans text-sm text-white/70 text-center mb-5 leading-relaxed">
                Claim this hold on the leaderboard — create an account or log in.
              </p>
              <div className="grid grid-cols-2 gap-1 mb-4 p-1 bg-ink-900 border border-brand-border rounded-sm">
                <TabBtn active={mode === 'register'} onClick={() => setMode('register')}>
                  Register
                </TabBtn>
                <TabBtn active={mode === 'login'} onClick={() => setMode('login')}>
                  Login
                </TabBtn>
              </div>

              <form onSubmit={authAndSave} className="space-y-2.5">
                {mode === 'register' && (
                  <input
                    className={INPUT}
                    placeholder="Username · for the leaderboard"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    pattern="[a-zA-Z0-9_\-]{3,24}"
                    title="3–24 characters: letters, digits, _ or -"
                  />
                )}
                <input
                  className={INPUT}
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <input
                  className={INPUT}
                  placeholder="Password · 8+ chars"
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                {(authErr || error) && (
                  <div className="font-mono text-[11px] tracking-[0.12em] text-[#ff6d5c] uppercase">
                    {authErr || error}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <BtnGhost type="button" onClick={onDiscard} disabled={authBusy || submitting}>
                    Discard
                  </BtnGhost>
                  <BtnPrimary type="submit" disabled={authBusy || submitting}>
                    {authBusy || submitting
                      ? '…'
                      : mode === 'register'
                        ? 'Register & save'
                        : 'Login & save'}
                  </BtnPrimary>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 rounded-sm font-mono uppercase tracking-[0.18em] text-[11px] transition ${
        active ? 'bg-white text-ink-900' : 'text-white/55 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function BtnGhost({ children, ...rest }) {
  return (
    <button
      {...rest}
      className="flex-1 py-3 border border-white/20 hover:border-white/40 rounded-sm font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-white disabled:opacity-45 transition"
    >
      {children}
    </button>
  );
}

function BtnPrimary({ children, ...rest }) {
  return (
    <button
      {...rest}
      className="flex-1 py-3 bg-brand-accent text-black rounded-sm font-mono uppercase tracking-[0.16em] text-[11px] font-bold hover:-translate-y-px disabled:opacity-45 transition"
    >
      {children}
    </button>
  );
}
