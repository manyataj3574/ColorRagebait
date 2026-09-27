import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_URI = 'mongodb+srv://jaiswalmanyata551_db_user:METjyqxfghMAnsIT@cluster0.lim91cw.mongodb.net/color_ragebait?retryWrites=true&w=majority';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  
  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Connection Error]`, error.message);
    throw error;
  }
}
