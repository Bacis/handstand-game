import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHALLENGES } from '../lib/challenges/index.js';
import { duelsApi } from '../lib/duelsApi.js';
import { useAuth } from '../lib/auth.jsx';
import CameraCheck from '../components/duel/CameraCheck.jsx';

const DURATIONS = [
  { value: 30, label: '30 s', blurb: 'Quick burst' },
  { value: 60, label: '60 s', blurb: 'Classic' },
  { value: 120, label: '120 s', blurb: 'Endurance' },
];

export default function DuelCreate() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [challengeId, setChallengeId] = useState('handstand');
  const [durationS, setDurationS] = useState(60);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);
  const [camStatus, setCamStatus] = useState({ cameraReady: false, poseReady: false, error: null });
  const canCreate = camStatus.cameraReady && camStatus.poseReady && !camStatus.error;

  const challenge = useMemo(() => CHALLENGES.find((c) => c.id === challengeId), [challengeId]);

  const create = useCallback(async () => {
    setCreating(true);
    setErr(null);
    try {
      const m = await duelsApi.createInvite({ challengeType: challengeId, durationS });
      navigate(`/duel/${m.id}`);
    } catch (e) {
      setErr(e.message);
      setCreating(false);
    }
  }, [challengeId, durationS, navigate]);

  if (authLoading) {
    return <div className="p-10 text-center text-white/60 font-mono text-sm">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <p className="text-white/70">Anonymous sign-in is disabled on this project.</p>
        <p className="text-white/50 text-sm">Enable it in Supabase → Auth → Providers to host duels.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <header className="mb-8">
        <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-brand-accent">
          · Duel
        </div>
        <h1 className="text-3xl md:text-4xl font-black mt-1">Challenge a friend</h1>
        <p className="text-white/60 mt-2">
          Pick a challenge and a duration. You'll get a link to send once the duel is live.
        </p>
      </header>

      <div className="space-y-8">
        <section>
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55 mb-3">
            Camera check
          </div>
          <p className="text-white/60 text-sm mb-3">
            This is a webcam challenge \u2014 we track your reps by watching your body. Uncover your
            camera and step fully into frame before you create the duel.
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
                <div className="text-xs text-white/50 mt-1">{d.blurb}</div>
              </button>
            ))}
          </div>
        </section>

        {err && (
          <div className="text-[12px] text-[#ff6d5c] font-mono uppercase tracking-[0.12em]">
            {err}
          </div>
        )}

        <button
          type="button"
          disabled={creating || !canCreate}
          onClick={create}
          className="w-full py-4 bg-brand-accent text-black font-mono uppercase tracking-[0.18em] text-sm font-bold rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-px transition"
        >
          {creating
            ? 'Creating\u2026'
            : !canCreate
            ? (camStatus.error ? 'Fix camera to continue' : 'Waiting for camera\u2026')
            : `Create duel \u00b7 ${challenge?.label} \u00b7 ${durationS}s`}
        </button>
      </div>
    </div>
  );
}
