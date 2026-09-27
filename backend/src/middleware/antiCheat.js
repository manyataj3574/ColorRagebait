import { BannedDevice } from '../models/BannedDevice.js';
import { Player } from '../models/Player.js';
import { normalizeId } from '../utils/levels.js';

// In-memory sets for 0ms ban lookups
const bannedDeviceCache = new Set();
const bannedIpCache = new Set();
let cacheInitialized = false;

export function normalizeIp(ip) {
  if (!ip) return '';
  let clean = String(ip).trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.substring(7);
  }
  if (clean === '::1') {
    clean = '127.0.0.1';
  }
  return clean;
}

export function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = String(xForwardedFor).split(',');
    const clientIp = ips[0].trim();
    if (clientIp) return normalizeIp(clientIp);
  }

  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return normalizeIp(String(cfIp));

  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) return normalizeIp(String(xRealIp));

  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

export async function initBannedCache() {
  try {
    const list = await BannedDevice.find({}, 'deviceId ip knownIps').lean();
    bannedDeviceCache.clear();
    bannedIpCache.clear();

    for (const b of list) {
      if (b.deviceId) bannedDeviceCache.add(b.deviceId.toUpperCase());
      if (b.ip) bannedIpCache.add(normalizeIp(b.ip));
      if (Array.isArray(b.knownIps)) {
        for (const k of b.knownIps) {
          if (k) bannedIpCache.add(normalizeIp(k));
        }
      }
    }
    cacheInitialized = true;
    console.log(`[Anti-Cheat] Initialized cache with ${bannedDeviceCache.size} devices and ${bannedIpCache.size} banned IPs.`);
  } catch (err) {
    console.error('[Anti-Cheat] Error initializing banned cache:', err.message);
  }
}

export async function isDeviceOrIpBanned(deviceId, ip, studentId) {
  const cleanDevice = deviceId ? String(deviceId).trim().toUpperCase() : '';
  const cleanIp = normalizeIp(ip);
  const cleanStudent = studentId ? normalizeId(studentId) : '';

  // 1. Device ID ban check (instant)
  if (cleanDevice && bannedDeviceCache.has(cleanDevice)) {
    return await BannedDevice.findOne({ deviceId: cleanDevice }).lean();
  }

  // 2. Student ID ban check
  if (cleanStudent) {
    const studentBan = await BannedDevice.findOne({ studentId: cleanStudent }).lean();
    if (studentBan) return studentBan;
  }

  // 3. IP Ban Check
  if (cleanIp && cleanIp !== '127.0.0.1' && bannedIpCache.has(cleanIp)) {
    const ipBan = await BannedDevice.findOne({
      $or: [{ ip: cleanIp }, { knownIps: cleanIp }],
    }).lean();

    if (ipBan) {
      // If it's a strict whole-network ban (e.g. DDoS / API brute-force / manual admin IP ban)
      if (ipBan.violationType === 'BOT_NETWORK' || ipBan.deviceId?.startsWith('IP-BAN-')) {
        return ipBan;
      }
      // On shared campus NAT Wi-Fi, block if it matches the banned student or device
      if (cleanStudent && ipBan.studentId === cleanStudent) {
        return ipBan;
      }
      if (cleanDevice && ipBan.deviceId === cleanDevice) {
        return ipBan;
      }
    }
  }

  return null;
}

export async function banClient({ deviceId, ip, reason, studentId, userAgent, violationType = 'MANUAL_ADMIN' }) {
  const cleanDevice = deviceId ? String(deviceId).trim().toUpperCase() : `IP-BAN-${Date.now()}`;
  const cleanIp = normalizeIp(ip);
  const cleanStudentId = studentId ? normalizeId(studentId) : undefined;

  if (cleanDevice) bannedDeviceCache.add(cleanDevice);
  if (cleanIp && cleanIp !== '127.0.0.1') bannedIpCache.add(cleanIp);

  try {
    const updateOps = {
      deviceId: cleanDevice,
      reason,
      bannedAt: new Date(),
      userAgent,
      violationType,
    };
    if (cleanStudentId) updateOps.studentId = cleanStudentId;
    if (cleanIp) updateOps.ip = cleanIp;

    const ban = await BannedDevice.findOneAndUpdate(
      { deviceId: cleanDevice },
      {
        ...updateOps,
        $addToSet: cleanIp ? { knownIps: cleanIp } : {},
      },
      { upsert: true, new: true }
    );

    console.warn(`[ANTI-CHEAT BAN] Device: ${cleanDevice} | IP: ${cleanIp || 'N/A'} | Reason: ${reason} | Student: ${cleanStudentId || 'unknown'}`);

    // Disqualify and reset all cheated scores from this student
    if (cleanStudentId) {
      await Player.updateMany(
        { studentId: cleanStudentId },
        { highScore: 0, disqualified: true }
      );
    }

    return ban;
  } catch (err) {
    console.error('[Anti-Cheat] Error recording ban in DB:', err.message);
    return null;
  }
}

// Backward compatibility alias
export async function isDeviceBanned(deviceId) {
  return isDeviceOrIpBanned(deviceId, null);
}

export async function banDevice(deviceId, reason, studentId, ip, userAgent) {
  return banClient({ deviceId, ip, reason, studentId, userAgent });
}

export async function antiCheatMiddleware(req, res, next) {
  // Allow health check and ban checking endpoints
  if (req.path === '/health' || req.path === '/anticheat/check') {
    return next();
  }

  const deviceId =
    (req.headers['x-device-id']) ||
    req.body?.deviceId ||
    (req.query.deviceId);

  const clientIp = getClientIp(req);
  const studentId = req.body?.studentId || req.params?.studentId || req.query?.studentId;

  const ban = await isDeviceOrIpBanned(deviceId, clientIp, studentId);
  if (ban) {
    return res.status(403).json({
      error: 'DEVICE_BANNED',
      banned: true,
      reason: ban.reason,
      bannedAt: ban.bannedAt,
      deviceId: ban.deviceId,
      ip: clientIp,
    });
  }

  // Attach detected client IP to request for downstream handlers
  req.clientIp = clientIp;
  next();
}
