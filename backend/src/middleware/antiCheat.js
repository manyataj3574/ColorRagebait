import { BannedDevice } from '../models/BannedDevice.js';
import { Player } from '../models/Player.js';
import { normalizeId } from '../utils/levels.js';

// In-memory set for ultra-fast ban lookups
const bannedDeviceCache = new Set();
let cacheInitialized = false;

export async function initBannedCache() {
  try {
    const list = await BannedDevice.find({}, 'deviceId');
    bannedDeviceCache.clear();
    for (const b of list) {
      if (b.deviceId) {
        bannedDeviceCache.add(b.deviceId.toUpperCase());
      }
    }
    cacheInitialized = true;
  } catch (err) {
    console.error('[Anti-Cheat] Error initializing banned cache:', err.message);
  }
}

export async function isDeviceBanned(deviceId) {
  if (!deviceId) return null;
  const cleanId = String(deviceId).trim().toUpperCase();

  if (cacheInitialized && bannedDeviceCache.has(cleanId)) {
    return await BannedDevice.findOne({ deviceId: cleanId }).lean();
  }

  const ban = await BannedDevice.findOne({ deviceId: cleanId }).lean();
  if (ban) {
    bannedDeviceCache.add(cleanId);
  }
  return ban;
}

export async function banDevice(deviceId, reason, studentId, ip, userAgent) {
  if (!deviceId) return null;
  const cleanId = String(deviceId).trim().toUpperCase();
  const cleanStudentId = studentId ? normalizeId(studentId) : undefined;

  bannedDeviceCache.add(cleanId);

  try {
    const ban = await BannedDevice.findOneAndUpdate(
      { deviceId: cleanId },
      {
        deviceId: cleanId,
        studentId: cleanStudentId,
        reason,
        bannedAt: new Date(),
        ip,
        userAgent,
      },
      { upsert: true, new: true }
    );

    console.warn(`[ANTI-CHEAT BAN] Device ${cleanId} banned: ${reason} (Student: ${cleanStudentId || 'unknown'})`);

    // Disqualify cheated scores from database if studentId is known
    if (cleanStudentId) {
      await Player.findOneAndUpdate(
        { studentId: cleanStudentId },
        { highScore: 0, disqualified: true }
      );
    }

    return ban;
  } catch (err) {
    console.error('[Anti-Cheat] Error banning device in DB:', err.message);
    return null;
  }
}

export async function antiCheatMiddleware(req, res, next) {
  // Allow health check and ban status endpoints
  if (req.path === '/health' || req.path === '/anticheat/check' || req.path === '/anticheat/ban') {
    return next();
  }

  const deviceId =
    (req.headers['x-device-id']) ||
    req.body?.deviceId ||
    (req.query.deviceId);

  if (deviceId) {
    const ban = await isDeviceBanned(deviceId);
    if (ban) {
      return res.status(403).json({
        error: 'DEVICE_BANNED',
        banned: true,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
        deviceId: ban.deviceId,
      });
    }
  }

  next();
}
