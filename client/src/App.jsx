import { useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Track from './pages/Track.jsx';
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

  const navLink = (to, label) => {
    const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`font-mono uppercase tracking-[0.14em] text-[11px] transition ${
          active ? 'text-white' : 'text-white/70 hover:text-white'
        }`}
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
          <span>handstand</span>
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
                className="font-mono uppercase tracking-[0.14em] text-[11px] text-white/85 hover:text-white"
              >
                {user.username}
              </Link>
              <button
                onClick={logout}
                className="font-mono uppercase tracking-[0.14em] text-[11px] text-white/60 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => setSignInOpen(true)}
              className="font-mono uppercase tracking-[0.14em] text-[11px] text-white/80 hover:text-white"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
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
            <Route path="/play" element={<Track />} />
            <Route path="/track" element={<Navigate to="/play" replace />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/skeleton-lab" element={<SkeletonLab />} />
            <Route path="/badges" element={<BadgeLab />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
