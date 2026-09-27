export interface ColorItem {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
}

export interface GameQuestion {
  id: number;
  wordColor: ColorItem; // The text that is written (e.g., "BLUE")
  inkColor: ColorItem;  // The actual color applied to the text (e.g., YELLOW) -> THIS IS THE CORRECT ANSWER
  options: ColorItem[]; // 4 choices shown to user
}

export interface LevelConfig {
  level: number;
  name: string;
  minScore: number;
  maxScore: number; // inclusive upper bound, or Infinity for max level
  timeLimit: number; // in seconds, Level 1 = 10.0s
  colorPoolSize: number;
  matchChance: number; // chance that word matches ink (trap)
  description: string;
}

export interface PlayerProfile {
  studentId: string;
  highScore: number;
  highestScoreDate: string | null;
  totalGames: number;
  rank: number | null;
  highestLevel?: number;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  highScore: number;
  highestScoreDate: string;
  totalGames?: number;
  level?: number;
}

export interface SubmitScoreResponse {
  success: boolean;
  studentId: string;
  currentScore: number;
  highScore: number;
  previousHighScore: number;
  isNewHighScore: boolean;
  highestScoreDate: string;
  rank: number | null;
  totalPlayers: number;
  level?: number;
  highestLevel?: number;
}

export interface RoundTelemetry {
  q: number;
  dt: number;
  x: number;
  y: number;
  trusted: boolean;
}

export interface GameOverData {
  score: number;
  level: number;
  levelName: string;
  isNewHighScore: boolean;
  previousHighScore: number;
  highestScore: number;
  rank: number | null;
  totalPlayers: number;
  reason: 'wrong_color' | 'timeout';
  selectedColor?: ColorItem;
  correctColor: ColorItem;
  wordColor: ColorItem;
  telemetry?: RoundTelemetry[];
}

export interface BanInfo {
  isBanned: boolean;
  reason?: string;
  bannedAt?: string;
  deviceId?: string;
}

export type ScreenState = 'HOME' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER' | 'LEADERBOARD' | 'BANNED';
