import { connectDB } from '../config/db.js';
import { BannedDevice } from '../models/BannedDevice.js';
import { Player } from '../models/Player.js';

const target = process.argv[2];

if (!target) {
  console.log('Usage: node src/utils/unban.js <STUDENT_ID_OR_IP_OR_DEVICE_ID>');
  console.log('Example: node src/utils/unban.js 26B1112');
  console.log('Example: node src/utils/unban.js all');
  process.exit(1);
}

async function unban() {
  try {
    await connectDB();

    if (target.toLowerCase() === 'all') {
      const res = await BannedDevice.deleteMany({});
      await Player.updateMany({}, { disqualified: false });
      console.log(`Unbanned ALL devices & IPs (${res.deletedCount} bans cleared)`);
      process.exit(0);
    }

    const cleanTarget = target.trim().toUpperCase();
    const result = await BannedDevice.deleteMany({
      $or: [
        { studentId: cleanTarget },
        { deviceId: cleanTarget },
        { ip: target.trim() },
        { knownIps: target.trim() },
      ],
    });

    await Player.updateMany({ studentId: cleanTarget }, { disqualified: false });

    console.log(`Successfully unbanned "${target}". (${result.deletedCount} ban records removed).`);
    process.exit(0);
  } catch (err) {
    console.error('Error unbanning target:', err);
    process.exit(1);
  }
}

unban();
