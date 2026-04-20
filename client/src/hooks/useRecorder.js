import { useCallback, useEffect, useRef, useState } from 'react';

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Silent background MediaRecorder. Holds chunks in memory; the user never sees
 * recording start. On stop, exposes a Blob + object URL for download/upload.
 */
export function useRecorder(stream) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const mime = useRef(pickMime());

  const start = useCallback(() => {
    if (!stream || !mime.current) return;
    if (recorderRef.current && recorderRef.current.state === 'recording') return;
    chunksRef.current = [];
    setBlob(null);
    if (url) {
      URL.revokeObjectURL(url);
      setUrl(null);
    }
    const rec = new MediaRecorder(stream, { mimeType: mime.current });
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime.current });
      setBlob(b);
      setUrl(URL.createObjectURL(b));
    };
    rec.start(1000); // gather chunks every 1s
    recorderRef.current = rec;
    setRecording(true);
  }, [stream, url]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    chunksRef.current = [];
    setBlob(null);
    if (url) {
      URL.revokeObjectURL(url);
      setUrl(null);
    }
  }, [url]);

  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, reset, recording, blob, url, mime: mime.current };
}
