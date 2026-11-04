import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('OTPVerification', otpVerificationSchema);
