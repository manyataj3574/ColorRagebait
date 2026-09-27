# Color Ragebait MongoDB Backend

Node.js + Express backend service connected to MongoDB Atlas for persistent leaderboard, anti-cheat, session verification, and player records.

## Features
- **Database:** MongoDB Atlas via Mongoose
- **Anti-Cheat:** 
  - Sub-millisecond device banning & checking
  - Speedrun & timing bot detection (sub-180s for 400+, minimum reaction intervals)
  - Game session handshake token verification (`/api/game/start` & `/api/score`)
  - Auto-expiring active sessions using MongoDB TTL index
- **Leaderboard:** Dynamic sorted standings with compound index (`disqualified`, `highScore`, `highestScoreDate`)
- **Auto Data Migration:** Automatically imports local file data from `data/scores_backup.json` and `data/banned_devices.json` into MongoDB on initial boot.

---

## Directory Structure
```
backend/
├── .env                  # Port & MongoDB Connection URI
├── package.json          # Dependencies & scripts
└── src/
    ├── config/
    │   └── db.js         # Mongoose connection
    ├── models/
    │   ├── Player.js     # Player schema & indexes
    │   ├── BannedDevice.js# Banned devices schema
    │   └── GameSession.js# Ephemeral sessions with TTL
    ├── middleware/
    │   └── antiCheat.js  # Ban checking & interceptor
    ├── controllers/
    │   ├── leaderboardController.js
    │   ├── playerController.js
    │   ├── scoreController.js
    │   └── antiCheatController.js
    ├── routes/
    │   └── apiRoutes.js  # All /api endpoints
    ├── utils/
    │   ├── levels.js     # Scoring & level formulas
    │   └── migrateLocalData.js
    └── server.js         # Express app entry point
```

---

## Running the Backend

From the project root:
```bash
# Development (with auto-reload)
npm run backend

# Production start
npm run backend:start
```

Or directly inside the `backend` folder:
```bash
cd backend
npm install
npm run dev
```

---

## API Endpoints
- `GET  /api/health` - Health check
- `GET  /api/leaderboard?studentId=...` - Top 10 + current player standing
- `GET  /api/player/:studentId` - Fetch player statistics & rank
- `POST /api/player/register` - Create or retrieve player profile
- `POST /api/game/start` - Initiate anti-cheat game session handshake
- `POST /api/score` - Submit score with timing integrity checks
- `POST /api/sync` - Synchronize offline cached scores
- `GET  /api/anticheat/check` - Check device ban status
- `POST /api/anticheat/ban` - Report and ban fraudulent devices
