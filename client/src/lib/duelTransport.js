import { supabase } from './supabase.js';

// ICE servers: STUN is enough for ~90% of peers, but TURN is needed when
// both sides are behind symmetric NAT / restrictive firewalls (some mobile
// carriers, corporate Wi-Fi). We read credentials from env vars so each
// deployment can plug in its own TURN provider (Twilio, Metered paid, a
// self-hosted coturn, etc). Absent config, we fall back to Open Relay —
// Metered's free public TURN — which works but is rate-limited and not
// suitable for heavy production use.
function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl.split(',').map((s) => s.trim()).filter(Boolean),
      username: turnUser,
      credential: turnCred,
    });
    return servers;
  }

  // Open Relay public TURN (free, rate-limited; swap in your own for prod).
  servers.push({
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  });
  return servers;
}

// One Realtime channel per match carries three ephemeral streams multiplexed
// by broadcast `event`:
//   - 'signal' → WebRTC SDP/ICE (consumed by connectPeer)
//   - 'score'  → per-~200ms score ticks from the player controlling that side
//   - 'state'  → client-initiated state nudges (ready, abandon, final)
// Presence tracks which user_ids are currently listening so the host knows
// when the guest has arrived and can flip the match to 'ready'.

export function createMatchChannel(matchId, { userId, meta = {} }) {
  const channel = supabase.channel(`duel:${matchId}`, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: userId },
    },
  });

  const subs = { signal: new Set(), score: new Set(), state: new Set(), presence: new Set() };

  const fire = (bucket, payload) => {
    for (const cb of subs[bucket]) {
      try { cb(payload); } catch (e) { console.error('[duel] handler threw:', e); }
    }
  };

  channel.on('broadcast', { event: 'signal' }, ({ payload }) => fire('signal', payload));
  channel.on('broadcast', { event: 'score' }, ({ payload }) => fire('score', payload));
  channel.on('broadcast', { event: 'state' }, ({ payload }) => fire('state', payload));
  channel.on('presence', { event: 'sync' }, () => fire('presence', channel.presenceState()));
  channel.on('presence', { event: 'join' }, () => fire('presence', channel.presenceState()));
  channel.on('presence', { event: 'leave' }, () => fire('presence', channel.presenceState()));

  const on = (bucket) => (cb) => {
    subs[bucket].add(cb);
    return () => subs[bucket].delete(cb);
  };

  return {
    userId,
    onSignal: on('signal'),
    onScore: on('score'),
    onState: on('state'),
    onPresenceChange: on('presence'),
    sendSignal: (payload) => channel.send({ type: 'broadcast', event: 'signal', payload }),
    sendScore: (payload) => channel.send({ type: 'broadcast', event: 'score', payload }),
    sendState: (payload) => channel.send({ type: 'broadcast', event: 'state', payload }),
    presenceState: () => channel.presenceState(),
    subscribe: () =>
      new Promise((resolve, reject) => {
        channel.subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ userId, ...meta });
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            reject(err ?? new Error('channel error'));
          } else if (status === 'TIMED_OUT') {
            reject(new Error('channel timeout'));
          }
        });
      }),
    close: () => {
      subs.signal.clear(); subs.score.clear(); subs.state.clear(); subs.presence.clear();
      return supabase.removeChannel(channel);
    },
  };
}

// Picks a single peer to be the offerer using the lexicographic order of
// user IDs. This gives both sides the same answer without negotiation.
export function pickRole(selfId, peerId) {
  return selfId < peerId ? 'offerer' : 'answerer';
}

// Wraps an RTCPeerConnection with SDP/ICE signaling over the given match
// channel. Returns `{ pc, remoteStream, close, waitForConnected }`.
//
// Behavior: adds all tracks from `localStream`, negotiates when `role` is
// offerer, and fires `onRemoteStream` as soon as any remote track arrives.
// If connection state doesn't reach 'connected' within `fallbackMs`, calls
// `onFallback()` — the caller should degrade to score-only.
export function connectPeer({
  channel,
  role,
  localStream,
  onRemoteStream,
  onConnectionStateChange,
  onFallback,
  fallbackMs = 15000,
}) {
  const pc = new RTCPeerConnection({
    iceServers: buildIceServers(),
  });

  const remoteStream = new MediaStream();
  let remoteAnnounced = false;
  // ICE candidates can arrive before setRemoteDescription is called (pc throws
  // if you addIceCandidate too early), so we buffer them and flush once SRD
  // lands. Also used to buffer candidates that arrive during a pending
  // re-offer.
  const pendingIce = [];
  const flushIce = async () => {
    while (pendingIce.length) {
      const c = pendingIce.shift();
      try { await pc.addIceCandidate(c); } catch {}
    }
  };

  pc.ontrack = (e) => {
    // Diagnostic: log once per track so a dead/muted/ended track is obvious
    // in the console when debugging "black video" reports.
    console.log(
      '[duel] ontrack',
      e.track.kind,
      'readyState=' + e.track.readyState,
      'muted=' + e.track.muted,
      'enabled=' + e.track.enabled,
    );
    e.track.addEventListener('unmute', () => console.log('[duel] remote', e.track.kind, 'unmuted'));
    e.track.addEventListener('mute', () => console.log('[duel] remote', e.track.kind, 'muted (keyframe lost?)'));
    e.track.addEventListener('ended', () => console.log('[duel] remote', e.track.kind, 'ended'));

    for (const track of e.streams[0].getTracks()) {
      if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track);
    }
    if (!remoteAnnounced) {
      remoteAnnounced = true;
      onRemoteStream?.(remoteStream);
    }
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) channel.sendSignal({ kind: 'ice', candidate: e.candidate.toJSON() });
  };

  pc.onconnectionstatechange = () => onConnectionStateChange?.(pc.connectionState);

  if (localStream) {
    for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
  }

  // Cap outgoing video at 1.2 Mbps / 30 fps. Deliberately below free TURN
  // relay throttles (Open Relay shapes aggressively above ~1.5 Mbps, which
  // manifests as dropped packets → the remote decoder stalls waiting on a
  // keyframe → all-black video). 1.2 Mbps at 720p still looks sharp.
  //
  // setParameters is deferred via microtask so it runs after the offer is
  // created — some browsers clear our encoding changes if they fire before
  // the transceiver has negotiated, and silently fall back to defaults.
  const applyEncoderCaps = () => {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      try { sender.track.contentHint = 'motion'; } catch {}
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = 1_200_000;
      params.encodings[0].maxFramerate = 30;
      sender.setParameters(params).catch((err) => {
        console.warn('[duel] setParameters failed (non-fatal):', err?.message || err);
      });
    }
  };
  queueMicrotask(applyEncoderCaps);

  let answerReceived = false;
  let offerReceived = false;

  const unsubSignal = channel.onSignal(async (payload) => {
    try {
      if (payload.kind === 'offer' && role === 'answerer') {
        // Late-arriving duplicate offers are harmless — we just re-set the
        // remote description and re-create the answer. (Our offerer sends
        // the same cached SDP on retry so this is idempotent.)
        if (!offerReceived) offerReceived = true;
        await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        applyEncoderCaps(); // re-apply now that encodings exist post-SLD
        channel.sendSignal({ kind: 'answer', sdp: answer.sdp });
      } else if (payload.kind === 'answer' && role === 'offerer') {
        if (answerReceived) return;
        answerReceived = true;
        await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        await flushIce();
      } else if (payload.kind === 'ice' && payload.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(payload.candidate).catch(() => {});
        } else {
          pendingIce.push(payload.candidate);
        }
      }
    } catch (err) {
      console.error('[duel] signaling error:', err);
    }
  });

  // Offerer flow: create one offer, cache its SDP, then re-broadcast on a
  // 1.5 s cadence until we see an answer. This dodges the race where the
  // answerer hasn't subscribed to the channel yet when our first offer
  // goes out — broadcasts don't queue for late subscribers.
  let offerRetryTimer = null;
  if (role === 'offerer') {
    (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        applyEncoderCaps(); // re-apply now that encodings exist post-SLD
        const send = () => {
          if (answerReceived) return;
          channel.sendSignal({ kind: 'offer', sdp: offer.sdp });
        };
        send();
        offerRetryTimer = setInterval(() => {
          if (answerReceived) { clearInterval(offerRetryTimer); offerRetryTimer = null; return; }
          send();
        }, 1500);
      } catch (err) {
        console.error('[duel] offer creation failed:', err);
      }
    })();
  }

  const fallbackTimer = setTimeout(() => {
    if (pc.connectionState !== 'connected' && pc.connectionState !== 'completed') {
      onFallback?.(pc.connectionState);
    }
  }, fallbackMs);

  const waitForConnected = (timeoutMs = fallbackMs) =>
    new Promise((resolve) => {
      if (pc.connectionState === 'connected') return resolve(true);
      const to = setTimeout(() => resolve(false), timeoutMs);
      const handler = () => {
        if (pc.connectionState === 'connected') {
          clearTimeout(to);
          pc.removeEventListener('connectionstatechange', handler);
          resolve(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          clearTimeout(to);
          pc.removeEventListener('connectionstatechange', handler);
          resolve(false);
        }
      };
      pc.addEventListener('connectionstatechange', handler);
    });

  return {
    pc,
    remoteStream,
    waitForConnected,
    close: () => {
      clearTimeout(fallbackTimer);
      if (offerRetryTimer) clearInterval(offerRetryTimer);
      unsubSignal();
      for (const s of pc.getSenders()) s.track?.stop?.();
      pc.close();
    },
  };
}

// 5 Hz score broadcasts: more than enough visual fidelity for a mm:ss timer
// tick and well under the Realtime broadcast quota.
export function throttle(fn, ms) {
  let last = 0;
  let pending = null;
  let timer = null;
  return (...args) => {
    const now = performance.now();
    const wait = ms - (now - last);
    if (wait <= 0) {
      last = now;
      fn(...args);
    } else {
      pending = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = performance.now();
          fn(...pending);
          pending = null;
        }, wait);
      }
    }
  };
}
