import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Persistent JSON file storage
const DATA_DIR = path.resolve(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const BACKUP_FILE = path.join(DATA_DIR, 'scores_backup.json');
const BANNED_FILE = path.join(DATA_DIR, 'banned_devices.json');

interface PlayerData {
  studentId: string;
  highScore: number;
  highestScoreDate: string;
  totalGames: number;
  lastScore: number;
  lastPlayedAt: string;
  level?: number;
  disqualified?: boolean;
}

interface ScoresDatabase {
  players: Record<string, PlayerData>;
}

interface BannedDeviceEntry {
  deviceId: string;
  studentId?: string;
  reason: string;
  bannedAt: string;
  ip?: string;
  userAgent?: string;
}

interface BannedDatabase {
  devices: Record<string, BannedDeviceEntry>;
}

// Active game sessions for anti-cheat verification
interface GameSession {
  sessionId: string;
  studentId: string;
  deviceId: string;
  token: string;
  startedAt: number;
}
const activeSessions = new Map<string, GameSession>();

// Cleanup stale sessions older than 2 hours every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.startedAt > 2 * 60 * 60 * 1000) {
      activeSessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

// Calculate level based on 15 answers per level
function calculateLevel(score: number): number {
  const safeScore = Math.max(0, Math.floor(score));
  return Math.min(12, Math.floor(safeScore / 15) + 1);
}

// Banned devices management
function getBannedDevices(): BannedDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BANNED_FILE)) {
      const initial: BannedDatabase = { devices: {} };
      fs.writeFileSync(BANNED_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(BANNED_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.devices) {
      return { devices: {} };
    }
    return parsed as BannedDatabase;
  } catch (err) {
    console.error('Error reading banned devices:', err);
    return { devices: {} };
  }
}

function saveBannedDevices(db: BannedDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BANNED_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving banned devices:', err);
  }
}

function banDevice(deviceId: string, reason: string, studentId?: string, ip?: string, userAgent?: string) {
  if (!deviceId) return;
  const cleanDevice = deviceId.trim().toUpperCase();
  const banDb = getBannedDevices();

  banDb.devices[cleanDevice] = {
    deviceId: cleanDevice,
    studentId: studentId ? studentId.trim().toUpperCase() : undefined,
    reason,
    bannedAt: new Date().toISOString(),
    ip,
    userAgent,
  };
  saveBannedDevices(banDb);
  console.warn(`[ANTI-CHEAT BAN] Device ${cleanDevice} banned: ${reason} (Student: ${studentId || 'unknown'})`);

  // Disqualify cheated scores from database if studentId is known
  if (studentId) {
    const scoresDb = getDatabase();
    const normId = normalizeId(studentId);
    if (scoresDb.players[normId]) {
      scoresDb.players[normId].highScore = 0;
      scoresDb.players[normId].disqualified = true;
      saveDatabase(scoresDb);
    }
  }
}

function isDeviceBanned(deviceId: string): BannedDeviceEntry | null {
  if (!deviceId) return null;
  const banDb = getBannedDevices();
  return banDb.devices[deviceId.trim().toUpperCase()] || null;
}

// Ensure scores data folder and file exist
function getDatabase(): ScoresDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let parsed: any = null;

    if (fs.existsSync(SCORES_FILE)) {
      try {
        const raw = fs.readFileSync(SCORES_FILE, 'utf-8');
        parsed = JSON.parse(raw);
      } catch (err) {
        console.warn('Could not parse primary scores file, trying backup:', err);
      }
    }

    if (!parsed || !parsed.players || Object.keys(parsed.players).length === 0) {
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const rawBackup = fs.readFileSync(BACKUP_FILE, 'utf-8');
          const backupParsed = JSON.parse(rawBackup);
          if (backupParsed && backupParsed.players && Object.keys(backupParsed.players).length > 0) {
            parsed = backupParsed;
          }
        } catch (backupErr) {
          console.warn('Backup file read error:', backupErr);
        }
      }
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.players) {
      const initial: ScoresDatabase = { players: {} };
      fs.writeFileSync(SCORES_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }

    return parsed as ScoresDatabase;
  } catch (err) {
    console.error('Error reading scores database:', err);
    return { players: {} };
  }
}

function saveDatabase(db: ScoresDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const content = JSON.stringify(db, null, 2);

    try {
      const tempFile = `${SCORES_FILE}.tmp`;
      fs.writeFileSync(tempFile, content, 'utf-8');
      fs.renameSync(tempFile, SCORES_FILE);
    } catch {
      fs.writeFileSync(SCORES_FILE, content, 'utf-8');
    }

    try {
      fs.writeFileSync(BACKUP_FILE, content, 'utf-8');
    } catch {
      // Ignored
    }
  } catch (err) {
    console.error('Error saving scores database:', err);
  }
}

function normalizeId(id: string): string {
  return String(id || '')
    .trim()
    .toUpperCase();
}

function getSortedLeaderboard(players: Record<string, PlayerData>) {
  // Cap at 500: any score > 500 is filtered out as humanly impossible
  const list = Object.values(players).filter(
    (p) => !p.disqualified && p.highScore <= 500 && (p.totalGames > 0 || p.highScore > 0)
  );

  list.sort((a, b) => {
    if (b.highScore !== a.highScore) {
      return b.highScore - a.highScore;
    }
    const dateA = new Date(a.highestScoreDate || 0).getTime();
    const dateB = new Date(b.highestScoreDate || 0).getTime();
    return dateA - dateB;
  });

  return list.map((item, index) => ({
    rank: index + 1,
    studentId: item.studentId,
    highScore: Math.min(500, item.highScore),
    highestScoreDate: item.highestScoreDate,
    totalGames: item.totalGames,
    level: item.level || calculateLevel(item.highScore),
  }));
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Forward /api requests to MongoDB Backend on port 5000
app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUrl = `${BACKEND_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && key.toLowerCase() !== 'host') {
        headers[key] = value;
      }
    }
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const backendRes = await fetch(targetUrl, fetchOptions);
    const contentType = backendRes.headers.get('content-type') || '';
    res.status(backendRes.status);

    if (contentType.includes('application/json')) {
      const data = await backendRes.json();
      return res.json(data);
    } else {
      const text = await backendRes.text();
      return res.send(text);
    }
  } catch {
    // If backend is not running on port 5000, fall back to local handlers
    next();
  }
});

// Anti-Cheat Device Ban Interceptor Middleware
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Allow health check and checking ban status
  if (req.path === '/health' || req.path === '/anticheat/check' || req.path === '/anticheat/ban') {
    return next();
  }

  const deviceId = (req.headers['x-device-id'] as string) || req.body?.deviceId || (req.query.deviceId as string);
  if (deviceId) {
    const ban = isDeviceBanned(deviceId);
    if (ban) {
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
        deviceId: ban.deviceId,
      });
      return;
    }
  }

  next();
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'COCO Game Server' });
});

// Check if current device is banned
app.get('/api/anticheat/check', (req: Request, res: Response) => {
  const deviceId = (req.query.deviceId as string) || (req.headers['x-device-id'] as string);
  if (!deviceId) {
    res.json({ banned: false });
    return;
  }
  const ban = isDeviceBanned(deviceId);
  if (ban) {
    res.json({
      banned: true,
      reason: ban.reason,
      bannedAt: ban.bannedAt,
      deviceId: ban.deviceId,
    });
  } else {
    res.json({ banned: false });
  }
});

// Report and ban device endpoint (invoked when client detects synthetic click or DOM hack)
app.post('/api/anticheat/ban', (req: Request, res: Response) => {
  const deviceId = req.body.deviceId;
  const reason = req.body.reason || 'Anti-Cheat violation detected';
  const studentId = req.body.studentId;
  const userAgent = req.body.userAgent || req.headers['user-agent'];

  if (!deviceId) {
    res.status(400).json({ error: 'Device ID required' });
    return;
  }

  banDevice(deviceId, reason, studentId, req.ip, userAgent);

  res.json({
    success: true,
    banned: true,
    deviceId: deviceId.trim().toUpperCase(),
    reason,
  });
});

// Start a verified game session (Anti-Cheat session hand-shake)
app.post('/api/game/start', (req: Request, res: Response) => {
  const studentId = normalizeId(req.body.studentId);
  const deviceId = String(req.body.deviceId || '').trim().toUpperCase();

  if (!studentId || studentId.length < 2) {
    res.status(400).json({ error: 'Valid Student ID is required' });
    return;
  }
  if (!deviceId) {
    res.status(400).json({ error: 'Valid Device ID is required' });
    return;
  }

  const ban = isDeviceBanned(deviceId);
  if (ban) {
    res.status(403).json({
      error: 'DEVICE_BANNED',
      banned: true,
      reason: ban.reason,
      bannedAt: ban.bannedAt,
    });
    return;
  }

  const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const now = Date.now();

  activeSessions.set(sessionId, {
    sessionId,
    studentId,
    deviceId,
    token,
    startedAt: now,
  });

  res.json({
    success: true,
    sessionId,
    token,
    startedAt: now,
  });
});

// Get or initialize player profile
app.get('/api/player/:studentId', (req: Request, res: Response) => {
  const studentId = normalizeId(req.params.studentId);
  if (!studentId || studentId.length < 2) {
    res.status(400).json({ error: 'Valid Student ID / Roll Number is required' });
    return;
  }

  const db = getDatabase();
  const player = db.players[studentId];

  if (!player || player.disqualified) {
    res.json({
      exists: false,
      studentId,
      highScore: 0,
      highestScoreDate: null,
      totalGames: 0,
      rank: null,
      level: 1,
    });
    return;
  }

  const leaderboard = getSortedLeaderboard(db.players);
  const entry = leaderboard.find((item) => item.studentId === studentId);

  res.json({
    exists: true,
    studentId: player.studentId,
    highScore: player.highScore,
    highestScoreDate: player.highestScoreDate,
    totalGames: player.totalGames,
    rank: entry ? entry.rank : null,
    level: player.level || calculateLevel(player.highScore),
  });
});

// Register or verify player
app.post('/api/player/register', (req: Request, res: Response) => {
  const studentId = normalizeId(req.body.studentId);
  if (!studentId || studentId.length < 2) {
    res.status(400).json({ error: 'Valid Student ID / Roll Number is required (min 2 chars)' });
    return;
  }

  const db = getDatabase();
  let player = db.players[studentId];
  const now = new Date().toISOString();

  if (!player) {
    player = {
      studentId,
      highScore: 0,
      highestScoreDate: now,
      totalGames: 0,
      lastScore: 0,
      lastPlayedAt: now,
      level: 1,
    };
    db.players[studentId] = player;
    saveDatabase(db);
  }

  const leaderboard = getSortedLeaderboard(db.players);
  const entry = leaderboard.find((item) => item.studentId === studentId);

  res.json({
    success: true,
    studentId: player.studentId,
    highScore: player.highScore,
    highestScoreDate: player.highestScoreDate,
    totalGames: player.totalGames,
    rank: entry ? entry.rank : null,
    level: player.level || calculateLevel(player.highScore),
  });
});

// Submit a game score with rigorous anti-cheat verification
app.post('/api/score', (req: Request, res: Response) => {
  const studentId = normalizeId(req.body.studentId);
  const score = Math.max(0, Math.floor(Number(req.body.score) || 0));
  const currentLevel = Math.max(1, Math.floor(Number(req.body.level) || calculateLevel(score)));
  const deviceId = String(req.body.deviceId || '').trim().toUpperCase();
  const sessionId = req.body.sessionId;
  const token = req.body.token;

  if (!studentId || studentId.length < 2) {
    res.status(400).json({ error: 'Valid Student ID / Roll Number is required' });
    return;
  }

  // 1. Device ban check
  if (deviceId) {
    const ban = isDeviceBanned(deviceId);
    if (ban) {
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: ban.reason,
      });
      return;
    }
  }

  // 2. Anti-Cheat Session Check: scores > 3 require an active valid session
  if (score > 3) {
    if (!sessionId || !token) {
      // Direct API forgery attempted via curl/fetch/console
      if (deviceId) {
        banDevice(deviceId, 'Direct forged score submission without active game session', studentId, req.ip);
      }
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: 'Direct forged score submission without active game session',
      });
      return;
    }

    const session = activeSessions.get(sessionId);
    if (!session || session.token !== token || session.studentId !== studentId) {
      if (deviceId) {
        banDevice(deviceId, 'Forged or replayed session token detected', studentId, req.ip);
      }
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: 'Forged or replayed session token detected',
      });
      return;
    }

    // 3. Score Cap Check (Human limit: 500 max)
    if (score > 500) {
      banDevice(
        deviceId || session.deviceId,
        `Score ${score} exceeds human limit of 500 (Cheat / Script injection)`,
        studentId,
        req.ip
      );
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: `Score of ${score} exceeds maximum human limit of 500. Device permanently banned.`,
      });
      return;
    }

    // 4. Timing integrity & speedrun bot check:
    const elapsedSeconds = (Date.now() - session.startedAt) / 1000;

    // A. Reaching 400-500 in less than 3 minutes (180s) -> BAN!
    if (score >= 400 && elapsedSeconds < 180) {
      banDevice(
        deviceId || session.deviceId,
        `Superhuman bot speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (under 3 min for 400+ score is impossible)`,
        studentId,
        req.ip
      );
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (under 3 minutes is prohibited). Device permanently banned.`,
      });
      return;
    }

    // B. Reaching 250-399 in less than 2 minutes (120s) -> BAN!
    if (score >= 250 && elapsedSeconds < 120) {
      banDevice(
        deviceId || session.deviceId,
        `Superhuman bot speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (under 2 min for 250+ score is impossible)`,
        studentId,
        req.ip
      );
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (under 2 minutes is prohibited). Device permanently banned.`,
      });
      return;
    }

    // C. Reaching 120-249 in less than 1 minute (60s) -> BAN!
    if (score >= 120 && elapsedSeconds < 60) {
      banDevice(
        deviceId || session.deviceId,
        `Superhuman bot speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (under 1 min for 120+ score is impossible)`,
        studentId,
        req.ip
      );
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (under 1 minute is prohibited). Device permanently banned.`,
      });
      return;
    }

    // D. General 350ms cognitive reaction speed limit per question
    const minimumFeasibleSeconds = score * 0.35;
    if (score >= 5 && elapsedSeconds < minimumFeasibleSeconds) {
      banDevice(
        deviceId || session.deviceId,
        `Superhuman automated reaction speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (minimum required ${minimumFeasibleSeconds.toFixed(1)}s)`,
        studentId,
        req.ip
      );
      res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: 'Superhuman automated reaction speed detected (Bot/Auto-clicker)',
      });
      return;
    }

    // Expire session so it can never be re-used
    activeSessions.delete(sessionId);
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  let player = db.players[studentId];
  let isNewHighScore = false;
  let previousHighScore = 0;

  if (!player) {
    isNewHighScore = score > 0;
    player = {
      studentId,
      highScore: score,
      highestScoreDate: now,
      totalGames: 1,
      lastScore: score,
      lastPlayedAt: now,
      level: currentLevel,
    };
    db.players[studentId] = player;
  } else {
    previousHighScore = player.highScore;
    player.totalGames = (player.totalGames || 0) + 1;
    player.lastScore = score;
    player.lastPlayedAt = now;

    if (score > player.highScore) {
      isNewHighScore = true;
      player.highScore = score;
      player.highestScoreDate = now;
      player.level = Math.max(player.level || 1, currentLevel, calculateLevel(score));
    }
  }

  saveDatabase(db);

  const leaderboard = getSortedLeaderboard(db.players);
  const entry = leaderboard.find((item) => item.studentId === studentId);

  res.json({
    success: true,
    studentId: player.studentId,
    currentScore: score,
    highScore: player.highScore,
    previousHighScore,
    isNewHighScore,
    highestScoreDate: player.highestScoreDate,
    rank: entry ? entry.rank : null,
    totalPlayers: leaderboard.length,
    level: currentLevel,
    highestLevel: player.level || calculateLevel(player.highScore),
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req: Request, res: Response) => {
  const currentStudentId = req.query.studentId ? normalizeId(String(req.query.studentId)) : '';
  const db = getDatabase();
  const fullLeaderboard = getSortedLeaderboard(db.players);

  // Top 10 players
  const top10 = fullLeaderboard.slice(0, 10);

  // Check current player position
  let currentPlayerInfo = null;
  if (currentStudentId) {
    const found = fullLeaderboard.find((p) => p.studentId === currentStudentId);
    if (found) {
      currentPlayerInfo = found;
    } else if (db.players[currentStudentId] && !db.players[currentStudentId].disqualified) {
      const p = db.players[currentStudentId];
      currentPlayerInfo = {
        rank: fullLeaderboard.length + 1,
        studentId: currentStudentId,
        highScore: p.highScore || 0,
        highestScoreDate: p.highestScoreDate || '',
        totalGames: p.totalGames || 0,
        level: p.level || 1,
      };
    }
  }

  res.json({
    leaderboard: top10,
    totalPlayers: fullLeaderboard.length,
    currentPlayer: currentPlayerInfo,
  });
});

// Sync local client scores to server with anti-cheat checks
app.post('/api/sync', (req: Request, res: Response) => {
  const incomingPlayers = req.body.players;
  const deviceId = (req.body.deviceId as string) || (req.headers['x-device-id'] as string);

  if (deviceId && isDeviceBanned(deviceId)) {
    res.status(403).json({ error: 'DEVICE_BANNED', banned: true });
    return;
  }

  if (!incomingPlayers || typeof incomingPlayers !== 'object') {
    res.status(400).json({ error: 'Invalid players payload' });
    return;
  }

  const db = getDatabase();
  let changed = false;

  for (const [id, incoming] of Object.entries(incomingPlayers as Record<string, any>)) {
    const studentId = normalizeId(id);
    if (!studentId || studentId.length < 2) continue;

    const incHigh = Math.max(0, Math.floor(Number(incoming?.highScore) || 0));
    // Reject absurd cheated scores in sync
    if (incHigh > 300) continue;

    const incDate = incoming?.highestScoreDate || new Date().toISOString();
    const incGames = Math.max(0, Math.floor(Number(incoming?.totalGames) || 0));
    const incLevel = Math.max(1, Math.floor(Number(incoming?.level) || calculateLevel(incHigh)));

    if (!db.players[studentId]) {
      db.players[studentId] = {
        studentId,
        highScore: incHigh,
        highestScoreDate: incDate,
        totalGames: incGames || 1,
        lastScore: incHigh,
        lastPlayedAt: incDate,
        level: incLevel,
      };
      changed = true;
    } else {
      const existing = db.players[studentId];
      if (!existing.disqualified) {
        if (incHigh > existing.highScore) {
          existing.highScore = incHigh;
          existing.highestScoreDate = incDate;
          existing.level = Math.max(existing.level || 1, incLevel);
          changed = true;
        }
        if (incGames > existing.totalGames) {
          existing.totalGames = incGames;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    saveDatabase(db);
  }

  const fullLeaderboard = getSortedLeaderboard(db.players);
  res.json({
    success: true,
    totalPlayers: fullLeaderboard.length,
    leaderboard: fullLeaderboard.slice(0, 10),
  });
});

// Vite or static production middleware
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const indexHtml = path.join(distPath, 'index.html');
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(indexHtml);

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtml);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`COCO Server with Anti-Cheat listening on port ${PORT}`);
  });
}

startServer();
