import express from 'express';
import { antiCheatMiddleware } from '../middleware/antiCheat.js';
import { getLeaderboard } from '../controllers/leaderboardController.js';
import { getPlayerProfile, registerPlayer } from '../controllers/playerController.js';
import { startGameSession, submitScore, syncPlayers } from '../controllers/scoreController.js';
import { checkDeviceStatus, reportAndBanDevice, adminManageBan } from '../controllers/antiCheatController.js';

const router = express.Router();

// Apply anti-cheat device and IP ban middleware
router.use(antiCheatMiddleware);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'COCO Game MongoDB Backend', timestamp: new Date() });
});

// Anti-Cheat Endpoints
router.get('/anticheat/check', checkDeviceStatus);
router.post('/anticheat/ban', reportAndBanDevice);
router.post('/anticheat/admin/manage', adminManageBan);

// Game Session Endpoints
router.post('/game/start', startGameSession);

// Player Endpoints
router.get('/player/:studentId', getPlayerProfile);
router.post('/player/register', registerPlayer);

// Score Endpoints
router.post('/score', submitScore);
router.post('/sync', syncPlayers);

// Leaderboard Endpoints
router.get('/leaderboard', getLeaderboard);

export default router;
