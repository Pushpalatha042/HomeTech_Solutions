import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  category: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
  bookingDate: { type: Date, required: true },
  bookingTime: { type: String, required: true },
  address: { type: String, required: true },
  contactNumber: { type: String, required: true },
  instructions: { type: String, default: '' },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      'Pending', 'pending',
      'Confirmed', 'confirmed',
      'Assigned', 'assigned',
      'Accepted', 'accepted',
      'Awaiting Arrival Verification', 'awaiting-arrival-verification',
      'In Progress', 'in-progress', 'in_progress',
      'Completed', 'completed',
      'Cancelled', 'cancelled',
      'Rejected', 'rejected'
    ],
    default: 'Pending'
  },
  arrivalOtp: {
    codeHash: { type: String, default: null },
    encryptedCode: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    resendCooldownUntil: { type: Date, default: null },
    attemptsCount: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false }
  },
  arrivalVerifiedAt: { type: Date, default: null },
  rejectedWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  completionNotes: { type: String, default: '' },
  completedAt: { type: Date },
  startedAt: { type: Date },
  problemPhotos: [
    {
      url: { type: String, required: true },
      publicId: { type: String },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  completionPhotos: [
    {
      url: { type: String, required: true },
      publicId: { type: String },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  completedPhotos: [
    {
      url: { type: String, required: true },
      publicId: { type: String },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  workerLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    lastUpdated: { type: Date }
  }
}, { timestamps: true });

export default mongoose.model('Booking', bookingSchema);
