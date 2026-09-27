import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Player } from '../models/Player.js';
import { BannedDevice } from '../models/BannedDevice.js';
import { calculateLevel, normalizeId } from './levels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrateLocalJsonData() {
  try {
    const rootDataDir = path.resolve(__dirname, '../../../data');
    const scoresBackupFile = path.join(rootDataDir, 'scores_backup.json');
    const scoresPrimaryFile = path.join(rootDataDir, 'scores.json');
    const bannedFile = path.join(rootDataDir, 'banned_devices.json');

    // 1. Migrate Players if database has fewer than 1 player
    const playerCount = await Player.countDocuments();
    if (playerCount === 0) {
      let sourceFile = fs.existsSync(scoresPrimaryFile) ? scoresPrimaryFile : null;
      let rawData = null;

      if (sourceFile) {
        try {
          const parsed = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
          if (parsed?.players && Object.keys(parsed.players).length > 0) {
            rawData = parsed.players;
          }
        } catch {
          // Fall back to backup
        }
      }

      if (!rawData && fs.existsSync(scoresBackupFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(scoresBackupFile, 'utf-8'));
          if (parsed?.players && Object.keys(parsed.players).length > 0) {
            rawData = parsed.players;
          }
        } catch (err) {
          console.warn('[Migration] Could not parse scores_backup.json:', err.message);
        }
      }

      if (rawData) {
        let imported = 0;
        for (const [id, item] of Object.entries(rawData)) {
          const studentId = normalizeId(id || item.studentId);
          if (!studentId) continue;

          await Player.findOneAndUpdate(
            { studentId },
            {
              studentId,
              highScore: Math.min(500, Number(item.highScore) || 0),
              highestScoreDate: item.highestScoreDate ? new Date(item.highestScoreDate) : new Date(),
              totalGames: Number(item.totalGames) || 1,
              lastScore: Number(item.lastScore) || 0,
              lastPlayedAt: item.lastPlayedAt ? new Date(item.lastPlayedAt) : new Date(),
              level: item.level || calculateLevel(Number(item.highScore) || 0),
              disqualified: Boolean(item.disqualified),
            },
            { upsert: true }
          );
          imported++;
        }
        console.log(`[Migration] Successfully imported ${imported} existing players into MongoDB`);
      }
    }

    // 2. Migrate Banned Devices if database has 0 banned devices
    const bannedCount = await BannedDevice.countDocuments();
    if (bannedCount === 0 && fs.existsSync(bannedFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(bannedFile, 'utf-8'));
        if (parsed?.devices) {
          let bannedImported = 0;
          for (const [id, item] of Object.entries(parsed.devices)) {
            const deviceId = String(id || item.deviceId).trim().toUpperCase();
            if (!deviceId) continue;

            await BannedDevice.findOneAndUpdate(
              { deviceId },
              {
                deviceId,
                studentId: item.studentId ? normalizeId(item.studentId) : undefined,
                reason: item.reason || 'Imported Anti-Cheat Ban',
                bannedAt: item.bannedAt ? new Date(item.bannedAt) : new Date(),
                ip: item.ip,
              },
              { upsert: true }
            );
            bannedImported++;
          }
          console.log(`[Migration] Successfully imported ${bannedImported} banned devices into MongoDB`);
        }
      } catch (err) {
        console.warn('[Migration] Could not parse banned_devices.json:', err.message);
      }
    }
  } catch (err) {
    console.error('[Migration Error]', err.message);
  }
}
