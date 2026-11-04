import mongoose from 'mongoose';

const workRequestSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory'
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Expired', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  expiresAt: {
    type: Date
  }
}, { timestamps: true });

// Compound index: Unique request per booking per worker
workRequestSchema.index({ bookingId: 1, workerId: 1 }, { unique: true });

// Compound index: Fast lookup of a worker's pending requests
workRequestSchema.index({ workerId: 1, status: 1 });

// Compound index: Fast lookup of requests by booking and status
workRequestSchema.index({ bookingId: 1, status: 1 });

export default mongoose.model('WorkRequest', workRequestSchema);
