import { isDeviceBanned, banDevice } from '../middleware/antiCheat.js';

export async function checkDeviceStatus(req, res) {
  try {
    const deviceId = req.query.deviceId || req.headers['x-device-id'];
    if (!deviceId) {
      return res.json({ banned: false });
    }

    const ban = await isDeviceBanned(deviceId);
    if (ban) {
      return res.json({
        banned: true,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
        deviceId: ban.deviceId,
      });
    }

    res.json({ banned: false });
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

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    const ban = await banDevice(deviceId, reason, studentId, req.ip, userAgent);

    res.json({
      success: true,
      banned: true,
      deviceId: String(deviceId).trim().toUpperCase(),
      reason,
      bannedAt: ban ? ban.bannedAt : new Date(),
    });
  } catch (error) {
    console.error('[Anti-Cheat Ban Error]', error);
    res.status(500).json({ error: 'Failed to record device ban' });
  }
}
