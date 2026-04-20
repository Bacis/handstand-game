// Live readout of every classifyPose check: pass/fail, current value vs
// threshold. Lets you stand at the desk, watch which conditions are blocking
// detection, and tune thresholds without iterating in front of a camera.

const LABELS = {
  visibility:      'landmark visibility',
  wristsDown:      'wrists below floor line',
  anklesUp:        'ankles above sky line',
  hipsAboveWrists: 'hips above wrists',
  headBelowHips:   'head below hips',
  handsClose:      'hands close together',
};

function fmt(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

export default function DebugHUD({ classification, debouncerActive, state }) {
  const checks = classification?.checks;
  return (
    <div className="absolute top-2 left-2 bg-black/70 text-[11px] font-mono rounded-md p-2 max-w-[300px] pointer-events-none">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400">debug</span>
        <span className={debouncerActive ? 'text-green-400' : 'text-gray-500'}>
          {debouncerActive ? 'ACTIVE' : 'idle'} · {state}
        </span>
      </div>
      {!classification && <div className="text-gray-500">waiting for pose…</div>}
      {classification && !checks && (
        <div className="text-yellow-400">no landmarks ({classification.reason})</div>
      )}
      {checks && (
        <table className="w-full">
          <tbody>
            {Object.entries(checks).map(([key, c]) => (
              <tr key={key} className={c.pass ? 'text-green-400' : 'text-red-400'}>
                <td className="pr-1">{c.pass ? '✓' : '✗'}</td>
                <td className="pr-2 text-gray-300">{LABELS[key] ?? key}</td>
                <td className="text-right tabular-nums">{fmt(c.value)} {c.op} {fmt(c.threshold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
