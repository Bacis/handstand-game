import { useEffect, useRef, useState } from 'react';

// Coarse pointer = touch-primary device (phones/tablets). Use a lower ideal
// resolution there so we don't fight the 16:9 desktop assumption with a
// 9:16 portrait phone camera and waste decode bandwidth.
const IS_COARSE_POINTER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

const DEFAULT_WIDTH = IS_COARSE_POINTER ? 960 : 1280;
const DEFAULT_HEIGHT = IS_COARSE_POINTER ? 540 : 720;

/**
 * Acquires a getUserMedia stream and binds it to the supplied <video> element.
 * The caller owns the videoRef so that other source hooks (file playback) can
 * share the same element.
 *
 * `facingMode: "environment"` is honored on mobile (rear camera). Desktop
 * browsers ignore it and just give the only camera available.
 *
 * Set `enabled = false` to release the camera (used when switching to a
 * different test source).
 */
export function useCamera(videoRef, { enabled = true, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, facingMode = 'environment' } = {}) {
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      return;
    }
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: width }, height: { ideal: height }, facingMode },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.src = '';
        video.loop = false;
        video.playsInline = true;
        video.muted = true;
        await video.play();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    }
    start();

    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        try { video.srcObject = null; } catch {}
      }
      setReady(false);
    };
  }, [videoRef, enabled, width, height, facingMode]);

  return { stream: streamRef.current, ready, error };
}
