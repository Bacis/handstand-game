import { Link } from 'react-router-dom';

export default function FinalCTA() {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-7">
      <div className="relative overflow-hidden border border-brand-border rounded-md bg-brand-paper p-10 md:p-16 text-center">
        <div className="font-mono uppercase tracking-[0.3em] text-[11px] text-brand-accent">
          · Your rank is waiting
        </div>
        <h3 className="mt-4 font-sans font-black tracking-tight leading-[0.9] text-4xl md:text-6xl">
          Flip the world.
          <br />
          Earn your <em className="font-serif italic font-light text-brand-accent">rank.</em>
        </h3>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/play"
            className="inline-flex items-center gap-4 bg-brand-accent text-black font-mono font-bold uppercase tracking-[0.14em] text-sm px-7 py-5 rounded-sm hover:-translate-y-px transition"
          >
            <span className="w-4 h-4 grid place-items-center bg-black text-brand-accent rounded-full text-[10px]">▶</span>
            Start a run
          </Link>
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-4 border border-white/25 text-white font-mono font-bold uppercase tracking-[0.14em] text-sm px-7 py-5 rounded-sm hover:border-white/50 transition"
          >
            Watch leaderboard
          </Link>
        </div>
        <div className="mt-6 font-mono uppercase tracking-[0.18em] text-[10px] text-brand-mute">
          camera stays on device · nothing uploaded
        </div>
      </div>
    </section>
  );
}
