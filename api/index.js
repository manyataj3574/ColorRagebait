import app from '../backend/src/app.js';
import { connectDB } from '../backend/src/config/db.js';
import { initBannedCache } from '../backend/src/middleware/antiCheat.js';

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    try {
      await connectDB();
      await initBannedCache();
      isConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless DB Error]', err);
    }
  }
  return app(req, res);
}
