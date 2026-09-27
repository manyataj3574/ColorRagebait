import crypto from 'node:crypto';
import { Player } from '../models/Player.js';
import { GameSession } from '../models/GameSession.js';
import { banClient, isDeviceOrIpBanned, getClientIp } from '../middleware/antiCheat.js';
import { calculateLevel, normalizeId } from '../utils/levels.js';

// Calculate variance and standard deviation of reaction times
function calculateTimingStats(telemetry) {
  if (!telemetry || telemetry.length < 5) return { stdDev: 100, avg: 400 };
  const dts = telemetry.map((t) => Number(t.dt) || 0).filter((dt) => dt > 0);
  if (dts.length < 5) return { stdDev: 100, avg: 400 };

  const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
  const variance = dts.reduce((sum, dt) => sum + Math.pow(dt - avg, 2), 0) / dts.length;
  return { stdDev: Math.sqrt(variance), avg };
}

// Check coordinate entropy (detect identical click positions or element.click 0,0)
function checkCoordinateAuthenticity(telemetry) {
  if (!telemetry || telemetry.length < 8) return { authentic: true };

  let zeroCount = 0;
  const uniquePositions = new Set();

  for (const t of telemetry) {
    const x = Math.round(Number(t.x) || 0);
    const y = Math.round(Number(t.y) || 0);

    if (x === 0 && y === 0) {
      zeroCount++;
    }
    uniquePositions.add(`${x},${y}`);
  }

  // If more than 30% of clicks are at 0,0 (synthetic event.click())
  if (zeroCount > 2 && zeroCount / telemetry.length > 0.3) {
    return { authentic: false, reason: 'Synthetic 0,0 click coordinates detected (Automated script injection)' };
  }

  // If someone clicked 20+ times but only at 1 or 2 exact pixel coordinates
  if (telemetry.length >= 15 && uniquePositions.size <= 2) {
    return { authentic: false, reason: 'Static unnatural pixel coordinates (Fixed auto-clicker bot)' };
  }

  return { authentic: true };
}

export async function startGameSession(req, res) {
  try {
    const studentId = normalizeId(req.body.studentId);
    const deviceId = String(req.body.deviceId || '').trim().toUpperCase();
    const clientIp = getClientIp(req);

    if (!studentId || studentId.length < 2) {
      return res.status(400).json({ error: 'Valid Student ID is required' });
    }
    if (!deviceId) {
      return res.status(400).json({ error: 'Valid Device ID is required' });
    }

    const ban = await isDeviceOrIpBanned(deviceId, clientIp);
    if (ban) {
      return res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
        ip: clientIp,
      });
    }

    const sessionId = `SES-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const token = crypto.randomBytes(16).toString('hex');
    const sessionSecret = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    await GameSession.create({
      sessionId,
      studentId,
      deviceId,
      ip: clientIp,
      token,
      sessionSecret,
      startedAt: now,
    });

    res.json({
      success: true,
      sessionId,
      token,
      sessionSecret,
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
    const telemetry = Array.isArray(req.body.telemetry) ? req.body.telemetry : [];
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (!studentId || studentId.length < 2) {
      return res.status(400).json({ error: 'Valid Student ID / Roll Number is required' });
    }

    // 1. IP and Device Ban Check
    const ban = await isDeviceOrIpBanned(deviceId, clientIp);
    if (ban) {
      return res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: ban.reason,
        ip: clientIp,
      });
    }

    // 2. Anti-Cheat Verification for scores > 3
    if (score > 3) {
      if (!sessionId || !token) {
        await banClient({
          deviceId,
          ip: clientIp,
          reason: 'Direct score forgery without active game session handshake',
          studentId,
          userAgent,
          violationType: 'SCORE_MANIPULATION',
        });
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: 'Score submission rejected: No active game session.',
        });
      }

      const session = await GameSession.findOne({ sessionId });
      if (!session || session.token !== token || session.studentId !== studentId) {
        await banClient({
          deviceId: deviceId || session?.deviceId,
          ip: clientIp,
          reason: 'Invalid or forged game session token',
          studentId,
          userAgent,
          violationType: 'FORGED_SESSION',
        });
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: 'Security verification failed: Forged session.',
        });
      }

      // 3. Human limit check (500 max cap)
      if (score > 500) {
        await banClient({
          deviceId: deviceId || session.deviceId,
          ip: clientIp,
          reason: `Score ${score} exceeds physical human limit of 500`,
          studentId,
          userAgent,
          violationType: 'SCORE_MANIPULATION',
        });
        return res.status(403).json({
          error: 'DEVICE_BANNED',
          banned: true,
          reason: 'Score exceeds maximum human limit. Device and IP permanently banned.',
        });
      }

      // 4. Telemetry Round Count Verification
      if (score >= 10) {
        if (telemetry.length < score) {
          await banClient({
            deviceId: deviceId || session.deviceId,
            ip: clientIp,
            reason: `Telemetry mismatch: claimed score ${score} with only ${telemetry.length} round audit proofs`,
            studentId,
            userAgent,
            violationType: 'SCORE_MANIPULATION',
          });
          return res.status(403).json({
            error: 'DEVICE_BANNED',
            banned: true,
            reason: 'Telemetry audit mismatch: Unverified round answers.',
          });
        }

        // 5. Superhuman Reaction Speed check (consecutive < 160ms)
        const sub160Count = telemetry.filter((t) => Number(t.dt) < 160).length;
        if (sub160Count > 2) {
          await banClient({
            deviceId: deviceId || session.deviceId,
            ip: clientIp,
            reason: `Superhuman reaction speed: ${sub160Count} answers below 160ms physical cognition threshold`,
            studentId,
            userAgent,
            violationType: 'SPEEDHACK',
          });
          return res.status(403).json({
            error: 'DEVICE_BANNED',
            banned: true,
            reason: 'Superhuman bot reaction speed detected. Device and IP permanently banned.',
          });
        }

        // 6. Timing Variance Check (detect fixed-interval auto-clickers)
        const { stdDev } = calculateTimingStats(telemetry);
        if (telemetry.length >= 15 && stdDev < 15) {
          await banClient({
            deviceId: deviceId || session.deviceId,
            ip: clientIp,
            reason: `Synthetic bot rhythm detected: click timing standard deviation ${stdDev.toFixed(1)}ms is unnatural (Bot/Auto-Clicker)`,
            studentId,
            userAgent,
            violationType: 'EXTENSION',
          });
          return res.status(403).json({
            error: 'DEVICE_BANNED',
            banned: true,
            reason: 'Automated script rhythm detected. Device and IP banned.',
          });
        }

        // 7. Coordinate Authenticity
        const coordCheck = checkCoordinateAuthenticity(telemetry);
        if (!coordCheck.authentic) {
          await banClient({
            deviceId: deviceId || session.deviceId,
            ip: clientIp,
            reason: coordCheck.reason,
            studentId,
            userAgent,
            violationType: 'SYNTHETIC_CLICK',
          });
          return res.status(403).json({
            error: 'DEVICE_BANNED',
            banned: true,
            reason: coordCheck.reason,
          });
        }
      }

      // 8. Overall Timing integrity check
      const elapsedSeconds = (Date.now() - session.startedAt) / 1000;

      if (score >= 400 && elapsedSeconds < 180) {
        await banClient({
          deviceId: deviceId || session.deviceId,
          ip: clientIp,
          reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (min 180s required)`,
          studentId,
          userAgent,
          violationType: 'SPEEDHACK',
        });
        return res.status(403).json({ error: 'DEVICE_BANNED', banned: true, reason: 'Speedhack detected.' });
      }

      if (score >= 250 && elapsedSeconds < 120) {
        await banClient({
          deviceId: deviceId || session.deviceId,
          ip: clientIp,
          reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (min 120s required)`,
          studentId,
          userAgent,
          violationType: 'SPEEDHACK',
        });
        return res.status(403).json({ error: 'DEVICE_BANNED', banned: true, reason: 'Speedhack detected.' });
      }

      if (score >= 120 && elapsedSeconds < 60) {
        await banClient({
          deviceId: deviceId || session.deviceId,
          ip: clientIp,
          reason: `Impossible speed: score ${score} in ${elapsedSeconds.toFixed(1)}s (min 60s required)`,
          studentId,
          userAgent,
          violationType: 'SPEEDHACK',
        });
        return res.status(403).json({ error: 'DEVICE_BANNED', banned: true, reason: 'Speedhack detected.' });
      }

      const minimumFeasibleSeconds = score * 0.35;
      if (score >= 5 && elapsedSeconds < minimumFeasibleSeconds) {
        await banClient({
          deviceId: deviceId || session.deviceId,
          ip: clientIp,
          reason: `Superhuman reaction rate: scored ${score} in ${elapsedSeconds.toFixed(1)}s (min ${minimumFeasibleSeconds.toFixed(1)}s)`,
          studentId,
          userAgent,
          violationType: 'SPEEDHACK',
        });
        return res.status(403).json({ error: 'DEVICE_BANNED', banned: true, reason: 'Reaction rate exceeded.' });
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

    // Rank calculation
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
    const clientIp = getClientIp(req);

    if (deviceId && (await isDeviceOrIpBanned(deviceId, clientIp))) {
      return res.status(403).json({ error: 'DEVICE_BANNED', banned: true });
    }

    if (!incomingPlayers || typeof incomingPlayers !== 'object') {
      return res.status(400).json({ error: 'Invalid players payload' });
    }

    for (const [id, incoming] of Object.entries(incomingPlayers)) {
      const studentId = normalizeId(id);
      if (!studentId || studentId.length < 2) continue;

      const incHigh = Math.max(0, Math.floor(Number(incoming?.highScore) || 0));
      // Reject absurd cheated scores in sync (max 300)
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
