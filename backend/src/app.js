import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
}));
app.use(express.json());

// Mount API routes
app.use('/api', apiRoutes);

// Root greeting
app.get('/', (_req, res) => {
  res.json({
    name: 'Color Ragebait MongoDB Backend',
    status: 'online',
    endpoints: {
      health: '/api/health',
      leaderboard: '/api/leaderboard',
      playerProfile: '/api/player/:studentId',
      playerRegister: '/api/player/register',
      gameStart: '/api/game/start',
      submitScore: '/api/score',
      sync: '/api/sync',
      antiCheatCheck: '/api/anticheat/check',
      antiCheatBan: '/api/anticheat/ban',
    },
  });
});

export default app;
