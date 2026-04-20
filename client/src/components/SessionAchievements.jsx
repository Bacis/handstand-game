import { findAchievement } from '../lib/achievements.js';
import Badge from './Badge.jsx';

// Right-edge stack inside the video frame. Lists badges unlocked during
// the current session only — empty by default, pops in as they fire.
export default function SessionAchievements({ keys = [] }) {
  if (!keys.length) return null;
  return (
    <div className="absolute top-20 right-3 flex flex-col gap-1.5 pointer-events-none select-none max-w-[160px]">
      <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">
        This session
      </div>
      {keys.map((key) => {
        const a = findAchievement(key);
        if (!a) return null;
        return (
          <div
            key={key}
            className="flex items-center gap-2 bg-ink-800/80 border border-aura-gold/30 rounded-full pl-1 pr-3 py-1 motion-safe:animate-kinetic-slide backdrop-blur-sm"
          >
            <Badge achievement={a} size="sm" />
            <span className="text-[10px] font-bold text-white truncate">{a.name}</span>
          </div>
        );
      })}
    </div>
  );
}
