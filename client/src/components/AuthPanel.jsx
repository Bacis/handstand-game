import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

const INPUT =
  'w-full bg-ink-900 border border-brand-border rounded-sm px-3 py-2.5 text-sm placeholder:text-white/35 focus:outline-none focus:border-brand-accent transition';

export default function AuthPanel({ onClose, initialMode = 'login' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ email: form.email, password: form.password, username: form.username });
      }
      onClose?.();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-brand-paper rounded-md border border-brand-border w-full max-w-sm overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <div className="px-6 pt-6 pb-4 border-b border-brand-border">
        <div className="font-mono uppercase tracking-[0.22em] text-[10px] text-brand-accent">
          · Handstand
        </div>
        <h2 className="font-sans font-black tracking-tight text-2xl mt-1.5 leading-none">
          {mode === 'login' ? (
            <>Welcome <em className="font-serif italic font-light text-brand-accent">back.</em></>
          ) : (
            <>Claim your <em className="font-serif italic font-light text-brand-accent">rank.</em></>
          )}
        </h2>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-1 mb-4 p-1 bg-ink-900 border border-brand-border rounded-sm">
          <TabBtn active={mode === 'login'} onClick={() => setMode('login')}>Login</TabBtn>
          <TabBtn active={mode === 'register'} onClick={() => setMode('register')}>Register</TabBtn>
        </div>

        <form onSubmit={submit} className="space-y-2.5">
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
          {err && (
            <div className="font-mono text-[11px] tracking-[0.12em] text-[#ff6d5c] uppercase">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-1 py-3 bg-brand-accent text-black rounded-sm font-mono uppercase tracking-[0.16em] text-[11px] font-bold hover:-translate-y-px disabled:opacity-45 transition"
          >
            {busy ? '…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 font-mono uppercase tracking-[0.2em] text-[9px] text-white/40 text-center">
          · camera stays on device · nothing uploaded
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
