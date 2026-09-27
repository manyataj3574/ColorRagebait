import { LeaderboardEntry, PlayerProfile, SubmitScoreResponse, BanInfo, RoundTelemetry } from '../types';
import { getLevelForScore } from './levels';
import { getDeviceId, isDeviceBannedLocally, markDeviceBannedLocally } from './anticheat';

const STORAGE_KEY_STUDENT_ID = 'coco_student_id';
const STORAGE_KEY_PLAYERS = 'coco_permanent_scores_v3';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Current active round verification token
let currentSession: { sessionId: string; token: string; studentId: string } | null = null;

export interface StoredPlayer {
  studentId: string;
  highScore: number;
  highestScoreDate: string;
  totalGames: number;
  level: number;
}

export function getSavedStudentId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_STUDENT_ID) || '';
  } catch {
    return '';
  }
}

export function saveStudentIdLocally(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY_STUDENT_ID, id.trim().toUpperCase());
  } catch {
    // Ignore
  }
}

// Start an anti-cheat verified game session with the server
export async function startVerifiedGameSession(studentId: string): Promise<boolean> {
  const normId = studentId.trim().toUpperCase();
  const deviceId = getDeviceId();

  try {
    const res = await fetch(`${API_BASE}/api/game/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({ studentId: normId, deviceId }),
    });

    if (res.ok) {
      const data = await res.json();
      currentSession = {
        sessionId: data.sessionId,
        token: data.token,
        studentId: normId,
      };
      return true;
    } else if (res.status === 403) {
      const err = await res.json();
      if (err.banned) {
        markDeviceBannedLocally(err.reason || 'Device banned by Anti-Cheat system');
      }
    }
  } catch (err) {
    console.warn('Game session start offline fallback:', err);
  }

  // Fallback offline session
  currentSession = {
    sessionId: `OFFLINE-${Date.now()}`,
    token: `OFFLINE-TOKEN-${Date.now()}`,
    studentId: normId,
  };
  return true;
}

// Check if device is banned (both locally & on server)
export async function checkDeviceBanStatus(): Promise<BanInfo> {
  const local = isDeviceBannedLocally();
  const deviceId = getDeviceId();

  if (local.banned) {
    return {
      isBanned: true,
      reason: local.reason,
      bannedAt: local.bannedAt,
      deviceId,
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/anticheat/check?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: { 'x-device-id': deviceId },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.banned) {
        markDeviceBannedLocally(data.reason || 'Anti-Cheat violation');
        return {
          isBanned: true,
          reason: data.reason,
          bannedAt: data.bannedAt,
          deviceId,
        };
      }
    }
  } catch {
    // Ignore network error
  }

  return { isBanned: false, deviceId };
}

// Read local registry of all known players (permanent localStorage)
export function getLocalPlayersRegistry(): Record<string, StoredPlayer> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAYERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
    const oldRaw = localStorage.getItem('coco_players_registry_v2');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      if (typeof oldParsed === 'object' && oldParsed !== null) {
        const migrated: Record<string, StoredPlayer> = {};
        for (const [k, v] of Object.entries(oldParsed as Record<string, any>)) {
          migrated[k] = {
            studentId: v.studentId,
            highScore: v.highScore || 0,
            highestScoreDate: v.highestScoreDate || new Date().toISOString(),
            totalGames: v.totalGames || 1,
            level: v.level || getLevelForScore(v.highScore || 0).level,
          };
        }
        localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(migrated));
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

// Save local registry permanently
export function saveLocalPlayersRegistry(registry: Record<string, StoredPlayer>) {
  try {
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(registry));
  } catch {
    // Ignore
  }
}

// Compute sorted leaderboard directly from local registry (Human cap: 500 max)
export function getLocalLeaderboard(studentId?: string): LeaderboardResult {
  const registry = getLocalPlayersRegistry();
  const normCurrentId = studentId ? studentId.trim().toUpperCase() : '';

  const list = Object.values(registry).filter((p) => p.highScore <= 500 && (p.totalGames > 0 || p.highScore > 0));
  list.sort((a, b) => {
    if (b.highScore !== a.highScore) {
      return b.highScore - a.highScore;
    }
    const dateA = new Date(a.highestScoreDate || 0).getTime();
    const dateB = new Date(b.highestScoreDate || 0).getTime();
    return dateA - dateB;
  });

  const fullList: LeaderboardEntry[] = list.map((item, index) => ({
    rank: index + 1,
    studentId: item.studentId,
    highScore: Math.min(500, item.highScore),
    highestScoreDate: item.highestScoreDate,
    totalGames: item.totalGames,
    level: item.level || getLevelForScore(item.highScore).level,
  }));

  const top10 = fullList.slice(0, 10);
  let currentPlayerInfo: LeaderboardEntry | null = null;

  if (normCurrentId) {
    const found = fullList.find((p) => p.studentId === normCurrentId);
    if (found) {
      currentPlayerInfo = found;
    } else if (registry[normCurrentId]) {
      const p = registry[normCurrentId];
      currentPlayerInfo = {
        rank: fullList.length + 1,
        studentId: normCurrentId,
        highScore: p.highScore || 0,
        highestScoreDate: p.highestScoreDate || '',
        totalGames: p.totalGames || 0,
        level: p.level || 1,
      };
    }
  }

  return {
    leaderboard: top10,
    totalPlayers: fullList.length,
    currentPlayer: currentPlayerInfo,
  };
}

export async function fetchPlayer(studentId: string): Promise<PlayerProfile> {
  const normId = studentId.trim().toUpperCase();
  const registry = getLocalPlayersRegistry();
  const localRecord = registry[normId];
  const deviceId = getDeviceId();

  try {
    const res = await fetch(`${API_BASE}/api/player/${encodeURIComponent(normId)}`, {
      headers: { 'x-device-id': deviceId },
    });
    if (res.ok) {
      const data = await res.json();
      const serverHigh = Number(data.highScore) || 0;
      const localHigh = localRecord ? localRecord.highScore : 0;
      const bestHigh = Math.max(serverHigh, localHigh);
      const bestGames = Math.max(Number(data.totalGames) || 0, localRecord ? localRecord.totalGames : 0);
      const bestLevel = Math.max(Number(data.level) || 1, localRecord ? localRecord.level : 1, getLevelForScore(bestHigh).level);

      registry[normId] = {
        studentId: normId,
        highScore: bestHigh,
        highestScoreDate: data.highestScoreDate || localRecord?.highestScoreDate || new Date().toISOString(),
        totalGames: bestGames,
        level: bestLevel,
      };
      saveLocalPlayersRegistry(registry);

      if (localHigh > serverHigh) {
        syncPlayersToServer(registry).catch(() => {});
      }

      return {
        studentId: normId,
        highScore: bestHigh,
        highestScoreDate: data.highestScoreDate || localRecord?.highestScoreDate || null,
        totalGames: bestGames,
        rank: data.rank !== undefined ? data.rank : null,
        highestLevel: bestLevel,
      };
    } else if (res.status === 403) {
      const err = await res.json();
      if (err.banned) {
        markDeviceBannedLocally(err.reason || 'Device banned');
      }
    }
  } catch (err) {
    console.warn('Network error fetching player profile, using local registry:', err);
  }

  const level = localRecord ? localRecord.level : 1;
  return {
    studentId: normId,
    highScore: localRecord ? localRecord.highScore : 0,
    highestScoreDate: localRecord ? localRecord.highestScoreDate : null,
    totalGames: localRecord ? localRecord.totalGames : 0,
    rank: null,
    highestLevel: level,
  };
}

export async function submitScore(
  studentId: string,
  score: number,
  levelReached: number = 1,
  telemetry: RoundTelemetry[] = []
): Promise<SubmitScoreResponse> {
  const normId = studentId.trim().toUpperCase();
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  // 1. Immediately record in permanent local storage
  const registry = getLocalPlayersRegistry();
  const existing = registry[normId];
  const previousHighScore = existing ? existing.highScore : 0;
  const isNewHighScore = score > previousHighScore;
  const newHighScore = Math.max(previousHighScore, score);
  const totalGames = (existing ? existing.totalGames : 0) + 1;
  const calculatedLvl = getLevelForScore(newHighScore).level;
  const highestLevel = Math.max(existing?.level || 1, levelReached, calculatedLvl);

  registry[normId] = {
    studentId: normId,
    highScore: newHighScore,
    highestScoreDate: isNewHighScore ? now : (existing?.highestScoreDate || now),
    totalGames,
    level: highestLevel,
  };
  saveLocalPlayersRegistry(registry);

  const localBoard = getLocalLeaderboard(normId);

  // 2. Submit to server with Anti-Cheat session token, deviceId, and telemetry
  try {
    const payload = {
      studentId: normId,
      score,
      level: levelReached,
      deviceId,
      sessionId: currentSession?.sessionId,
      token: currentSession?.token,
      telemetry,
    };

    const res = await fetch(`${API_BASE}/api/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data: SubmitScoreResponse = await res.json();
      if (data.highScore >= newHighScore) {
        registry[normId].highScore = data.highScore;
        registry[normId].highestScoreDate = data.highestScoreDate || now;
        registry[normId].level = Math.max(highestLevel, data.highestLevel || 1);
        saveLocalPlayersRegistry(registry);
      }
      return {
        ...data,
        level: levelReached,
        highestLevel: registry[normId].level,
      };
    } else if (res.status === 403) {
      const err = await res.json();
      if (err.banned) {
        markDeviceBannedLocally(err.reason || 'Anti-Cheat violation');
        throw new Error(`DEVICE_BANNED: ${err.reason}`);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('DEVICE_BANNED')) {
      throw err;
    }
    console.warn('Failed to submit score to server, saved locally:', err);
  }

  return {
    success: true,
    studentId: normId,
    currentScore: score,
    highScore: newHighScore,
    previousHighScore,
    isNewHighScore,
    highestScoreDate: registry[normId].highestScoreDate,
    rank: localBoard.currentPlayer ? localBoard.currentPlayer.rank : 1,
    totalPlayers: localBoard.totalPlayers,
    level: levelReached,
    highestLevel,
  };
}

export interface LeaderboardResult {
  leaderboard: LeaderboardEntry[];
  totalPlayers: number;
  currentPlayer: LeaderboardEntry | null;
}

export async function fetchLeaderboard(studentId?: string): Promise<LeaderboardResult> {
  const normId = studentId ? studentId.trim().toUpperCase() : '';
  const localResult = getLocalLeaderboard(normId);
  const registry = getLocalPlayersRegistry();
  const deviceId = getDeviceId();

  try {
    const url = normId
      ? `${API_BASE}/api/leaderboard?studentId=${encodeURIComponent(normId)}`
      : `${API_BASE}/api/leaderboard`;
    const res = await fetch(url, {
      headers: { 'x-device-id': deviceId },
    });

    if (res.ok) {
      const serverData: LeaderboardResult = await res.json();

      if (Array.isArray(serverData.leaderboard)) {
        // Build updated registry from authoritative server data
        const updatedRegistry: Record<string, StoredPlayer> = {};

        // Keep current player profile if present locally
        if (normId && registry[normId]) {
          updatedRegistry[normId] = registry[normId];
        }

        for (const entry of serverData.leaderboard) {
          const id = entry.studentId.toUpperCase();
          updatedRegistry[id] = {
            studentId: id,
            highScore: entry.highScore,
            highestScoreDate: entry.highestScoreDate,
            totalGames: entry.totalGames || registry[id]?.totalGames || 1,
            level: entry.level || getLevelForScore(entry.highScore).level,
          };
        }

        saveLocalPlayersRegistry(updatedRegistry);

        // Only sync if current user's local score is higher than server record
        if (normId && registry[normId]) {
          const serverCurrent = serverData.leaderboard.find((p) => p.studentId === normId);
          if (!serverCurrent || registry[normId].highScore > serverCurrent.highScore) {
            syncPlayersToServer({ [normId]: registry[normId] }).catch(() => {});
          }
        }
      }

      return serverData;
    }
  } catch (err) {
    console.warn('Network error loading server leaderboard, returning local persistent records:', err);
  }

  return localResult;
}

// Background sync to server
export async function syncPlayersToServer(registry: Record<string, StoredPlayer>) {
  const deviceId = getDeviceId();
  try {
    await fetch(`${API_BASE}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({ players: registry, deviceId }),
    });
  } catch {
    // Ignore sync error in background
  }
}

// Automatic bootstrap sync on client initialization (only syncs current student)
export function initializeSync() {
  const currentId = getSavedStudentId();
  if (!currentId) return;
  const registry = getLocalPlayersRegistry();
  const current = registry[currentId];
  if (current && current.highScore > 0) {
    syncPlayersToServer({ [currentId]: current }).catch(() => {});
  }
}

