import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { CHALLENGES, challengeOrDefault } from '../lib/challenges/index.js';
import { useAuth } from '../lib/auth.jsx';

const PERIODS = [
  { id: 'all',   label: 'All time' },
  { id: 'week',  label: 'This week' },
  { id: 'today', label: 'Today' },
];

function fmtLastAttempt(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { challenge: challengeParam } = useParams();
  const challenge = challengeOrDefault(challengeParam);
  const { user } = useAuth();
  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState(null);
  const [personal, setPersonal] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setRows(null);
    const load = () => {
      const watchdog = setTimeout(() => {
        if (cancelled) return;
        setErr(
          'Leaderboard request did not return (the request to supabase.co may be blocked — check ad-blocker / privacy extension / Network tab).'
        );
      }, 10_000);
      return api.leaderboardRows(period, challenge.id)
        .then((r) => { if (!cancelled) { clearTimeout(watchdog); setRows(r); setErr(null); } })
        .catch((e) => { if (!cancelled) { clearTimeout(watchdog); setErr(e.message); } });
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [period, challenge.id]);

  useEffect(() => {
    if (!user) { setPersonal(null); return; }
    let cancelled = false;
    api.leaderboardStanding(user.id, period, challenge.id)
      .then((p) => { if (!cancelled) setPersonal(p); })
      .catch(() => { if (!cancelled) setPersonal(null); });
    return () => { cancelled = true; };
  }, [user, period, challenge.id]);

  const personalScore = useMemo(() => {
    if (!personal) return null;
    return challenge.scoreType === 'reps' ? personal.best_reps : personal.best_time_ms;
  }, [personal, challenge.scoreType]);

  const headlineUnit = challenge.scoreType === 'reps' ? 'Most reps · rolling' : 'Longest holds · rolling';

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-7 py-10 md:py-14">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-5">
        <h1 className="font-sans font-black tracking-tight text-4xl md:text-6xl leading-[0.9]">
          Leader<em className="font-serif italic font-light text-brand-accent">board.</em>
        </h1>
        <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55">
          {challenge.label} · {headlineUnit}
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {CHALLENGES.map((c) => {
          const active = c.id === challenge.id;
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/leaderboard/${c.id}`)}
              className={`font-mono uppercase tracking-[0.18em] text-[11px] font-bold px-4 py-2.5 rounded-sm transition border flex items-center gap-2 ${
                active
                  ? 'bg-white text-ink-900 border-white'
                  : 'text-white/70 hover:text-white border-brand-border hover:border-white/30'
              }`}
            >
              <span aria-hidden style={{ color: active ? '#000' : c.accent }}>{c.icon}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {personal && personalScore != null && (
        <div className="mb-6 border border-brand-border rounded-md bg-brand-paper px-5 py-4 flex items-baseline gap-4 flex-wrap">
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-brand-accent">
            · You are
          </div>
          <div className="font-sans font-black tabular-nums text-2xl">
            #{personal.rank}
          </div>
          <div className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/55">
            of {personal.total_participants}
          </div>
          <div className="flex-1" />
          <div className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/55">
            Best
          </div>
          <div className="font-sans font-black tabular-nums text-2xl text-brand-accent">
            {challenge.formatScore(personalScore)}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`font-mono uppercase tracking-[0.18em] text-[11px] font-bold px-4 py-2.5 rounded-sm transition border ${
                active
                  ? 'bg-white text-ink-900 border-white'
                  : 'text-white/70 hover:text-white border-brand-border hover:border-white/30'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="font-mono uppercase tracking-[0.14em] text-[11px] text-[#ff6d5c] mb-3">
          {err}
        </div>
      )}
      {!rows && !err && (
        <div className="font-mono uppercase tracking-[0.22em] text-[10px] text-white/45 py-4">
          Loading…
        </div>
      )}

      {rows && (
        <div className="border border-brand-border rounded-md overflow-hidden bg-brand-paper">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 border-b border-brand-border">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-right">Best</div>
            <div className="col-span-2 text-right">Attempts</div>
            <div className="col-span-2 text-right">Last</div>
          </div>

          {rows.length === 0 && (
            <div className="px-4 py-10 text-center font-mono uppercase tracking-[0.2em] text-[10px] text-white/45">
              No attempts yet — be the first.
            </div>
          )}

          {rows.map((row, i) => {
            const place = i + 1;
            const top = place === 1;
            const score = challenge.scoreType === 'reps' ? row.best_reps : row.best_time_ms;
            const mastery = challenge.masteryFor(score ?? 0);
            return (
              <Link
                to={`/profile/${row.user_id}`}
                key={row.user_id}
                className={`grid grid-cols-12 gap-3 items-center px-5 py-4 border-b border-brand-border last:border-b-0 hover:bg-white/[0.03] transition ${
                  top ? 'bg-brand-accent/[0.06]' : ''
                }`}
              >
                <div className="col-span-1 font-mono text-[11px] tracking-[0.2em] text-white/55">
                  {String(place).padStart(2, '0')}
                </div>
                <div className="col-span-11 sm:col-span-5 min-w-0 flex items-baseline gap-3 flex-wrap">
                  <span className="font-bold truncate max-w-[180px]">{row.username}</span>
                  {mastery && (
                    <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/55">
                      · {mastery.name.replace('!', '')}
                    </span>
                  )}
                </div>
                <div className={`col-span-6 sm:col-span-2 text-right font-sans font-black tabular-nums text-xl md:text-2xl ${
                  top ? 'text-brand-accent' : 'text-white'
                }`}>
                  {challenge.formatScore(score ?? 0)}
                </div>
                <div className="col-span-3 sm:col-span-2 text-right font-mono tabular-nums text-[11px] tracking-[0.18em] text-white/55">
                  {row.total_attempts}
                </div>
                <div className="col-span-3 sm:col-span-2 text-right font-mono text-[10px] tracking-[0.16em] text-white/40">
                  {fmtLastAttempt(row.last_attempt_at)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
