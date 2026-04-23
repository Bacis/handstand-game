import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { duelsApi } from '../lib/duelsApi.js';
import { CHALLENGES } from '../lib/challenges/index.js';
import CameraCheck from '../components/duel/CameraCheck.jsx';

const DURATIONS = [
  { value: 30, label: '30 s' },
  { value: 60, label: '60 s' },
  { value: 120, label: '120 s' },
];

export default function Lobby() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [challengeId, setChallengeId] = useState('handstand');
  const [durationS, setDurationS] = useState(60);
  const [seeking, setSeeking] = useState(false);
  const [status, setStatus] = useState('');
  const [peerCount, setPeerCount] = useState(0);
  const [camStatus, setCamStatus] = useState({ cameraReady: false, poseReady: false, error: null });
  const canQueue = camStatus.cameraReady && camStatus.poseReady && !camStatus.error;

  const claimInFlightRef = useRef(false);
  const redirectingRef = useRef(false);

  // Leave the queue on unmount so we don't get surprise-matched after
  // navigating away. Best-effort — Supabase also tears down the presence
  // entry when the channel unsubscribes.
  useEffect(() => () => { duelsApi.leaveLobby().catch(() => {}); }, []);

  const start = async () => {
    setStatus('Joining lobby…');
    try {
      await duelsApi.enterLobby({ challengeType: challengeId, durationS });
      setSeeking(true);
      setStatus('Looking for an opponent…');
    } catch (e) {
      setStatus(e.message);
    }
  };

  const stop = async () => {
    claimInFlightRef.current = false;
    try { await duelsApi.leaveLobby(); } catch {}
    setSeeking(false);
    setStatus('');
    setPeerCount(0);
  };

  // While seeking, track presence on the per-(challenge,duration) channel.
  // Pairing rule: only the lexicographically smaller user_id runs the claim,
  // which guarantees at most one of the two seekers actually creates the
  // match (see duelsApi.claimOpponent for the DELETE-returning CAS detail).
  useEffect(() => {
    if (!seeking || !user?.id) return;
    const name = `lobby:${challengeId}:${durationS}`;
    const chan = supabase.channel(name, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });

    const tryPair = async () => {
      const state = chan.presenceState();
      const others = Object.keys(state).filter((uid) => uid !== user.id).sort();
      setPeerCount(others.length);
      if (others.length === 0) return;
      const opponent = others[0];
      if (user.id >= opponent) return; // the other side claims us
      if (claimInFlightRef.current) return;
      claimInFlightRef.current = true;
      try {
        const match = await duelsApi.claimOpponent({
          opponentId: opponent,
          challengeType: challengeId,
          durationS,
        });
        if (match && !redirectingRef.current) {
          redirectingRef.current = true;
          await chan.send({
            type: 'broadcast',
            event: 'matched',
            payload: { matchId: match.id, host: match.host_id, guest: match.guest_id },
          });
          navigate(`/duel/${match.id}`);
        } else {
          claimInFlightRef.current = false;
        }
      } catch (e) {
        console.error('[lobby] claim failed:', e);
        claimInFlightRef.current = false;
      }
    };

    chan.on('presence', { event: 'sync' }, tryPair);
    chan.on('presence', { event: 'join' }, tryPair);
    chan.on('broadcast', { event: 'matched' }, ({ payload }) => {
      if (!payload || redirectingRef.current) return;
      if (payload.host === user.id || payload.guest === user.id) {
        redirectingRef.current = true;
        navigate(`/duel/${payload.matchId}`);
      }
    });

    chan.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await chan.track({ user_id: user.id });
    });

    return () => { supabase.removeChannel(chan); };
  }, [seeking, user?.id, challengeId, durationS, navigate]);

  if (authLoading) {
    return <div className="p-10 text-center text-white/60 font-mono text-sm">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <p className="text-white/70">Anonymous sign-in is disabled on this project.</p>
        <p className="text-white/50 text-sm">Enable it in Supabase → Auth → Providers to join the lobby.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <header className="mb-8">
        <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-brand-accent">
          · Lobby
        </div>
        <h1 className="text-3xl md:text-4xl font-black mt-1">Random opponent</h1>
        <p className="text-white/60 mt-2">
          Pick what you want to fight over. You'll be paired with another player seeking the same challenge and duration.
        </p>
      </header>

      {!seeking ? (
        <div className="space-y-6">
          <section>
            <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 mb-3">
              Camera check
            </div>
            <p className="text-white/60 text-sm mb-3">
              This is a webcam challenge. Make sure your camera is on and we can see your full body
              before we pair you with an opponent.
            </p>
            <CameraCheck onStatusChange={setCamStatus} />
          </section>

          <section>
            <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 mb-3">
              Challenge
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CHALLENGES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChallengeId(c.id)}
                  className={`rounded-sm border px-3 py-4 text-left transition ${
                    challengeId === c.id
                      ? 'border-brand-accent bg-brand-accent/10 text-white'
                      : 'border-white/15 hover:border-white/30 text-white/80'
                  }`}
                >
                  <div className="font-mono uppercase tracking-[0.18em] text-[11px]">
                    {c.shortLabel || c.label}
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {c.scoreType === 'duration' ? 'Hold longest' : 'Most reps'}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 mb-3">
              Duration
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDurationS(d.value)}
                  className={`rounded-sm border px-3 py-4 text-center transition ${
                    durationS === d.value
                      ? 'border-brand-accent bg-brand-accent/10 text-white'
                      : 'border-white/15 hover:border-white/30 text-white/80'
                  }`}
                >
                  <div className="font-black text-xl tabular-nums">{d.label}</div>
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={start}
            disabled={!canQueue}
            className="w-full py-4 bg-brand-accent text-black font-mono uppercase tracking-[0.18em] text-sm font-bold rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-px transition"
          >
            {canQueue
              ? 'Find opponent'
              : camStatus.error ? 'Fix camera to continue' : 'Waiting for camera\u2026'}
          </button>
          {status && (
            <div className="text-[12px] text-[#ff6d5c] font-mono uppercase tracking-[0.12em]">
              {status}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border border-brand-border rounded-md bg-brand-paper p-6">
            <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-brand-accent flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
              {status}
            </div>
            <div className="mt-3 flex items-baseline gap-4">
              <div className="text-3xl font-black tabular-nums">{peerCount + 1}</div>
              <div className="text-white/60 text-sm">
                {peerCount + 1 === 1 ? 'player seeking' : 'players seeking'} · {challengeId} · {durationS}s
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={stop}
            className="w-full py-3 border border-white/20 hover:border-white/40 rounded-sm font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-white transition"
          >
            Leave queue
          </button>
        </div>
      )}
    </div>
  );
}
