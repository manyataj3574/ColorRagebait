import { Player } from '../models/Player.js';
import { GameSession } from '../models/GameSession.js';
import { banDevice, isDeviceBanned } from '../middleware/antiCheat.js';
import { calculateLevel, normalizeId } from '../utils/levels.js';

export async function startGameSession(req, res) {
  try {
    const studentId = normalizeId(req.body.studentId);
    const deviceId = String(req.body.deviceId || '').trim().toUpperCase();

    if (!studentId || studentId.length < 2) {
      return res.status(400).json({ error: 'Valid Student ID is required' });
    }
    if (!deviceId) {
      return res.status(400).json({ error: 'Valid Device ID is required' });
    }

    const ban = await isDeviceBanned(deviceId);
    if (ban) {
      return res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
      });
    }

    const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const now = Date.now();

    await GameSession.create({
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
  } catch (error) {
    console.error('[Start Session Error]', error);
    res.status(500).json({ error: 'Failed to start game session' });
  }
}

export async function submitScore(req, res) {
  try {
    const studentId = normalizeId(req.body.studentId);
    const score = Math.max(0, Math.floor(Number(req.body.score) || 0));
    const currentLevel = Math.max(1, Math.floor(Number(req.body.level) || calculateLevel(score)));
    const deviceId = String(req.body.deviceId || '').trim().toUpperCase();
    const sessionId = req.body.sessionId;
    const token = req.body.token;

    if (!studentId || studentId.length < 2) {
      return res.status(400).json({ error: 'Valid Student ID / Roll Number is required' });
    }

    // 1. Device ban check
    if (deviceId) {
      const ban = await isDeviceBanned(deviceId);
      if (ban) {
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: ban.reason,
        });
      }
    }

    // 2. Anti-Cheat Session Check: scores > 3 require an active valid session
    if (score > 3) {
      if (!sessionId || !token) {
        if (deviceId) {
          await banDevice(deviceId, 'Direct forged score submission without active game session', studentId, req.ip);
        }
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: 'Direct forged score submission without active game session',
        });
      }

      const session = await GameSession.findOne({ sessionId });
      if (!session || session.token !== token || session.studentId !== studentId) {
        if (deviceId) {
          await banDevice(deviceId, 'Forged or replayed session token detected', studentId, req.ip);
        }
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: 'Forged or replayed session token detected',
        });
      }

      // 3. Human limit check (max 500)
      if (score > 500) {
        await banDevice(
          deviceId || session.deviceId,
          `Score ${score} exceeds human limit of 500 (Cheat / Script injection)`,
          studentId,
          req.ip
        );
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: `Score of ${score} exceeds maximum human limit of 500. Device permanently banned.`,
        });
      }

      // 4. Timing integrity checks
      const elapsedSeconds = (Date.now() - session.startedAt) / 1000;

      // 4A. Reaching 400-500 in less than 3 minutes (180s)
      if (score >= 400 && elapsedSeconds < 180) {
        await banDevice(
          deviceId || session.deviceId,
          `Superhuman bot speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (under 3 min for 400+ score is impossible)`,
          studentId,
          req.ip
        );
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (under 3 minutes is prohibited). Device permanently banned.`,
        });
      }

      // 4B. Reaching 250-399 in less than 2 minutes (120s)
      if (score >= 250 && elapsedSeconds < 120) {
        await banDevice(
          deviceId || session.deviceId,
          `Superhuman bot speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (under 2 min for 250+ score is impossible)`,
          studentId,
          req.ip
        );
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (under 2 minutes is prohibited). Device permanently banned.`,
        });
      }

      // 4C. Reaching 120-249 in less than 1 minute (60s)
      if (score >= 120 && elapsedSeconds < 60) {
        await banDevice(
          deviceId || session.deviceId,
          `Superhuman bot speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (under 1 min for 120+ score is impossible)`,
          studentId,
          req.ip
        );
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (under 1 minute is prohibited). Device permanently banned.`,
        });
      }

      // 4D. General reaction limit: 350ms per question
      const minimumFeasibleSeconds = score * 0.35;
      if (score >= 5 && elapsedSeconds < minimumFeasibleSeconds) {
        await banDevice(
          deviceId || session.deviceId,
          `Superhuman automated reaction speed: scored ${score} in ${elapsedSeconds.toFixed(1)}s (minimum required ${minimumFeasibleSeconds.toFixed(1)}s)`,
          studentId,
          req.ip
        );
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: 'Superhuman automated reaction speed detected (Bot/Auto-clicker)',
        });
      }

      // Expire session
      await GameSession.deleteOne({ sessionId });
    }

    const now = new Date();
    let player = await Player.findOne({ studentId });
    let isNewHighScore = false;
    let previousHighScore = 0;

    if (!player) {
      isNewHighScore = score > 0;
      player = await Player.create({
        studentId,
        highScore: score,
        highestScoreDate: now,
        totalGames: 1,
        lastScore: score,
        lastPlayedAt: now,
        level: currentLevel,
      });
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
      await player.save();
    }

    // Rank in leaderboard
    const totalHigher = await Player.countDocuments({
      disqualified: false,
      highScore: { $lte: 500 },
      $or: [
        { highScore: { $gt: player.highScore } },
        { highScore: player.highScore, highestScoreDate: { $lt: player.highestScoreDate } },
      ],
    });

    const totalPlayers = await Player.countDocuments({
      disqualified: false,
      highScore: { $lte: 500 },
      $or: [{ highScore: { $gt: 0 } }, { totalGames: { $gt: 0 } }],
    });

    res.json({
      success: true,
      studentId: player.studentId,
      currentScore: score,
      highScore: player.highScore,
      previousHighScore,
      isNewHighScore,
      highestScoreDate: player.highestScoreDate ? player.highestScoreDate.toISOString() : now.toISOString(),
      rank: totalHigher + 1,
      totalPlayers,
      level: currentLevel,
      highestLevel: player.level || calculateLevel(player.highScore),
    });
  } catch (error) {
    console.error('[Submit Score Error]', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
}

export async function syncPlayers(req, res) {
  try {
    const incomingPlayers = req.body.players;
    const deviceId = req.body.deviceId || req.headers['x-device-id'];

    if (deviceId && (await isDeviceBanned(deviceId))) {
      return res.status(403).json({ error: 'DEVICE_BANNED', banned: true });
    }

    if (!incomingPlayers || typeof incomingPlayers !== 'object') {
      return res.status(400).json({ error: 'Invalid players payload' });
    }

    for (const [id, incoming] of Object.entries(incomingPlayers)) {
      const studentId = normalizeId(id);
      if (!studentId || studentId.length < 2) continue;

      const incHigh = Math.max(0, Math.floor(Number(incoming?.highScore) || 0));
      // Reject absurd cheated scores in sync
      if (incHigh > 300) continue;

      const incDate = incoming?.highestScoreDate ? new Date(incoming.highestScoreDate) : new Date();
      const incGames = Math.max(0, Math.floor(Number(incoming?.totalGames) || 0));
      const incLevel = Math.max(1, Math.floor(Number(incoming?.level) || calculateLevel(incHigh)));

      const existing = await Player.findOne({ studentId });
      if (!existing) {
        await Player.create({
          studentId,
          highScore: incHigh,
          highestScoreDate: incDate,
          totalGames: incGames || 1,
          lastScore: incHigh,
          lastPlayedAt: incDate,
          level: incLevel,
        });
      } else if (!existing.disqualified) {
        let changed = false;
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
        if (changed) {
          await existing.save();
        }
      }
    }

    const qualifiedPlayers = await Player.find({
      disqualified: false,
      highScore: { $lte: 500 },
      $or: [{ highScore: { $gt: 0 } }, { totalGames: { $gt: 0 } }],
    })
      .sort({ highScore: -1, highestScoreDate: 1 })
      .lean();

    const top10 = qualifiedPlayers.slice(0, 10).map((item, index) => ({
      rank: index + 1,
      studentId: item.studentId,
      highScore: Math.min(500, item.highScore),
      highestScoreDate: item.highestScoreDate ? new Date(item.highestScoreDate).toISOString() : new Date().toISOString(),
      totalGames: item.totalGames || 0,
      level: item.level || calculateLevel(item.highScore),
    }));

    res.json({
      success: true,
      totalPlayers: qualifiedPlayers.length,
      leaderboard: top10,
    });
  } catch (error) {
    console.error('[Sync Error]', error);
    res.status(500).json({ error: 'Failed to sync players' });
  }
}
