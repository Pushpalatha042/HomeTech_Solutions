import mongoose from 'mongoose';

const workerLocationSchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  speed: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

workerLocationSchema.index({ bookingId: 1, lastUpdated: -1 });
workerLocationSchema.index({ workerId: 1 });

export default mongoose.model('WorkerLocation', workerLocationSchema);
