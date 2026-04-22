import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { usePose } from '../hooks/usePose.js';
import { useTimer } from '../hooks/useTimer.js';
import { useChallenge, STATE } from '../hooks/useChallenge.js';
import { getChallenge, challengeOrDefault } from '../lib/challenges/index.js';
import { duelsApi } from '../lib/duelsApi.js';
import { supabase } from '../lib/supabase.js';
import { createMatchChannel, connectPeer, throttle } from '../lib/duelTransport.js';
import { recordDuel } from '../lib/achievementsStore.js';
import { playOpponentJoinedSound, unlockAudio } from '../lib/sounds.js';

import DuelHeader from '../components/duel/DuelHeader.jsx';
import DuelPaneLocal from '../components/duel/DuelPaneLocal.jsx';
import DuelPaneRemote from '../components/duel/DuelPaneRemote.jsx';
import DuelInvitePanel from '../components/duel/DuelInvitePanel.jsx';
import DuelJoinBanner from '../components/duel/DuelJoinBanner.jsx';
import DuelResultModal from '../components/duel/DuelResultModal.jsx';

const COUNTDOWN_MS = 10000;

export default function DuelRoom() {
  const { id: matchId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  // Fetch match + subscribe to row updates (state transitions, final scores).
  // Three-pronged so we never miss the guest_id flip or the state=done write:
  //   1. postgres_changes — instant when realtime is healthy
  //   2. re-fetch on SUBSCRIBED — closes the gap if a write landed while the
  //      channel was still joining
  //   3. 2 s poll — safety net for flaky realtime links
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      try {
        const m = await duelsApi.fetchMatch(matchId);
        if (cancelled) return;
        if (!m) { setLoadErr('Match not found.'); return; }
        setMatch((prev) => (prev && prev.id === m.id ? { ...prev, ...m } : m));
      } catch (e) {
        if (!cancelled) setLoadErr(e.message);
      }
    };
    refresh();

    const chan = supabase
      .channel(`match-row:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        ({ new: next }) => setMatch(next),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
      });

    const poll = setInterval(refresh, 2000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(chan);
    };
  }, [matchId]);

  if (authLoading || (!match && !loadErr)) {
    return <div className="p-10 text-center text-white/60 font-mono text-sm">Loading duel…</div>;
  }
  if (loadErr) {
    return <div className="p-10 text-center text-[#ff6d5c] font-mono text-sm">{loadErr}</div>;
  }
  if (!user) {
    return <div className="p-10 text-center text-white/70 font-mono text-sm">Sign-in required.</div>;
  }

  // Derive role ONCE match is loaded. If I'm a third party (not host, not
  // guest, and guest is taken), show a friendly block — spectator mode is
  // out of scope.
  const isHost = user.id === match.host_id;
  const isGuest = user.id === match.guest_id;
  const mayJoinAsGuest = !isHost && !isGuest && match.guest_id == null && match.state !== 'done' && match.state !== 'cancelled';

  if (!isHost && !isGuest && !mayJoinAsGuest) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-brand-accent">· Full</div>
        <h1 className="text-2xl font-black">This duel is in progress</h1>
        <p className="text-white/60 text-sm">Spectator mode is coming — for now, ask them to share the result.</p>
        <button onClick={() => navigate('/duel/new')} className="mt-2 px-5 py-3 bg-brand-accent text-black font-mono uppercase tracking-[0.14em] text-[11px] font-bold rounded-sm">
          Start your own
        </button>
      </div>
    );
  }

  return <DuelRoomActive match={match} isHost={isHost} isGuest={isGuest} mayJoinAsGuest={mayJoinAsGuest} user={user} />;
}

function DuelRoomActive({ match: initialMatch, isHost, isGuest: initialIsGuest, mayJoinAsGuest, user }) {
  const navigate = useNavigate();
  const [match, setMatch] = useState(initialMatch);
  const [isGuest, setIsGuest] = useState(initialIsGuest);
  useEffect(() => setMatch(initialMatch), [initialMatch]);

  const challenge = useMemo(
    () => challengeOrDefault(match.challenge_type),
    [match.challenge_type],
  );

  // Guest attaches once on mount — this is what takes the match from
  // pending → ready and lets the host move on.
  const joinAttemptedRef = useRef(false);
  useEffect(() => {
    if (!mayJoinAsGuest || joinAttemptedRef.current) return;
    joinAttemptedRef.current = true;
    duelsApi.join(match.id)
      .then((updated) => { setMatch(updated); setIsGuest(true); })
      .catch((e) => console.error('[duel] join failed:', e));
  }, [mayJoinAsGuest, match.id]);

  // Row updates reach us via the outer DuelRoom's subscription — it passes
  // the fresh match down as `initialMatch` and we sync it above.

  // "Opponent joined" moment: fire exactly once when guest_id transitions
  // from null → set. Both sides see it — on the host it's "your friend
  // arrived", on the guest it confirms "you are now in the match".
  const prevGuestIdRef = useRef(initialMatch.guest_id);
  const [joinBannerVisible, setJoinBannerVisible] = useState(false);
  useEffect(() => {
    const prev = prevGuestIdRef.current;
    const cur = match.guest_id;
    prevGuestIdRef.current = cur;
    if (!prev && cur) {
      setJoinBannerVisible(true);
      try { playOpponentJoinedSound(); } catch {}
      const t = setTimeout(() => setJoinBannerVisible(false), 1800);
      return () => clearTimeout(t);
    }
  }, [match.guest_id]);

  // Audio unlock: browsers gate WebAudio behind a user gesture on the page.
  // If the guest landed via URL, their click counts on some browsers but not
  // others — wire a one-shot pointerdown listener so the first tap inside
  // the duel room unlocks the join chime reliably.
  useEffect(() => {
    const once = () => { unlockAudio(); window.removeEventListener('pointerdown', once); };
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
  }, []);

  // --- Local camera + pose + challenge state machine -----------------------
  // Full 720p camera — the face-to-face moments (invite, countdown, banter)
  // are the point of the feature, so video quality wins over compute budget.
  // We buy back the headroom by gating MediaPipe to the moments that actually
  // need it (pose validation + the live match); see `needsDetection` below.
  const videoRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const camera = useCamera(videoRef, { enabled: true, facingMode });

  const [bestScore, setBestScore] = useState(0);
  const bestRef = useRef(0);

  const { state, latest, reps, handleFrame, reset, forceComplete } = useChallenge(challenge, {
    onEnterTracking: () => { resetTimerRef.current?.(); },
    onExitTracking: () => { /* best is banked via liveScore effect */ },
  });
  const { elapsedMs, reset: resetTimer } = useTimer(state === STATE.TRACKING);
  const resetTimerRef = useRef(resetTimer);
  useEffect(() => { resetTimerRef.current = resetTimer; }, [resetTimer]);

  const liveAttemptScore = challenge.scoreType === 'reps' ? reps : elapsedMs;
  const myScore = Math.max(bestScore, liveAttemptScore);

  // Bank running-best every time the attempt score moves up.
  useEffect(() => {
    if (liveAttemptScore > bestRef.current) {
      bestRef.current = liveAttemptScore;
      setBestScore(liveAttemptScore);
    }
  }, [liveAttemptScore]);

  // Hoisted so usePose can gate on them. Definitions/effects that actually
  // populate these values live further down.
  const [localPoseReady, setLocalPoseReady] = useState(false);
  const [opponentPoseReady, setOpponentPoseReady] = useState(false);
  const [remainingMs, setRemainingMs] = useState(match.duration_s * 1000);
  const [countdownSeconds, setCountdownSeconds] = useState(null);

  // Only run MediaPipe when its output actually matters: while we're checking
  // both players are in frame (pre-countdown) and during the live match.
  // During the invite phase and the 10 s "Get ready" countdown we want a
  // clean, glass-smooth video chat, so detection stays off.
  const needsDetection =
    (match.state === 'ready' && (!localPoseReady || !opponentPoseReady)) ||
    (match.state === 'live' && remainingMs > 0 && remainingMs < match.duration_s * 1000);
  const { loaded: poseLoaded } = usePose(videoRef, camera.ready && needsDetection, handleFrame, { frameStride: 2 });

  const [videoAspect, setVideoAspect] = useState(16 / 9);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => { if (v.videoWidth) setVideoAspect(v.videoWidth / v.videoHeight); };
    v.addEventListener('loadedmetadata', on);
    return () => v.removeEventListener('loadedmetadata', on);
  }, [camera.ready]);

  // --- Realtime channel + WebRTC peer --------------------------------------
  const [channel, setChannel] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [rtcState, setRtcState] = useState('new');
  const [fallback, setFallback] = useState(false);
  const [opponentScore, setOpponentScore] = useState(0);
  const opponentFinalRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    if (!match?.id || !user?.id) return;
    const ch = createMatchChannel(match.id, { userId: user.id, meta: { role: isHost ? 'host' : 'guest' } });
    let cancelled = false;
    ch.subscribe()
      .then(() => { if (!cancelled) setChannel(ch); })
      .catch((e) => console.error('[duel] channel subscribe:', e));
    return () => { cancelled = true; ch.close(); };
  }, [match?.id, user?.id, isHost]);

  useEffect(() => {
    if (!channel) return;
    return channel.onScore(({ score }) => {
      if (typeof score === 'number') setOpponentScore(score);
    });
  }, [channel]);

  // Pose-gating effects. State vars themselves are hoisted above `usePose`
  // (needed for the detection-gate expression) — the population logic is
  // here, next to the channel wiring it talks to.
  useEffect(() => {
    if (state !== STATE.IDLE) {
      const t = setTimeout(() => setLocalPoseReady(true), 800);
      return () => clearTimeout(t);
    }
    // Short grace so a momentary MediaPipe miss doesn't revoke readiness.
    const t = setTimeout(() => setLocalPoseReady(false), 400);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (!channel) return;
    channel.sendState({ kind: 'pose-ready', value: localPoseReady });
  }, [channel, localPoseReady]);

  useEffect(() => {
    if (!channel) return;
    return channel.onState((payload) => {
      if (payload?.kind === 'final' && typeof payload.score === 'number') {
        opponentFinalRef.current = payload.score;
        setOpponentScore(payload.score);
      } else if (payload?.kind === 'pose-ready') {
        setOpponentPoseReady(Boolean(payload.value));
      }
    });
  }, [channel]);

  // When a new subscriber joins presence, re-send our current pose-ready so
  // they pick up the latest without having to wait for the next toggle.
  useEffect(() => {
    if (!channel) return;
    return channel.onPresenceChange(() => {
      channel.sendState({ kind: 'pose-ready', value: localPoseReady });
    });
  }, [channel, localPoseReady]);

  // Establish WebRTC once both local stream and channel are ready.
  useEffect(() => {
    if (!channel || !camera.stream) return;
    if (peerRef.current) return;
    const peer = connectPeer({
      channel,
      role: isHost ? 'offerer' : 'answerer',
      localStream: camera.stream,
      onRemoteStream: (s) => setRemoteStream(s),
      onConnectionStateChange: (s) => setRtcState(s),
      onFallback: () => setFallback(true),
    });
    peerRef.current = peer;
    return () => {
      peer.close();
      peerRef.current = null;
    };
  }, [channel, camera.stream, isHost]);

  // Recover from a premature fallback: if the connection eventually reaches
  // 'connected', lift the score-only mode so the remote video shows up.
  useEffect(() => {
    if (rtcState === 'connected' || rtcState === 'completed') {
      setFallback(false);
    }
  }, [rtcState]);

  // Broadcast my score at ~5Hz while the match is live (or still running
  // down before 'live' in case of any overshoot, harmless).
  const sendScore = useMemo(() => {
    if (!channel) return null;
    return throttle((score) => channel.sendScore({ score }), 200);
  }, [channel]);
  useEffect(() => {
    if (!sendScore) return;
    if (match.state === 'live' || match.state === 'ready') {
      sendScore(myScore);
    }
  }, [myScore, sendScore, match.state]);

  // --- Match lifecycle: host flips ready→live with a shared start time -----
  // Gated on both players' pose being visible — no surprise countdowns while
  // someone is still adjusting their camera. Once both pose-ready for 800 ms
  // each, the host triggers startLive with a 10 s shared countdown.
  const startStartedRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (match.state !== 'ready') return;
    if (startStartedRef.current) return;
    if (!channel || !peerRef.current) return;
    if (!localPoseReady || !opponentPoseReady) return;
    startStartedRef.current = true;
    const timer = setTimeout(() => {
      const startedAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
      duelsApi.startLive(match.id, startedAt).catch((e) => {
        console.error('[duel] startLive failed:', e);
        startStartedRef.current = false;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [isHost, match.state, match.id, channel, localPoseReady, opponentPoseReady]);

  // Shared countdown + match clock driven by match.started_at. Clients agree
  // on ms remaining because both anchor to the same DB timestamp. The two
  // state vars are declared up top so usePose can gate on them.
  const finalSentRef = useRef(false);

  useEffect(() => {
    if (match.state === 'done' || match.state === 'cancelled') return;
    if (!match.started_at) {
      setRemainingMs(match.duration_s * 1000);
      setCountdownSeconds(null);
      return;
    }
    const startMs = new Date(match.started_at).getTime();
    const endMs = startMs + match.duration_s * 1000;
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      if (now < startMs) {
        setCountdownSeconds(Math.max(0, Math.ceil((startMs - now) / 1000)));
        setRemainingMs(match.duration_s * 1000);
      } else {
        setCountdownSeconds(null);
        setRemainingMs(Math.max(0, endMs - now));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [match.started_at, match.duration_s, match.state]);

  // When the clock hits zero: freeze local state, broadcast final score.
  useEffect(() => {
    if (match.state !== 'live') return;
    if (remainingMs > 0) return;
    if (finalSentRef.current) return;
    finalSentRef.current = true;
    forceComplete();
    const finalScore = Math.max(bestRef.current, liveAttemptScore);
    if (finalScore > bestRef.current) bestRef.current = finalScore;
    setBestScore(bestRef.current);
    channel?.sendState({ kind: 'final', score: bestRef.current });
  }, [remainingMs, match.state, channel, forceComplete, liveAttemptScore]);

  // Host aggregates and writes the winner once both sides have posted a final
  // (or after a 3s grace if the opponent dropped).
  const hostWriteRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (match.state !== 'live') return;
    if (remainingMs > 0) return;
    if (hostWriteRef.current) return;

    const myFinal = bestRef.current;
    let cancelled = false;
    const write = async (opponentFinal) => {
      if (cancelled || hostWriteRef.current) return;
      hostWriteRef.current = true;
      try {
        await duelsApi.finish(match.id, {
          hostScore: myFinal,
          guestScore: opponentFinal ?? 0,
        });
      } catch (e) {
        console.error('[duel] finish failed:', e);
        hostWriteRef.current = false;
      }
    };

    if (opponentFinalRef.current != null) {
      write(opponentFinalRef.current);
      return;
    }
    // Poll for the opponent's final for up to 3s, else use the last score tick.
    const deadline = Date.now() + 3000;
    const pollId = setInterval(() => {
      if (cancelled) return;
      if (opponentFinalRef.current != null) {
        clearInterval(pollId);
        write(opponentFinalRef.current);
      } else if (Date.now() > deadline) {
        clearInterval(pollId);
        write(opponentScore);
      }
    }, 100);
    return () => { cancelled = true; clearInterval(pollId); };
  }, [isHost, match.state, match.id, remainingMs, opponentScore]);

  // Scores to show in the header — mapped to host/guest slots regardless of
  // which side I'm on, so the H2H reads the same for both players.
  const myDisplayScore = match.state === 'done'
    ? (isHost ? match.host_score : match.guest_score) ?? myScore
    : myScore;
  const oppDisplayScore = match.state === 'done'
    ? (isHost ? match.guest_score : match.host_score) ?? opponentScore
    : opponentScore;
  const hostScore = isHost ? myDisplayScore : oppDisplayScore;
  const guestScore = isHost ? oppDisplayScore : myDisplayScore;

  // Result + achievements on state=done.
  const [names, setNames] = useState({ host: null, guest: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, g] = await Promise.all([
        match.host_id ? duelsApi.displayName(match.host_id) : Promise.resolve(null),
        match.guest_id ? duelsApi.displayName(match.guest_id) : Promise.resolve(null),
      ]);
      if (!cancelled) setNames({ host: h, guest: g });
    })();
    return () => { cancelled = true; };
  }, [match.host_id, match.guest_id]);

  const [record, setRecord] = useState(null);
  const achievementWrittenRef = useRef(false);
  useEffect(() => {
    if (match.state !== 'done' || achievementWrittenRef.current) return;
    achievementWrittenRef.current = true;
    const won = match.winner_id && match.winner_id === user.id;
    const tie = match.winner_id == null;
    recordDuel({
      won: Boolean(won),
      tie,
      challengeType: match.challenge_type,
      opponentIsRegistered: Boolean(
        (isHost ? match.guest_id : match.host_id) &&
          (isHost ? names.guest : names.host) &&
          !(isHost ? names.guest : names.host)?.startsWith('guest-'),
      ),
      amIAnonymous: Boolean(user.isAnonymous),
    });
    duelsApi.myRecord(user.id).then(setRecord).catch(() => {});
  }, [match.state, match.winner_id, user.id, user.isAnonymous, names, isHost, match.challenge_type, match.guest_id, match.host_id]);

  const outcome = match.state === 'done'
    ? match.winner_id == null
      ? 'tie'
      : match.winner_id === user.id
        ? 'win'
        : 'loss'
    : null;

  const rematch = useCallback(async () => {
    try {
      const m = await duelsApi.createInvite({
        challengeType: match.challenge_type,
        durationS: match.duration_s,
      });
      navigate(`/duel/new?m=${m.id}`);
    } catch (e) {
      console.error('[duel] rematch create failed:', e);
    }
  }, [match.challenge_type, match.duration_s, navigate]);

  const mirror = facingMode === 'user';

  return (
    <div className="relative flex flex-col h-[calc(100svh-57px)]">
      <DuelHeader
        challenge={challenge}
        matchState={match.state}
        remainingMs={remainingMs}
        countdownSeconds={countdownSeconds}
        hostName={names.host}
        guestName={names.guest}
        hostScore={hostScore}
        guestScore={guestScore}
        meIsHost={isHost}
      />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <DuelPaneLocal
          challenge={challenge}
          videoRef={videoRef}
          landmarks={latest.landmarks}
          videoAspect={videoAspect}
          score={myScore}
          mirror={mirror}
          label={`You · ${names[isHost ? 'host' : 'guest'] || (user.isAnonymous ? 'guest' : 'you')}`}
          ready={camera.ready && poseLoaded}
          active={state === STATE.TRACKING}
        />
        {isHost && !match.guest_id ? (
          <DuelInvitePanel match={match} challenge={challenge} />
        ) : (
          <DuelPaneRemote
            challenge={challenge}
            remoteStream={remoteStream}
            score={opponentScore}
            label={`Opponent · ${names[isHost ? 'guest' : 'host'] || 'waiting'}`}
            connectionState={rtcState}
            fallback={fallback}
          />
        )}
      </div>

      <DuelJoinBanner
        visible={joinBannerVisible}
        guestName={names.guest && !names.guest.startsWith('guest-') ? names.guest : null}
      />

      {match.state === 'ready' && match.guest_id && !joinBannerVisible && countdownSeconds == null && (!localPoseReady || !opponentPoseReady) && (
        <div className="absolute inset-x-0 top-16 z-30 pointer-events-none flex justify-center">
          <div className="bg-black/70 backdrop-blur border border-white/15 text-white/90 font-mono uppercase tracking-[0.18em] text-[11px] font-bold px-4 py-2.5 rounded-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
            {!localPoseReady ? 'Step into frame' : 'Waiting for opponent to step in…'}
          </div>
        </div>
      )}

      {countdownSeconds != null && countdownSeconds > 0 && (
        <div className="absolute inset-0 pointer-events-none grid place-items-center">
          <div className="font-sans font-black text-[22vw] md:text-[18vw] text-brand-accent drop-shadow-[0_0_30px_#ff4d2e] tabular-nums animate-pulse">
            {countdownSeconds}
          </div>
        </div>
      )}

      <DuelResultModal
        open={match.state === 'done'}
        outcome={outcome}
        challenge={challenge}
        myScore={myDisplayScore}
        opponentScore={oppDisplayScore}
        record={record}
        onRematch={isHost ? rematch : null}
      />
    </div>
  );
}
