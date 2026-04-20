import { useEffect, useState } from 'react';
import { findAchievement } from '../lib/achievements.js';

function Toast({ toast, onDismiss }) {
  const [visible, setVisible] = useState((toast.deferMs || 0) === 0);

  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => setVisible(true), toast.deferMs || 0);
    return () => clearTimeout(t);
  }, [toast.deferMs, visible]);

  if (!visible) return null;

  const meta = findAchievement(toast.key);
  if (!meta) return null;

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 bg-ink-800/95 border border-aura-gold/40 rounded-xl px-4 py-3 shadow-glow-gold min-w-[260px] max-w-xs motion-safe:animate-toast-in backdrop-blur"
      role="status"
      onClick={() => onDismiss(toast.id)}
    >
      <div className="text-2xl leading-none select-none">{meta.icon || '🏆'}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-aura-gold font-bold">
          Achievement unlocked
        </div>
        <div className="font-black text-white leading-tight truncate">{meta.name}</div>
        <div className="text-xs text-gray-400 truncate">{meta.description}</div>
      </div>
    </div>
  );
}

export default function AchievementToast({ toasts, onDismiss }) {
  if (!toasts?.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
