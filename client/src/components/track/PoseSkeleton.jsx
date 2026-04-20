import { memo } from 'react';

// MediaPipe Pose connections. Matches @mediapipe/tasks-vision landmark indices.
const CONNECTIONS = [
  [11, 13], [13, 15],                          // left arm
  [12, 14], [14, 16],                          // right arm
  [11, 12], [11, 23], [12, 24], [23, 24],      // torso
  [23, 25], [25, 27], [24, 26], [26, 28],      // legs
  [27, 29], [29, 31], [27, 31],                // left foot
  [28, 30], [30, 32], [28, 32],                // right foot
];
const HEAD_JOINT = 0; // nose — rendered larger
const JOINTS_TO_DOT = [
  0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
];

// SVG overlay that renders MediaPipe landmarks as a dashed green skeleton with
// joint dots + soft glow. `mirror` flips x for webcam "selfie" view.
// videoAspect drives the viewBox so `preserveAspectRatio=slice` crops the
// overlay identically to the <video object-fit=cover> beneath it.
function PoseSkeleton({ landmarks, videoAspect = 16 / 9, mirror = false, color = '#33ff66' }) {
  const vbW = videoAspect;
  const vbH = 1;

  if (!landmarks || landmarks.length === 0) {
    return (
      <svg
        className="ts-pose"
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      />
    );
  }

  const pt = (i) => {
    const lm = landmarks[i];
    if (!lm) return null;
    if ((lm.visibility ?? 1) < 0.3) return null;
    const x = mirror ? (1 - lm.x) : lm.x;
    return { x: x * vbW, y: lm.y * vbH };
  };

  return (
    <svg
      className="ts-pose"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g
        stroke={color}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {CONNECTIONS.map(([a, b], i) => {
          const pa = pt(a);
          const pb = pt(b);
          if (!pa || !pb) return null;
          return (
            <line
              key={i}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              strokeWidth={3}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
      <g fill={color}>
        {JOINTS_TO_DOT.map((idx) => {
          const p = pt(idx);
          if (!p) return null;
          const r = idx === HEAD_JOINT ? 0.014 : 0.007;
          return <circle key={idx} cx={p.x} cy={p.y} r={r} />;
        })}
      </g>
    </svg>
  );
}

export default memo(PoseSkeleton);
