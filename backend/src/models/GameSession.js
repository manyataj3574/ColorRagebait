import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  studentId: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  deviceId: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  token: {
    type: String,
    required: true,
  },
  startedAt: {
    type: Number,
    required: true,
    default: () => Date.now(),
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7200, // MongoDB automatically deletes sessions after 2 hours
  },
});

export const GameSession = mongoose.model('GameSession', gameSessionSchema);
