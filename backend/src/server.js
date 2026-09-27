import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB } from './config/db.js';
import { initBannedCache } from './middleware/antiCheat.js';
import { migrateLocalJsonData } from './utils/migrateLocalData.js';
import apiRoutes from './routes/apiRoutes.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN === '*' ? '*' : (process.env.FRONTEND_ORIGIN || '*'),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
}));
app.use(express.json());

// Routes
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

async function start() {
  try {
    await connectDB();
    await migrateLocalJsonData();
    await initBannedCache();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Color Ragebait MongoDB Backend running on port ${PORT}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
}

start();
