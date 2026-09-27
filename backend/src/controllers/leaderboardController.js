import { Player } from '../models/Player.js';
import { calculateLevel, normalizeId } from '../utils/levels.js';

export async function getLeaderboard(req, res) {
  try {
    const currentStudentId = req.query.studentId ? normalizeId(req.query.studentId) : '';

    // Fetch all active qualified players capped at 500
    const qualifiedPlayers = await Player.find({
      disqualified: false,
      highScore: { $lte: 500 },
      $or: [{ highScore: { $gt: 0 } }, { totalGames: { $gt: 0 } }],
    })
      .sort({ highScore: -1, highestScoreDate: 1 })
      .lean();

    const fullLeaderboard = qualifiedPlayers.map((item, index) => ({
      rank: index + 1,
      studentId: item.studentId,
      highScore: Math.min(500, item.highScore),
      highestScoreDate: item.highestScoreDate ? new Date(item.highestScoreDate).toISOString() : new Date().toISOString(),
      totalGames: item.totalGames || 0,
      level: item.level || calculateLevel(item.highScore),
    }));

    const top10 = fullLeaderboard.slice(0, 10);

    let currentPlayerInfo = null;
    if (currentStudentId) {
      const found = fullLeaderboard.find((p) => p.studentId === currentStudentId);
      if (found) {
        currentPlayerInfo = found;
      } else {
        const player = await Player.findOne({ studentId: currentStudentId, disqualified: false }).lean();
        if (player) {
          currentPlayerInfo = {
            rank: fullLeaderboard.length + 1,
            studentId: currentStudentId,
            highScore: player.highScore || 0,
            highestScoreDate: player.highestScoreDate ? new Date(player.highestScoreDate).toISOString() : '',
            totalGames: player.totalGames || 0,
            level: player.level || 1,
          };
        }
      }
    }

    res.json({
      leaderboard: top10,
      totalPlayers: fullLeaderboard.length,
      currentPlayer: currentPlayerInfo,
    });
  } catch (error) {
    console.error('[Leaderboard Error]', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
