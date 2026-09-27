import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    highScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 500,
      index: true,
    },
    highestScoreDate: {
      type: Date,
      default: Date.now,
    },
    totalGames: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastScore: {
      type: Number,
      default: 0,
    },
    lastPlayedAt: {
      type: Date,
      default: Date.now,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    disqualified: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast leaderboard sorting: disqualified (0), highScore (-1), highestScoreDate (1)
playerSchema.index({ disqualified: 1, highScore: -1, highestScoreDate: 1 });

export const Player = mongoose.model('Player', playerSchema);
