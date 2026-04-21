import { useCallback, useEffect, useRef, useState } from 'react';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4;codecs=h264',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Silent background MediaRecorder. Holds chunks in memory; on stop, exposes
 * a Blob + object URL for download/upload.
 *
 * Each start() creates a fresh MediaRecorder with its OWN closure-owned chunks
 * array. That matters when rapid-fire attempts can land stop() + start() in
 * quick succession — the pending onstop from the previous recorder must drop
 * into its own chunks, not into a shared ref that the next recorder has
 * already claimed. Without this, attempts can bleed into each other.
 */
export function useRecorder(stream) {
  const recorderRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const urlRef = useRef(null);
  const mime = useRef(pickMime());

  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!stream || !mime.current) return;

    // Force-stop any lingering recorder and drop its onstop — we don't want a
    // late blob from the previous attempt to overwrite the fresh one.
    const prev = recorderRef.current;
    if (prev && prev.state !== 'inactive') {
      prev.onstop = null;
      prev.ondataavailable = null;
      try { prev.stop(); } catch {}
    }

    revokeUrl();
    setBlob(null);
    setUrl(null);

    const chunks = []; // closure-owned — belongs to THIS recorder only
    const rec = new MediaRecorder(stream, { mimeType: mime.current });
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      // If this recorder was superseded before it finished, skip the blob —
      // the current attempt's recorder is the source of truth.
      if (recorderRef.current !== rec) return;
      const b = new Blob(chunks, { type: mime.current });
      const nextUrl = URL.createObjectURL(b);
      urlRef.current = nextUrl;
      setBlob(b);
      setUrl(nextUrl);
    };
    rec.start(1000); // gather chunks every 1s
    recorderRef.current = rec;
    setRecording(true);
  }, [stream, revokeUrl]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch {}
    }
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    // Detach any live recorder so its pending onstop doesn't clobber state.
    const prev = recorderRef.current;
    if (prev) {
      prev.onstop = null;
      prev.ondataavailable = null;
      if (prev.state !== 'inactive') {
        try { prev.stop(); } catch {}
      }
      recorderRef.current = null;
    }
    revokeUrl();
    setBlob(null);
    setUrl(null);
    setRecording(false);
  }, [revokeUrl]);

  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        try { rec.stop(); } catch {}
      }
      revokeUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, reset, recording, blob, url, mime: mime.current };
}
