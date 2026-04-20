import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from '../hooks/useCamera.js';
import { useVideoFile } from '../hooks/useVideoFile.js';
import { useRecorder } from '../hooks/useRecorder.js';
import { usePose } from '../hooks/usePose.js';
import { useTimer, formatTime } from '../hooks/useTimer.js';
import { useHandstand, STATE } from '../hooks/useHandstand.js';
import TrackingView from '../components/track/TrackingView.jsx';
import DebugHUD from '../components/DebugHUD.jsx';
import SaveScoreModal from '../components/SaveScoreModal.jsx';
import ShareModal from '../components/ShareModal.jsx';
import AchievementToast from '../components/AchievementToast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useAchievements } from '../hooks/useAchievements.js';
import { api } from '../lib/api.js';
import { crossedTick } from '../lib/milestones.js';
import { masteryFor } from '../lib/masteries.js';
import { playTickSound, tickReset, unlockAudio, playPersonalBestSound } from '../lib/sounds.js';
import { getPersonalBest, setPersonalBest as savePersonalBest } from '../lib/personalBest.js';

const STATUS_TEXT = {
  [STATE.IDLE]:      'Position yourself in frame',
  [STATE.READY]:     'Get into your handstand',
  [STATE.TRACKING]:  'Recording · hold it',
  [STATE.COMPLETE]:  'Nice hold — submit it?',
  [STATE.SUBMITTED]: 'Submitted · go again',
};

const SAMPLE_CLIP_URL = '/test-clips/handstand.mp4';

export default function Track() {
  const { user } = useAuth();
  const videoRef = useRef(null);

  const [source, setSource] = useState('webcam');
  const [fileUrl, setFileUrl] = useState(null);
  const [debug, setDebug] = useState(false);
  const [loopFile, setLoopFile] = useState(false);
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  const camera = useCamera(videoRef, { enabled: source === 'webcam' });
  const file = useVideoFile(videoRef, fileUrl, { enabled: source === 'file', loop: loopFile });
  const ready = source === 'webcam' ? camera.ready : file.ready;
  const srcError = source === 'webcam' ? camera.error : file.error;
  const stream = source === 'webcam' ? camera.stream : file.stream;

  const recorder = useRecorder(stream);

  const [finalDuration, setFinalDuration] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const autoPromptedFor = useRef(0);

  // sessionBest holds the longest attempt of the session. Only its recording
  // can be submitted / downloaded — later weaker attempts don't overwrite it.
  const [sessionBest, setSessionBest] = useState({ durationMs: 0, blob: null, blobUrl: null, mime: null });
  const lastConsideredBlobRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);

  const [personalBest, setPersonalBestState] = useState(() => getPersonalBest());
  const [pbStatus, setPbStatus] = useState(null);   // 'new-pb' | 'close' | 'short' | null
  const [pbDelta, setPbDelta] = useState(0);
  const [isNewPb, setIsNewPb] = useState(false);

  const trackingRef = useRef(null);

  const achievements = useAchievements();
  const attemptRecordedRef = useRef(0);

  const resetTimerRef = useRef(() => {});

  const { state, latest, handleFrame, reset, markSubmitted } = useHandstand({
    onEnterTracking: () => {
      resetTimerRef.current();
      recorder.reset();
      setFinalDuration(0);
      recorder.start();
    },
    onExitTracking: () => recorder.stop(),
  });

  const { elapsedMs, reset: resetTimer } = useTimer(state === STATE.TRACKING);
  useEffect(() => { resetTimerRef.current = resetTimer; }, [resetTimer]);

  const { loaded: poseLoaded, error: poseErr } = usePose(videoRef, ready, handleFrame);

  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current === STATE.TRACKING && state === STATE.COMPLETE) {
      setFinalDuration(elapsedMs);
    }
    prevState.current = state;
  }, [state, elapsedMs]);

  // Promote the just-finished recording to session best if it's the longest.
  useEffect(() => {
    if (!recorder.blob) return;
    if (lastConsideredBlobRef.current === recorder.blob) return;
    lastConsideredBlobRef.current = recorder.blob;
    if (finalDuration <= sessionBest.durationMs) return;
    const url = URL.createObjectURL(recorder.blob);
    setSessionBest((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return { durationMs: finalDuration, blob: recorder.blob, blobUrl: url, mime: recorder.mime };
    });
  }, [recorder.blob, recorder.mime, finalDuration, sessionBest.durationMs]);

  // Record the attempt in the achievement store exactly once per completion.
  useEffect(() => {
    if (state === STATE.IDLE || state === STATE.READY) {
      attemptRecordedRef.current = 0;
      return;
    }
    if (state !== STATE.COMPLETE) return;
    if (finalDuration <= 0) return;
    if (attemptRecordedRef.current === finalDuration) return;
    attemptRecordedRef.current = finalDuration;
    const prevPb = personalBest;
    const wasNewPb = prevPb <= 0 || finalDuration > prevPb;
    achievements.checkOnAttemptComplete(finalDuration, { isNewPb: wasNewPb, prevPb });
  }, [state, finalDuration, personalBest, achievements]);

  // PB detection on TRACKING → COMPLETE.
  useEffect(() => {
    if (state === STATE.TRACKING || state === STATE.IDLE || state === STATE.READY) {
      setPbStatus(null);
      setPbDelta(0);
      return;
    }
    if (state !== STATE.COMPLETE || finalDuration <= 0) return;

    if (personalBest <= 0 || finalDuration > personalBest) {
      const delta = finalDuration - personalBest;
      setPbStatus('new-pb');
      setPbDelta(delta);
      savePersonalBest(finalDuration);
      setPersonalBestState(finalDuration);
      setIsNewPb(true);
    } else {
      const gap = personalBest - finalDuration;
      setPbStatus(gap < 1000 ? 'close' : 'short');
      setPbDelta(gap);
      setIsNewPb(false);
    }
  }, [state, finalDuration, personalBest]);

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

  // Every-3s mastery tick: fire the wire banner with the just-unlocked mastery
  // name + tagline, plus the ambient tick sound. Crossing the boundary (rather
  // than polling elapsedMs>=threshold) means we fire exactly once per tier even
  // though elapsedMs updates every frame.
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (state !== STATE.TRACKING) {
      lastTickRef.current = 0;
      tickReset();
      return;
    }
    if (crossedTick(lastTickRef.current, elapsedMs)) {
      playTickSound();
      const mastery = masteryFor(elapsedMs);
      if (mastery) {
        trackingRef.current?.showCustomBanner(mastery.name.toUpperCase());
      }
    }
    lastTickRef.current = elapsedMs;
  }, [elapsedMs, state]);

  useEffect(() => {
    const onGesture = () => { unlockAudio(); window.removeEventListener('pointerdown', onGesture); };
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);

  // Latch video aspect the first time metadata lands.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => {
      if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
    };
    v.addEventListener('loadedmetadata', on);
    return () => v.removeEventListener('loadedmetadata', on);
  }, [source, fileUrl]);

  const restart = useCallback(() => {
    resetTimer();
    reset();
    recorder.reset();
    setFinalDuration(0);
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
    setFileUrl(SAMPLE_CLIP_URL);
    setSource('file');
    restart();
  }, [fileUrl, restart]);

  const submit = useCallback(async () => {
    if (sessionBest.durationMs <= 0) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      await api.submitAttempt({
        durationMs: sessionBest.durationMs,
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
      // Surface the error even when the modal wasn't the caller (authed users
      // submit via the action-rail button, which skips the modal on success).
      setShowSaveModal(true);
    } finally {
      setSubmitting(false);
    }
  }, [sessionBest.durationMs, sessionBest.blob, source, markSubmitted]);

  // Auto-prompt to save only for guests — authed users skip the confirmation
  // modal and use the Submit button in the action rail (one-click submit).
  useEffect(() => {
    if (user) return;
    if (state !== STATE.COMPLETE) return;
    if (sessionBest.durationMs <= 0) return;
    if (autoPromptedFor.current === finalDuration) return;
    autoPromptedFor.current = finalDuration;
    setShowSaveModal(true);
  }, [user, state, finalDuration, sessionBest.durationMs]);

  const downloadClip = useCallback(() => {
    if (!sessionBest.blobUrl) return;
    const a = document.createElement('a');
    a.href = sessionBest.blobUrl;
    const ext = sessionBest.mime?.includes('mp4') ? 'mp4' : 'webm';
    a.download = `handstand-best-${Math.floor(sessionBest.durationMs)}ms.${ext}`;
    a.click();
  }, [sessionBest.blobUrl, sessionBest.mime, sessionBest.durationMs]);

  const displayMs =
    state === STATE.TRACKING
      ? elapsedMs
      : state === STATE.COMPLETE || state === STATE.SUBMITTED
        ? finalDuration
        : 0;

  const errorMessage = useMemo(() => {
    if (srcError) return String(srcError?.message || srcError);
    if (poseErr) return `Pose detection failed: ${String(poseErr?.message || poseErr)}`;
    return null;
  }, [srcError, poseErr]);

  const complete = state === STATE.COMPLETE || state === STATE.SUBMITTED;
  const pbLine =
    pbStatus === 'new-pb'
      ? ` · +${formatTime(pbDelta)} PB`
      : pbStatus === 'close'
        ? ` · ${formatTime(pbDelta)} off PB`
        : pbStatus === 'short'
          ? ` · ${formatTime(pbDelta)} short`
          : '';

  const completeLabel = complete && finalDuration > 0
    ? `Held ${formatTime(finalDuration)}${pbLine}`
    : STATUS_TEXT[state];

  const actions = complete ? (
    <>
      <button type="button" className="ts-btn primary" onClick={restart}>
        Go again ↑
      </button>
      {sessionBest.blob && (
        <button type="button" className="ts-btn green" onClick={() => setShareOpen(true)}>
          Share clip →
        </button>
      )}
      {state === STATE.COMPLETE && (
        <button
          type="button"
          className="ts-btn ghost"
          disabled={submitting || sessionBest.durationMs <= 0}
          onClick={() => (user ? submit() : setShowSaveModal(true))}
        >
          {submitting ? 'Saving…' : (user ? 'Submit' : 'Submit · register')}
        </button>
      )}
      {sessionBest.blobUrl && (
        <button type="button" className="ts-btn ghost" onClick={downloadClip}>
          Raw clip ⤓
        </button>
      )}
    </>
  ) : null;

  return (
    <div className="h-[calc(100vh-57px)] w-full relative">
      <TrackingView
        ref={trackingRef}
        videoRef={videoRef}
        landmarks={latest.landmarks}
        videoAspect={videoAspect}
        elapsedMs={displayMs}
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
        fileUrlIsSample={fileUrl === SAMPLE_CLIP_URL}
        recording={recorder.recording}
        statusText={completeLabel}
        complete={complete}
        actions={actions}
        mirror={source === 'webcam'}
      />

      {debug && (
        <DebugHUD
          classification={latest.classification}
          debouncerActive={state === STATE.TRACKING}
          state={state}
        />
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); setIsNewPb(false); }}
        sourceBlob={sessionBest.blob}
        durationMs={sessionBest.durationMs}
        handle={user?.username}
        isPersonalBest={isNewPb}
        onShared={achievements.recordEvent}
      />

      <SaveScoreModal
        open={showSaveModal}
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
