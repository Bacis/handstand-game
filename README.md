# Handstand Tracker

Browser-based handstand timer with MediaPipe pose detection, a Three.js aura + floating counter overlay, silent video recording, and a self-hosted Express + SQLite leaderboard.

## Stack

- **Client:** React + Vite + Tailwind, `@mediapipe/tasks-vision`, `three`, `MediaRecorder`
- **Server:** Express, `better-sqlite3`, `express-session`, `multer`, `bcrypt`
- **Storage:** SQLite (`data/handstand.db`) + filesystem (`data/uploads/`)

## Quick Start

```bash
npm run install:all          # installs root + client + server deps
cp server/.env.example server/.env   # set SESSION_SECRET
npm run dev                  # starts both client (5173) and server (3001)
```

Open http://localhost:5173 and grant camera permission. Get into a handstand.

## Project Layout

```
handstand-counter/
├── client/   React + Vite frontend
├── server/   Express + SQLite backend
└── data/     SQLite db + uploaded videos/avatars (runtime, gitignored)
```

See `/Users/bacis/.claude/plans/handstand-tracker-atomic-oasis.md` for the full design.
