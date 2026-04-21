import { Link } from 'react-router-dom';
import { CHALLENGES } from '../lib/challenges/index.js';
import { getPersonalBest } from '../lib/personalBest.js';

/**
 * Grid of challenge cards. Used as the /play landing page and embedded on
 * Home. Each card shows the challenge label, pitch copy, current personal
 * best, and routes to /play/:id.
 */
export default function ChallengePicker({ heading = 'Pick your challenge.', dense = false }) {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-7">
      {heading && (
        <h2 className="font-sans font-black tracking-tight text-3xl md:text-5xl leading-[0.95] mb-5">
          Pick your <em className="font-serif italic font-light text-brand-accent">challenge.</em>
        </h2>
      )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${dense ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-3`}>
        {CHALLENGES.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
      </div>
    </section>
  );
}

function ChallengeCard({ challenge }) {
  const pb = getPersonalBest(challenge.id);
  const pbText = pb > 0 ? challenge.formatScore(pb) : 'No PB yet';
  return (
    <Link
      to={`/play/${challenge.id}`}
      className="group flex flex-col gap-3 border border-brand-border rounded-md bg-brand-paper p-5 hover:border-brand-accent/55 transition"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-grid place-items-center w-9 h-9 font-extrabold text-black text-lg leading-none"
          style={{ background: challenge.accent, fontFamily: 'Inter, sans-serif' }}
          aria-hidden
        >
          {challenge.icon}
        </span>
        <span className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/55">
          {challenge.scoreType === 'reps' ? 'reps' : 'duration'}
        </span>
      </div>
      <div>
        <div className="font-sans font-black tracking-tight text-2xl leading-tight">
          {challenge.label}
        </div>
        <div className="font-serif italic font-light text-white/65 text-sm mt-1.5 leading-snug">
          {challenge.copy.heroQuestion}
        </div>
      </div>
      <p className="text-sm text-white/65 leading-relaxed flex-1">
        {challenge.copy.heroPitch}
      </p>
      <div className="flex items-center justify-between pt-2 border-t border-brand-border">
        <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-white/55">
          PB · <span className="text-white">{pbText}</span>
        </span>
        <span className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-brand-accent group-hover:underline">
          Start ↑
        </span>
      </div>
    </Link>
  );
}
