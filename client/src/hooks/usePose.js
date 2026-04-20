import { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarkerSingleton = null;
let landmarkerPromise = null;

async function getLandmarker() {
  if (landmarkerSingleton) return landmarkerSingleton;
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const lm = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    landmarkerSingleton = lm;
    return lm;
  })();
  return landmarkerPromise;
}

/**
 * Drives MediaPipe pose detection off the given <video> element.
 * Calls `onFrame({ landmarks, worldLandmarks, timestamp })` per RAF tick once
 * the video is ready. Uses requestAnimationFrame so detection naturally caps
 * around the display refresh rate (which Three.js will share).
 */
export function usePose(videoRef, ready, onFrame) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let cancelled = false;
    let lastTs = -1;
    let landmarker = null;

    (async () => {
      try {
        landmarker = await getLandmarker();
        if (cancelled) return;
        setLoaded(true);
        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.currentTime !== lastTs) {
            lastTs = video.currentTime;
            const ts = performance.now();
            try {
              const result = landmarker.detectForVideo(video, ts);
              const landmarks = result.landmarks?.[0] ?? null;
              const worldLandmarks = result.worldLandmarks?.[0] ?? null;
              if (onFrameRef.current) {
                onFrameRef.current({ landmarks, worldLandmarks, timestamp: ts });
              }
            } catch (err) {
              // MediaPipe occasionally throws on first frames — swallow so the
              // loop keeps running. Surface persistent errors via setError.
              setError(err);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setError(err);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [videoRef, ready]);

  return { loaded, error };
}
