import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from '../../hooks/useCamera.js';
import { usePose } from '../../hooks/usePose.js';
import PoseSkeleton from '../track/PoseSkeleton.jsx';

// Maps a getUserMedia DOMException to a sentence a human can act on.
function friendlyCameraError(err) {
  if (!err) return null;
  switch (err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        title: 'Camera access is blocked',
        body: 'Click the camera icon in your browser\u2019s address bar and allow playstando.com to use your camera, then refresh.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        title: 'No camera detected',
        body: 'We couldn\u2019t find a camera on this device. Try plugging one in or switching to a phone / laptop.',
      };
    case 'NotReadableError':
      return {
        title: 'Camera is busy',
        body: 'Another app (Zoom, Meet, OBS\u2026) is using your camera. Close it and refresh.',
      };
    default:
      return {
        title: 'Camera couldn\u2019t start',
        body: err.message || 'Try refreshing the page.',
      };
  }
}

/**
 * Compact camera + pose self-test. Renders a live preview with skeleton
 * overlay and exposes readiness to the parent via `onStatusChange`:
 *   - cameraReady: getUserMedia succeeded and stream is producing frames
 *   - poseReady:   MediaPipe has detected a body for ~800 ms (debounced)
 *   - error:       friendlyCameraError() shape or null
 *
 * Parents should disable their "Go" button until `cameraReady && poseReady`.
 */
export default function CameraCheck({ onStatusChange, className = '' }) {
  const videoRef = useRef(null);
  const camera = useCamera(videoRef, { enabled: true });
  const [landmarks, setLandmarks] = useState(null);
  const [poseReady, setPoseReady] = useState(false);
  const [elapsedNoPoseMs, setElapsedNoPoseMs] = useState(0);

  const onFrame = useCallback(({ landmarks }) => setLandmarks(landmarks), []);
  const { loaded: poseLoaded } = usePose(videoRef, camera.ready, onFrame, { frameStride: 2 });

  // Debounce landmarks → poseReady. Enter after 800 ms of continuous
  // detection; drop after 400 ms of nothing (MediaPipe blips shouldn't
  // revoke readiness).
  useEffect(() => {
    if (landmarks) {
      const t = setTimeout(() => setPoseReady(true), 800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPoseReady(false), 400);
    return () => clearTimeout(t);
  }, [landmarks]);

  // Timer since camera came up without pose — drives the escalating hint.
  useEffect(() => {
    if (!camera.ready || !poseLoaded || poseReady) {
      setElapsedNoPoseMs(0);
      return;
    }
    const start = performance.now();
    const id = setInterval(() => setElapsedNoPoseMs(performance.now() - start), 500);
    return () => clearInterval(id);
  }, [camera.ready, poseLoaded, poseReady]);

  const err = friendlyCameraError(camera.error);

  // Surface status upward. Keep the callback identity referenced via a ref
  // to avoid firing on every parent render.
  const cbRef = useRef(onStatusChange);
  useEffect(() => { cbRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => {
    cbRef.current?.({ cameraReady: camera.ready, poseReady, error: err });
  }, [camera.ready, poseReady, err]);

  const status = err
    ? { tone: 'error', label: err.title }
    : !camera.ready
    ? { tone: 'wait', label: 'Starting camera\u2026' }
    : !poseLoaded
    ? { tone: 'wait', label: 'Loading pose model\u2026' }
    : poseReady
    ? { tone: 'ok', label: 'We can see you \u2014 you\u2019re good to go' }
    : elapsedNoPoseMs > 6000
    ? { tone: 'warn', label: 'Still can\u2019t see you \u2014 is the lens covered?' }
    : { tone: 'wait', label: 'Step fully into frame' };

  const ringColor =
    status.tone === 'ok' ? 'border-emerald-400'
    : status.tone === 'warn' ? 'border-amber-400'
    : status.tone === 'error' ? 'border-red-500'
    : 'border-white/20';

  return (
    <div className={`${className}`}>
      <div className={`relative aspect-video bg-black rounded-sm overflow-hidden border ${ringColor} transition-colors`}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />
        <PoseSkeleton landmarks={landmarks} videoAspect={16 / 9} mirror />

        {err && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 text-center p-5">
            <div>
              <div className="font-mono uppercase tracking-[0.2em] text-[11px] text-red-400">
                · {err.title}
              </div>
              <p className="text-white/75 text-xs mt-2 max-w-sm leading-relaxed">{err.body}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 font-mono uppercase tracking-[0.18em] text-[11px]">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status.tone === 'ok' ? 'bg-emerald-400'
            : status.tone === 'warn' ? 'bg-amber-400 motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]'
            : status.tone === 'error' ? 'bg-red-500'
            : 'bg-white/50 motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]'
          }`}
        />
        <span className={
          status.tone === 'ok' ? 'text-emerald-300'
          : status.tone === 'warn' ? 'text-amber-300'
          : status.tone === 'error' ? 'text-red-300'
          : 'text-white/70'
        }>
          {status.label}
        </span>
      </div>
    </div>
  );
}
