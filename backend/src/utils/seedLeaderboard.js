import { connectDB } from '../config/db.js';
import { Player } from '../models/Player.js';

const leaderboardData = [
  { studentId: '26B11HACKUR', highScore: 165, level: 12, highestScoreDate: '2026-09-27T08:00:00.000Z', totalGames: 5 },
  { studentId: '26I1039',     highScore: 121, level: 9,  highestScoreDate: '2026-09-27T08:15:00.000Z', totalGames: 4 },
  { studentId: '23CSE041',    highScore: 120, level: 9,  highestScoreDate: '2026-09-27T08:30:00.000Z', totalGames: 3 },
  { studentId: '26B1064',     highScore: 111, level: 8,  highestScoreDate: '2026-09-27T08:45:00.000Z', totalGames: 4 },
  { studentId: '26B1112',     highScore: 83,  level: 6,  highestScoreDate: '2026-09-27T09:00:00.000Z', totalGames: 3 },
  { studentId: '25E3065',     highScore: 81,  level: 6,  highestScoreDate: '2026-09-27T09:15:00.000Z', totalGames: 2 },
  { studentId: '23I7187',     highScore: 73,  level: 5,  highestScoreDate: '2026-09-27T09:30:00.000Z', totalGames: 2 },
  { studentId: '26B1111',     highScore: 61,  level: 5,  highestScoreDate: '2026-09-27T09:45:00.000Z', totalGames: 3 },
  { studentId: 'DE24343',     highScore: 47,  level: 4,  highestScoreDate: '2026-09-27T10:00:00.000Z', totalGames: 2 },
  { studentId: 'NIGGA69GOD',  highScore: 38,  level: 3,  highestScoreDate: '2026-09-27T10:15:00.000Z', totalGames: 1 },
];

async function seed() {
  try {
    await connectDB();
    console.log('Seeding leaderboard data into MongoDB...');

    for (const item of leaderboardData) {
      await Player.findOneAndUpdate(
        { studentId: item.studentId },
        {
          studentId: item.studentId,
          highScore: item.highScore,
          level: item.level,
          highestScoreDate: new Date(item.highestScoreDate),
          totalGames: item.totalGames,
          lastScore: item.highScore,
          lastPlayedAt: new Date(item.highestScoreDate),
          disqualified: false,
        },
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded ${item.studentId}: Score ${item.highScore} (Lvl ${item.level})`);
    }

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
