import { Player } from '../models/Player.js';
import { calculateLevel, normalizeId } from '../utils/levels.js';

// Calculate rank for a single player efficiently
async function getPlayerRank(highScore, highestScoreDate) {
  if (!highScore || highScore <= 0) return null;
  const countHigher = await Player.countDocuments({
    disqualified: false,
    highScore: { $lte: 500 },
    $or: [
      { highScore: { $gt: highScore } },
      { highScore: highScore, highestScoreDate: { $lt: highestScoreDate } },
    ],
  });
  return countHigher + 1;
}

export async function getPlayerProfile(req, res) {
  try {
    const studentId = normalizeId(req.params.studentId);
    if (!studentId || studentId.length < 2) {
      return res.status(400).json({ error: 'Valid Student ID / Roll Number is required' });
    }

    const player = await Player.findOne({ studentId }).lean();

    if (!player || player.disqualified) {
      return res.json({
        exists: false,
        studentId,
        highScore: 0,
        highestScoreDate: null,
        totalGames: 0,
        rank: null,
        level: 1,
      });
    }

    const rank = await getPlayerRank(player.highScore, player.highestScoreDate);

    res.json({
      exists: true,
      studentId: player.studentId,
      highScore: player.highScore,
      highestScoreDate: player.highestScoreDate ? new Date(player.highestScoreDate).toISOString() : null,
      totalGames: player.totalGames,
      rank,
      level: player.level || calculateLevel(player.highScore),
    });
  } catch (error) {
    console.error('[Get Player Error]', error);
    res.status(500).json({ error: 'Failed to fetch player profile' });
  }
}

export async function registerPlayer(req, res) {
  try {
    const studentId = normalizeId(req.body.studentId);
    if (!studentId || studentId.length < 2) {
      return res.status(400).json({ error: 'Valid Student ID / Roll Number is required (min 2 chars)' });
    }

    const now = new Date();
    let player = await Player.findOne({ studentId });

    if (!player) {
      player = await Player.create({
        studentId,
        highScore: 0,
        highestScoreDate: now,
        totalGames: 0,
        lastScore: 0,
        lastPlayedAt: now,
        level: 1,
      });
    }

    const rank = await getPlayerRank(player.highScore, player.highestScoreDate);

    res.json({
      success: true,
      studentId: player.studentId,
      highScore: player.highScore,
      highestScoreDate: player.highestScoreDate ? player.highestScoreDate.toISOString() : now.toISOString(),
      totalGames: player.totalGames,
      rank,
      level: player.level || calculateLevel(player.highScore),
    });
  } catch (error) {
    console.error('[Register Player Error]', error);
    res.status(500).json({ error: 'Failed to register player' });
  }
}
