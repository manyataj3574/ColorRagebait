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
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const BannedDevice = mongoose.model('BannedDevice', bannedDeviceSchema);
