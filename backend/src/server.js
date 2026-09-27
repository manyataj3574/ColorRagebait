import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app.js';
import { connectDB } from './config/db.js';
import { initBannedCache } from './middleware/antiCheat.js';
import { migrateLocalJsonData } from './utils/migrateLocalData.js';

const PORT = Number(process.env.PORT) || 5000;

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
