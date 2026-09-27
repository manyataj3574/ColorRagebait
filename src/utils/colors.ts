import { ColorItem, GameQuestion } from '../types';
import { getLevelForScore } from './levels';

export const ALL_COLORS: ColorItem[] = [
  {
    id: 'red',
    name: 'Red',
    hex: '#EF4444',
    bgClass: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
    textClass: 'text-red-500',
    borderClass: 'border-red-500',
    ringClass: 'ring-red-400',
  },
  {
    id: 'blue',
    name: 'Blue',
    hex: '#3B82F6',
    bgClass: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500',
    ringClass: 'ring-blue-400',
  },
  {
    id: 'green',
    name: 'Green',
    hex: '#10B981',
    bgClass: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white',
    textClass: 'text-emerald-500',
    borderClass: 'border-emerald-500',
    ringClass: 'ring-emerald-400',
  },
  {
    id: 'yellow',
    name: 'Yellow',
    hex: '#F59E0B',
    bgClass: 'bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-900',
    textClass: 'text-amber-500',
    borderClass: 'border-amber-400',
    ringClass: 'ring-amber-300',
  },
  {
    id: 'purple',
    name: 'Purple',
    hex: '#8B5CF6',
    bgClass: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white',
    textClass: 'text-purple-500',
    borderClass: 'border-purple-500',
    ringClass: 'ring-purple-400',
  },
  {
    id: 'orange',
    name: 'Orange',
    hex: '#F97316',
    bgClass: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white',
    textClass: 'text-orange-500',
    borderClass: 'border-orange-500',
    ringClass: 'ring-orange-400',
  },
  {
    id: 'pink',
    name: 'Pink',
    hex: '#EC4899',
    bgClass: 'bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white',
    textClass: 'text-pink-500',
    borderClass: 'border-pink-500',
    ringClass: 'ring-pink-400',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    hex: '#06B6D4',
    bgClass: 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-slate-900',
    textClass: 'text-cyan-500',
    borderClass: 'border-cyan-500',
    ringClass: 'ring-cyan-400',
  },
];

// Helper to shuffle array
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generate a new question according to player score and level
export function generateQuestion(score: number, lastQuestion?: GameQuestion | null): GameQuestion {
  const currentLevel = getLevelForScore(score);
  const pool = ALL_COLORS.slice(0, currentLevel.colorPoolSize);

  // Pick ink color (the correct answer)
  let availableInks = pool;
  if (lastQuestion) {
    // Avoid repeating the exact same ink color consecutively
    availableInks = pool.filter((c) => c.id !== lastQuestion.inkColor.id);
    if (availableInks.length === 0) availableInks = pool;
  }
  const inkColor = availableInks[Math.floor(Math.random() * availableInks.length)];

  // Pick word color (the trap text)
  // At higher levels, matchChance increases to test if the player is blindly inverting
  let wordColor: ColorItem;
  const canMatch = Math.random() < currentLevel.matchChance;

  if (canMatch) {
    wordColor = inkColor;
  } else {
    const otherColors = pool.filter((c) => c.id !== inkColor.id);
    wordColor = otherColors[Math.floor(Math.random() * otherColors.length)];
  }

  // Choose 4 option buttons:
  // Must include inkColor (the answer)
  const optionSet = new Set<string>();
  optionSet.add(inkColor.id);
  optionSet.add(wordColor.id);

  // Fill up to 4 distinct options from the pool (or all colors if pool < 4)
  const candidatePool = pool.length >= 4 ? pool : ALL_COLORS.slice(0, 4);
  const shuffledCandidates = shuffleArray(candidatePool);

  for (const c of shuffledCandidates) {
    if (optionSet.size >= 4) break;
    optionSet.add(c.id);
  }

  // In rare case size < 4 (e.g. pool was small and word matched ink), fill from ALL_COLORS
  if (optionSet.size < 4) {
    for (const c of ALL_COLORS) {
      if (optionSet.size >= 4) break;
      optionSet.add(c.id);
    }
  }

  // Convert IDs back to ColorItem and shuffle positions
  const options = shuffleArray(
    Array.from(optionSet).map((id) => ALL_COLORS.find((c) => c.id === id)!)
  );

  return {
    id: Date.now() + Math.random(),
    wordColor,
    inkColor,
    options,
  };
}

// Calculate time limit per question based on level
export function getTimeLimitForScore(score: number): number {
  const currentLevel = getLevelForScore(score);
  return currentLevel.timeLimit;
}
