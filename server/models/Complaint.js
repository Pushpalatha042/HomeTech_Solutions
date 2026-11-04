import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  complaintType: {
    type: String,
    enum: ['customer', 'worker'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  attachments: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Resolved', 'Rejected'],
    default: 'Submitted'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

complaintSchema.index({ bookingId: 1, submittedBy: 1 });
complaintSchema.index({ complaintType: 1, status: 1 });

export default mongoose.model('Complaint', complaintSchema);
