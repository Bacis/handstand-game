import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Track from './pages/Track.jsx';
import PlayPicker from './pages/PlayPicker.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import Profile from './pages/Profile.jsx';
import SkeletonLab from './pages/SkeletonLab.jsx';
import BadgeLab from './pages/BadgeLab.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';

function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const navLink = (to, label, extraClass = '') => {
    const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`font-mono uppercase tracking-[0.14em] text-[11px] transition ${
          active ? 'text-white' : 'text-white/70 hover:text-white'
        } ${extraClass}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-ink-900/95 backdrop-blur border-b border-white/5">
      <div className="flex items-center justify-between px-4 md:px-7 py-[18px] font-mono uppercase tracking-[0.14em] text-[11px]">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-white">
          <span className="inline-grid place-items-center w-[22px] h-[22px] bg-brand-accent text-black font-extrabold font-sans leading-none rotate-180">▲</span>
          <span>playstando</span>
        </Link>

        <nav className="hidden md:flex gap-[22px]">
          {navLink('/play', 'Play')}
          {navLink('/leaderboard', 'Leaderboard')}
          <a
            href="/#ranks"
            className="font-mono uppercase tracking-[0.14em] text-[11px] text-white/70 hover:text-white transition"
          >
            Ranks · 40
          </a>
          <a
            href="/#how"
            className="font-mono uppercase tracking-[0.14em] text-[11px] text-white/70 hover:text-white transition"
          >
            How
          </a>
        </nav>

        <div className="flex items-center gap-3.5">
          <span className="hidden sm:inline-flex items-center gap-2 text-brand-accent">
            <span className="w-2 h-2 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
            14 holding now
          </span>
          {user ? (
            <>
              <Link
                to={`/profile/${user.id}`}
                className="hidden sm:inline font-mono uppercase tracking-[0.14em] text-[11px] text-white/85 hover:text-white"
              >
                {user.username}
              </Link>
              <button
                onClick={logout}
                className="hidden sm:inline font-mono uppercase tracking-[0.14em] text-[11px] text-white/60 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => setSignInOpen(true)}
              className="font-mono uppercase tracking-[0.14em] text-[11px] text-white/80 hover:text-white"
              style={{ touchAction: 'manipulation' }}
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="md:hidden inline-grid place-items-center w-10 h-10 -mr-2 text-white/80 hover:text-white"
            style={{ touchAction: 'manipulation' }}
          >
            <span className="block relative w-5 h-[14px]">
              <span
                className={`absolute left-0 right-0 h-[2px] bg-current transition-transform ${
                  menuOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-current transition-opacity ${
                  menuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`absolute left-0 right-0 h-[2px] bg-current transition-transform ${
                  menuOpen ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-0'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-white/5 bg-ink-900/98 backdrop-blur flex flex-col">
          {navLink('/play', 'Play', 'px-5 py-4 border-b border-white/5')}
          {navLink('/leaderboard', 'Leaderboard', 'px-5 py-4 border-b border-white/5')}
          <a
            href="/#ranks"
            onClick={() => setMenuOpen(false)}
            className="px-5 py-4 border-b border-white/5 font-mono uppercase tracking-[0.14em] text-[11px] text-white/70 hover:text-white transition"
          >
            Ranks · 40
          </a>
          <a
            href="/#how"
            onClick={() => setMenuOpen(false)}
            className="px-5 py-4 border-b border-white/5 font-mono uppercase tracking-[0.14em] text-[11px] text-white/70 hover:text-white transition"
          >
            How
          </a>
          {user && (
            <>
              <Link
                to={`/profile/${user.id}`}
                className="px-5 py-4 border-b border-white/5 font-mono uppercase tracking-[0.14em] text-[11px] text-white/85 hover:text-white"
              >
                {user.username}
              </Link>
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="px-5 py-4 border-b border-white/5 text-left font-mono uppercase tracking-[0.14em] text-[11px] text-white/60 hover:text-white"
              >
                Logout
              </button>
            </>
          )}
          <span className="px-5 py-3 inline-flex items-center gap-2 text-brand-accent font-mono uppercase tracking-[0.14em] text-[11px]">
            <span className="w-2 h-2 rounded-full bg-brand-accent motion-safe:animate-[pulseOp_1.2s_ease-in-out_infinite]" />
            14 holding now
          </span>
        </nav>
      )}
      {signInOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSignInOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <AuthPanel onClose={() => setSignInOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-full flex flex-col">
        <NavBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<PlayPicker />} />
            <Route path="/play/:challenge" element={<Track />} />
            <Route path="/track" element={<Navigate to="/play" replace />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/leaderboard/:challenge" element={<LeaderboardPage />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/skeleton-lab" element={<SkeletonLab />} />
            <Route path="/badges" element={<BadgeLab />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
