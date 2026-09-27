import { LevelConfig } from '../types';

export const GAME_LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'Novice',
    minScore: 0,
    maxScore: 14, // 15 answers (0-14)
    timeLimit: 10.0,
    colorPoolSize: 4,
    matchChance: 0,
    description: 'Level 1: 15 answers at 10.0s per answer.',
  },
  {
    level: 2,
    name: 'Speedster',
    minScore: 15,
    maxScore: 29, // 15 answers (15-29)
    timeLimit: 8.0,
    colorPoolSize: 5,
    matchChance: 0.08,
    description: 'Level 2: 15 answers at 8.0s per answer.',
  },
  {
    level: 3,
    name: 'Brainstorm',
    minScore: 30,
    maxScore: 44, // 15 answers (30-44)
    timeLimit: 6.0,
    colorPoolSize: 6,
    matchChance: 0.12,
    description: 'Level 3: 15 answers at 6.0s per answer.',
  },
  {
    level: 4,
    name: 'Razor Sharp',
    minScore: 45,
    maxScore: 59, // 15 answers (45-59)
    timeLimit: 4.5,
    colorPoolSize: 7,
    matchChance: 0.15,
    description: 'Level 4: 15 answers at 4.5s per answer.',
  },
  {
    level: 5,
    name: 'Mind Master',
    minScore: 60,
    maxScore: 74, // 15 answers (60-74)
    timeLimit: 3.0,
    colorPoolSize: 8,
    matchChance: 0.18,
    description: 'Level 5: 15 answers at 3.0s per answer.',
  },
  {
    level: 6,
    name: 'Reflex King',
    minScore: 75,
    maxScore: 89, // 15 answers (75-89)
    timeLimit: 2.0,
    colorPoolSize: 8,
    matchChance: 0.20,
    description: 'Level 6: 15 answers at 2.0s per answer.',
  },
  {
    level: 7,
    name: 'Hyper Focus',
    minScore: 90,
    maxScore: 104, // 15 answers (90-104)
    timeLimit: 1.4,
    colorPoolSize: 8,
    matchChance: 0.22,
    description: 'Level 7: 15 answers at 1.4s per answer.',
  },
  {
    level: 8,
    name: 'Campus Champion',
    minScore: 105,
    maxScore: 119, // 15 answers (105-119)
    timeLimit: 1.0, // Requested: timing decreases to 1 sec
    colorPoolSize: 8,
    matchChance: 0.25,
    description: 'Level 8: 15 answers at 1.0s per answer.',
  },
  {
    level: 9,
    name: 'Lightning',
    minScore: 120,
    maxScore: 134, // 15 answers (120-134)
    timeLimit: 0.9, // Requested: 15 answers ke bad 0.9 seconds!
    colorPoolSize: 8,
    matchChance: 0.25,
    description: 'Level 9: 15 answers at 0.9s per answer.',
  },
  {
    level: 10,
    name: 'Sonic Speed',
    minScore: 135,
    maxScore: 149, // 15 answers (135-149)
    timeLimit: 0.8,
    colorPoolSize: 8,
    matchChance: 0.25,
    description: 'Level 10: 15 answers at 0.8s per answer.',
  },
  {
    level: 11,
    name: 'Extreme Hard',
    minScore: 150,
    maxScore: 164, // 15 answers (150-164)
    timeLimit: 0.7,
    colorPoolSize: 8,
    matchChance: 0.28,
    description: 'Level 11: 15 answers at 0.7s per answer.',
  },
  {
    level: 12,
    name: 'God Mode',
    minScore: 165,
    maxScore: Infinity, // 165+
    timeLimit: 0.6,
    colorPoolSize: 8,
    matchChance: 0.30,
    description: 'Level 12: God tier reflexes at 0.6s per answer!',
  },
];

export function getLevelForScore(score: number): LevelConfig {
  const safeScore = Math.max(0, Math.floor(score));
  for (let i = GAME_LEVELS.length - 1; i >= 0; i--) {
    if (safeScore >= GAME_LEVELS[i].minScore) {
      return GAME_LEVELS[i];
    }
  }
  return GAME_LEVELS[0];
}

export function getTimeLimitForScore(score: number): number {
  const level = getLevelForScore(score);
  return level.timeLimit;
}
