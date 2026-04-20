import { useEffect, useRef, useState } from 'react';

/**
 * Plays a video file (or URL) into the supplied <video> element so the same
 * MediaPipe pipeline can run on canned footage for testing.
 *
 * Exposes a MediaStream from `videoElement.captureStream()` so the recorder
 * keeps working in test mode too.
 */
export function useVideoFile(videoRef, src, { enabled = true, loop = true } = {}) {
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !src) {
      setReady(false);
      return;
    }
    let cancelled = false;

    async function start() {
      try {
        const video = videoRef.current;
        if (!video) return;
        try { video.srcObject = null; } catch {}
        video.src = src;
        video.loop = loop;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        await video.play();
        if (cancelled) return;
        // captureStream lets MediaRecorder reuse the same code path.
        if (typeof video.captureStream === 'function') {
          streamRef.current = video.captureStream(30);
        } else if (typeof video.mozCaptureStream === 'function') {
          streamRef.current = video.mozCaptureStream(30);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      setReady(false);
    };
  }, [videoRef, src, enabled, loop]);

  return { stream: streamRef.current, ready, error };
}
