import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera.js';
import { useVideoFile } from '../hooks/useVideoFile.js';
import { useRecorder } from '../hooks/useRecorder.js';
import { usePose } from '../hooks/usePose.js';
import { useTimer } from '../hooks/useTimer.js';
import { useChallenge, STATE } from '../hooks/useChallenge.js';
import { getChallenge } from '../lib/challenges/index.js';
import TrackingView from '../components/track/TrackingView.jsx';
import DebugHUD from '../components/DebugHUD.jsx';
import SaveScoreModal from '../components/SaveScoreModal.jsx';
import ShareModal from '../components/ShareModal.jsx';
import AchievementToast from '../components/AchievementToast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useAchievements } from '../hooks/useAchievements.js';
import { api } from '../lib/api.js';
import { crossedTick } from '../lib/milestones.js';
import { playTickSound, tickReset, unlockAudio, playPersonalBestSound } from '../lib/sounds.js';
import { getPersonalBest, setPersonalBest as savePersonalBest } from '../lib/personalBest.js';
import { createPoseBuffer } from '../lib/poseCaptureBuffer.js';

// Dev tools (video-file + sample-clip sources, debug HUD) are only exposed
// when the page is served from localhost. Production is webcam-only.
const IS_DEV_HOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function Track() {
  const { challenge: challengeId } = useParams();
  const challenge = getChallenge(challengeId);
  if (!challenge) return <Navigate to="/play" replace />;

  return <TrackInner key={challenge.id} challenge={challenge} />;
}

function TrackInner({ challenge }) {
  const { user } = useAuth();
  const videoRef = useRef(null);

  const [source, setSource] = useState('webcam');
  const [fileUrl, setFileUrl] = useState(null);
  const [debug, setDebug] = useState(false);
  const [loopFile, setLoopFile] = useState(false);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [videoSize, setVideoSize] = useState(null);

  const [facingMode, setFacingMode] = useState('environment');
  const camera = useCamera(videoRef, { enabled: source === 'webcam', facingMode });
  const flipCamera = useCallback(() => {
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
  }, []);
  const file = useVideoFile(videoRef, fileUrl, { enabled: source === 'file', loop: loopFile });
  const ready = source === 'webcam' ? camera.ready : file.ready;
  const srcError = source === 'webcam' ? camera.error : file.error;
  const stream = source === 'webcam' ? camera.stream : file.stream;

  const recorder = useRecorder(stream);

  const [finalScore, setFinalScore] = useState(0); // ms for handstand, reps otherwise
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const autoPromptedFor = useRef(0);

  // sessionBest holds the best attempt of the session. Only its recording
  // can be submitted / downloaded — later weaker attempts don't overwrite it.
  const [sessionBest, setSessionBest] = useState({
    score: 0,
    durationMs: 0,
    blob: null,
    blobUrl: null,
    mime: null,
    landmarkTimeline: null,
  });
  const lastConsideredBlobRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);

  const poseBufferRef = useRef(null);
  if (poseBufferRef.current === null) poseBufferRef.current = createPoseBuffer();

  const [personalBest, setPersonalBestState] = useState(() => getPersonalBest(challenge.id));
  const [pbStatus, setPbStatus] = useState(null);
  const [pbDelta, setPbDelta] = useState(0);
  const [isNewPb, setIsNewPb] = useState(false);

  const trackingRef = useRef(null);

  const achievements = useAchievements();
  const attemptRecordedRef = useRef(0);
  const resetTimerRef = useRef(() => {});

  const { state, latest, reps, handleFrame, reset, forceComplete, markSubmitted } = useChallenge(challenge, {
    onEnterTracking: () => {
      resetTimerRef.current();
      recorder.reset();
      setFinalScore(0);
      poseBufferRef.current.start();
      recorder.start();
    },
    onExitTracking: () => {
      poseBufferRef.current.stop();
      recorder.stop();
    },
  });

  const { elapsedMs, reset: resetTimer } = useTimer(state === STATE.TRACKING);
  useEffect(() => { resetTimerRef.current = resetTimer; }, [resetTimer]);

  // The score the rest of the UI reads. Reps for rep-based, elapsedMs for
  // handstand. Track in one place so the rank/PB/sharing logic stays uniform.
  const liveScore = challenge.scoreType === 'reps' ? reps : elapsedMs;
  const displayScore =
    state === STATE.TRACKING
      ? liveScore
      : state === STATE.COMPLETE || state === STATE.SUBMITTED
        ? finalScore
        : 0;

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const onPoseFrame = useCallback((res) => {
    if (stateRef.current === STATE.TRACKING && res?.landmarks) {
      poseBufferRef.current.push(res.landmarks);
    }
    handleFrame(res);
  }, [handleFrame]);

  const { loaded: poseLoaded, error: poseErr } = usePose(videoRef, ready, onPoseFrame);

  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current === STATE.TRACKING && state === STATE.COMPLETE) {
      setFinalScore(liveScore);
    }
    prevState.current = state;
  }, [state, liveScore]);

  // Promote the just-finished recording to session best if it's the best score.
  useEffect(() => {
    if (!recorder.blob) return;
    if (lastConsideredBlobRef.current === recorder.blob) return;
    lastConsideredBlobRef.current = recorder.blob;
    if (finalScore <= sessionBest.score) return;
    const url = URL.createObjectURL(recorder.blob);
    const landmarkTimeline = poseBufferRef.current.snapshot();
    setSessionBest((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return {
        score: finalScore,
        durationMs: elapsedMs,
        blob: recorder.blob,
        blobUrl: url,
        mime: recorder.mime,
        landmarkTimeline,
      };
    });
  }, [recorder.blob, recorder.mime, finalScore, elapsedMs, sessionBest.score]);

  // Record the attempt in the achievement store exactly once per completion.
  // Achievement logic is tuned for handstand durations — skip for other
  // challenges so we don't fire misleading unlocks.
  useEffect(() => {
    if (state === STATE.IDLE || state === STATE.READY) {
      attemptRecordedRef.current = 0;
      return;
    }
    if (state !== STATE.COMPLETE) return;
    if (finalScore <= 0) return;
    if (attemptRecordedRef.current === finalScore) return;
    attemptRecordedRef.current = finalScore;
    if (challenge.scoreType !== 'duration') return;
    const prevPb = personalBest;
    const wasNewPb = prevPb <= 0 || finalScore > prevPb;
    achievements.checkOnAttemptComplete(finalScore, { isNewPb: wasNewPb, prevPb });
  }, [state, finalScore, personalBest, achievements, challenge.scoreType]);

  // PB detection on TRACKING → COMPLETE. Works uniformly for both score types
  // because the comparison is just "is finalScore bigger than the stored PB".
  useEffect(() => {
    if (state === STATE.TRACKING || state === STATE.IDLE || state === STATE.READY) {
      setPbStatus(null);
      setPbDelta(0);
      return;
    }
    if (state !== STATE.COMPLETE || finalScore <= 0) return;

    if (personalBest <= 0 || finalScore > personalBest) {
      const delta = finalScore - personalBest;
      setPbStatus('new-pb');
      setPbDelta(delta);
      savePersonalBest(finalScore, challenge.id);
      setPersonalBestState(finalScore);
      setIsNewPb(true);
    } else {
      const gap = personalBest - finalScore;
      // For duration, "close" = within 1s; for reps, within 1 rep.
      const closeThreshold = challenge.scoreType === 'reps' ? 1 : 1000;
      setPbStatus(gap <= closeThreshold ? 'close' : 'short');
      setPbDelta(gap);
      setIsNewPb(false);
    }
  }, [state, finalScore, personalBest, challenge.id, challenge.scoreType]);

  useEffect(() => {
    if (!isNewPb) return;
    trackingRef.current?.showCustomBanner('NEW PB!');
    playPersonalBestSound();
    setShareOpen(true);
  }, [isNewPb]);

  useEffect(() => {
    return () => {
      if (sessionBest.blobUrl) URL.revokeObjectURL(sessionBest.blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick sound + mastery banner cadence.
  //  - Handstand: fire every 3s (crossedTick on elapsedMs), pulling the mastery name from the challenge.
  //  - Reps: fire on every rep and on every mastery tier crossing.
  const lastHandstandTickRef = useRef(0);
  const lastRepsRef = useRef(0);
  const lastMasteryNameRef = useRef(null);
  useEffect(() => {
    if (state !== STATE.TRACKING) {
      lastHandstandTickRef.current = 0;
      lastRepsRef.current = 0;
      lastMasteryNameRef.current = null;
      tickReset();
      return;
    }
    if (challenge.scoreType === 'duration') {
      if (crossedTick(lastHandstandTickRef.current, elapsedMs)) {
        playTickSound();
      }
      lastHandstandTickRef.current = elapsedMs;
    } else {
      if (reps > lastRepsRef.current) {
        playTickSound();
      }
      lastRepsRef.current = reps;
    }
    const mastery = challenge.masteryFor(liveScore);
    if (mastery && mastery.name !== lastMasteryNameRef.current) {
      lastMasteryNameRef.current = mastery.name;
      trackingRef.current?.showCustomBanner(mastery.name.toUpperCase());
    }
  }, [elapsedMs, reps, liveScore, state, challenge]);

  useEffect(() => {
    const onGesture = () => { unlockAudio(); window.removeEventListener('pointerdown', onGesture); };
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => {
      if (v.videoWidth && v.videoHeight) {
        setVideoAspect(v.videoWidth / v.videoHeight);
        setVideoSize(`${v.videoWidth}×${v.videoHeight}`);
      }
    };
    v.addEventListener('loadedmetadata', on);
    return () => v.removeEventListener('loadedmetadata', on);
  }, [source, fileUrl]);

  const restart = useCallback(() => {
    resetTimer();
    reset();
    recorder.reset();
    setFinalScore(0);
    setSubmitErr(null);
  }, [reset, resetTimer, recorder]);

  const switchSource = useCallback((next) => {
    restart();
    setSource(next);
  }, [restart]);

  const onPickFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (fileUrl?.startsWith('blob:')) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(f));
    setSource('file');
    restart();
  }, [fileUrl, restart]);

  const loadSample = useCallback(() => {
    if (fileUrl?.startsWith('blob:')) URL.revokeObjectURL(fileUrl);
    setFileUrl(challenge.samplePath);
    setSource('file');
    restart();
  }, [fileUrl, restart, challenge.samplePath]);

  const submit = useCallback(async () => {
    if (sessionBest.score <= 0) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      await api.submitAttempt({
        challengeType: challenge.id,
        durationMs: challenge.scoreType === 'duration' ? sessionBest.score : sessionBest.durationMs,
        repCount: challenge.scoreType === 'reps' ? sessionBest.score : null,
        videoBlob: sessionBest.blob,
        deviceInfo: {
          ua: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}`,
          source,
        },
      });
      markSubmitted();
      setShowSaveModal(false);
    } catch (e) {
      setSubmitErr(e.message);
      setShowSaveModal(true);
    } finally {
      setSubmitting(false);
    }
  }, [sessionBest.score, sessionBest.blob, sessionBest.durationMs, challenge.id, challenge.scoreType, source, markSubmitted]);

  useEffect(() => {
    if (user) return;
    if (state !== STATE.COMPLETE) return;
    if (sessionBest.score <= 0) return;
    if (autoPromptedFor.current === finalScore) return;
    autoPromptedFor.current = finalScore;
    setShowSaveModal(true);
  }, [user, state, finalScore, sessionBest.score]);

  const errorMessage = useMemo(() => {
    if (srcError) return String(srcError?.message || srcError);
    if (poseErr) return `Pose detection failed: ${String(poseErr?.message || poseErr)}`;
    return null;
  }, [srcError, poseErr]);

  const complete = state === STATE.COMPLETE || state === STATE.SUBMITTED;

  const statusText = (() => {
    if (complete && finalScore > 0) {
      const mastery = challenge.masteryFor(finalScore);
      const pbLine =
        pbStatus === 'new-pb'
          ? ` · +${challenge.scoreType === 'reps' ? pbDelta : formatDelta(pbDelta)} PB`
          : pbStatus === 'close'
            ? ` · ${challenge.scoreType === 'reps' ? pbDelta : formatDelta(pbDelta)} off PB`
            : pbStatus === 'short'
              ? ` · ${challenge.scoreType === 'reps' ? pbDelta : formatDelta(pbDelta)} short`
              : '';
      return `${challenge.copy.completeVerb} ${challenge.formatScore(finalScore)}${mastery ? ` · ${mastery.name}` : ''}${pbLine}`;
    }
    switch (state) {
      case STATE.IDLE: return challenge.copy.statusIdle;
      case STATE.READY: return challenge.copy.statusReady;
      case STATE.TRACKING: return challenge.copy.statusTracking;
      case STATE.COMPLETE: return challenge.copy.statusComplete;
      case STATE.SUBMITTED: return challenge.copy.statusSubmitted;
      default: return '';
    }
  })();

  const actions = complete ? (
    <>
      <button type="button" className="ts-btn primary" onClick={restart}>
        Go again ↑
      </button>
      {sessionBest.blob && (
        <button type="button" className="ts-btn green" onClick={() => setShareOpen(true)}>
          Export clip ⤓
        </button>
      )}
      {state === STATE.COMPLETE && (
        <button
          type="button"
          className="ts-btn ghost"
          disabled={submitting || sessionBest.score <= 0}
          onClick={() => (user && !user.isAnonymous ? submit() : setShowSaveModal(true))}
        >
          {submitting ? 'Saving…' : (user && !user.isAnonymous ? 'Submit' : 'Submit · register')}
        </button>
      )}
    </>
  ) : null;

  return (
    <div className="w-full relative" style={{ height: 'calc(100svh - 57px)' }}>
      <TrackingView
        ref={trackingRef}
        challenge={challenge}
        score={displayScore}
        reps={challenge.scoreType === 'reps' ? (state === STATE.TRACKING ? reps : finalScore) : 0}
        videoRef={videoRef}
        landmarks={latest.landmarks}
        videoAspect={videoAspect}
        videoSize={videoSize}
        elapsedMs={state === STATE.TRACKING ? elapsedMs : (sessionBest.durationMs || 0)}
        active={state === STATE.TRACKING}
        ready={ready}
        poseLoaded={poseLoaded}
        errorMessage={errorMessage}
        source={source}
        onSwitchSource={switchSource}
        onPickFile={onPickFile}
        onLoadSample={loadSample}
        debug={debug}
        onToggleDebug={setDebug}
        loopFile={loopFile}
        onToggleLoop={setLoopFile}
        fileUrlIsBlob={fileUrl?.startsWith('blob:')}
        fileUrlIsSample={fileUrl === challenge.samplePath}
        showDevTools={IS_DEV_HOST}
        recording={recorder.recording}
        statusText={statusText}
        complete={complete}
        actions={actions}
        mirror={source === 'webcam' && facingMode === 'user'}
        facingMode={facingMode}
        onFlipCamera={source === 'webcam' && state !== STATE.TRACKING ? flipCamera : null}
        onEndAttempt={state === STATE.TRACKING ? forceComplete : null}
      />

      {debug && IS_DEV_HOST && (
        <DebugHUD
          classification={latest.debug}
          debouncerActive={state === STATE.TRACKING}
          state={state}
        />
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); setIsNewPb(false); }}
        challenge={challenge}
        score={sessionBest.score}
        sourceBlob={sessionBest.blob}
        durationMs={sessionBest.durationMs}
        handle={user?.username}
        isPersonalBest={isNewPb}
        landmarkTimeline={sessionBest.landmarkTimeline}
        earnedKeys={achievements.sessionKeys}
        mirror={source === 'webcam' && facingMode === 'user'}
        onShared={achievements.recordEvent}
      />

      <SaveScoreModal
        open={showSaveModal}
        challenge={challenge}
        score={sessionBest.score}
        durationMs={sessionBest.durationMs}
        submitting={submitting}
        error={submitErr}
        onSave={submit}
        onDiscard={() => { setShowSaveModal(false); setSubmitErr(null); }}
      />

      <AchievementToast toasts={achievements.toasts} onDismiss={achievements.dismissToast} />
    </div>
  );
}

function formatDelta(ms) {
  const totalMs = Math.max(0, Math.floor(ms));
  const seconds = Math.floor(totalMs / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);
  if (seconds < 10) return `${seconds}.${tenths}s`;
  return `${seconds}s`;
}
