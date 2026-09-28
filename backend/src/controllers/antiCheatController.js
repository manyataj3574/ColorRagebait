import { isDeviceOrIpBanned, banClient, getClientIp } from '../middleware/antiCheat.js';
import { BannedDevice } from '../models/BannedDevice.js';
import { Player } from '../models/Player.js';

export async function checkDeviceStatus(req, res) {
  try {
    const deviceId = req.query.deviceId || req.headers['x-device-id'];
    const clientIp = getClientIp(req);

    const ban = await isDeviceOrIpBanned(deviceId, clientIp);
    if (ban) {
      return res.json({
        banned: true,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
        deviceId: ban.deviceId,
        ip: clientIp,
      });
    }

    res.json({ banned: false, ip: clientIp });
  } catch (error) {
    console.error('[Anti-Cheat Check Error]', error);
    res.status(500).json({ error: 'Failed to check ban status' });
  }
}

export async function reportAndBanDevice(req, res) {
  try {
    const deviceId = req.body.deviceId;
    const reason = req.body.reason || 'Anti-Cheat violation detected';
    const studentId = req.body.studentId;
    const userAgent = req.body.userAgent || req.headers['user-agent'];
    const violationType = req.body.violationType || 'SYNTHETIC_CLICK';
    const clientIp = getClientIp(req);

    if (!deviceId && !clientIp) {
      return res.status(400).json({ error: 'Device ID or IP required' });
    }

    // Ignore client-side timing/speedhack reports (prevents false positive audio skew bans from older client caches)
    if (violationType === 'SPEEDHACK' || reason.toLowerCase().includes('speedhack') || reason.toLowerCase().includes('clock')) {
      console.warn(`[Anti-Cheat] Ignored legacy client timing report for ${studentId || deviceId}: ${reason}`);
      return res.json({
        success: true,
        banned: false,
        message: 'Clock/timing self-reports are deprecated to avoid false positives.',
      });
    }

    const ban = await banClient({
      deviceId,
      ip: clientIp,
      reason,
      studentId,
      userAgent,
      violationType,
    });

    res.json({
      success: true,
      banned: true,
      deviceId: String(deviceId || clientIp).trim().toUpperCase(),
      ip: clientIp,
      reason,
      bannedAt: ban ? ban.bannedAt : new Date(),
    });
  } catch (error) {
    console.error('[Anti-Cheat Ban Error]', error);
    res.status(500).json({ error: 'Failed to record device/IP ban' });
  }
}

// Admin ban / unban endpoint
export async function adminManageBan(req, res) {
  try {
    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
    const expectedKey = process.env.ADMIN_SECRET || 'coco_admin_secure_key_2026';

    if (!adminKey || adminKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Admin Key' });
    }

    const { action, targetId, reason } = req.body;

    if (action === 'unban') {
      // Target can be deviceId, studentId, or IP
      await BannedDevice.deleteMany({
        $or: [{ deviceId: targetId }, { studentId: targetId }, { ip: targetId }],
      });
      if (targetId) {
        await Player.updateMany({ studentId: targetId }, { disqualified: false });
      }
      return res.json({ success: true, message: `Unbanned target: ${targetId}` });
    }

    if (action === 'ban') {
      const ban = await banClient({
        deviceId: `ADMIN-BAN-${targetId}`,
        studentId: targetId,
        reason: reason || 'Manual Admin Ban',
        violationType: 'MANUAL_ADMIN',
      });
      return res.json({ success: true, ban });
    }

    res.status(400).json({ error: 'Invalid action: use "ban" or "unban"' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
