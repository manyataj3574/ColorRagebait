import mongoose from 'mongoose';

const bannedDeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    bannedAt: {
      type: Date,
      default: Date.now,
    },
    ip: {
      type: String,
      trim: true,
      index: true,
    },
    knownIps: {
      type: [String],
      default: [],
      index: true,
    },
    userAgent: {
      type: String,
    },
    violationType: {
      type: String,
      enum: ['EXTENSION', 'SPEEDHACK', 'SYNTHETIC_CLICK', 'TIMING_SUPERHUMAN', 'HONEYPOT', 'FORGED_SESSION', 'SCORE_MANIPULATION', 'MANUAL_ADMIN'],
      default: 'MANUAL_ADMIN',
    },
  },
  {
    timestamps: true,
  }
);

export const BannedDevice = mongoose.model('BannedDevice', bannedDeviceSchema);
