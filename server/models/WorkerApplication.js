import mongoose from 'mongoose';

const workerApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  profileImage: { type: String, default: '' },
  skills: [{ type: String }],
  selectedCategories: [{ type: String, default: [] }],
  requestedCategories: [{ type: String, default: [] }],
  currentCategories: [{ type: String, default: [] }],
  approvedCategories: [{ type: String, default: [] }],
  rejectedCategories: [{ type: String, default: [] }],
  experience: { type: Number, default: 1, min: 0 },
  serviceLocation: { type: String, default: '' },
  address: { type: String, default: '' },
  professionalDescription: { type: String, default: '' },
  documents: [{ type: String }],
  applicationType: {
    type: String,
    enum: ['initial', 'additional_category'],
    default: 'initial'
  },
  applicationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'partially_approved'],
    default: 'pending'
  },
  adminNotes: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { timestamps: true });

workerApplicationSchema.index({ userId: 1, applicationType: 1, applicationStatus: 1 });

export default mongoose.model('WorkerApplication', workerApplicationSchema);
