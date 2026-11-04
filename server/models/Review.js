import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  serviceName: { type: String, default: '' }
}, { timestamps: true });

reviewSchema.index({ workerId: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
