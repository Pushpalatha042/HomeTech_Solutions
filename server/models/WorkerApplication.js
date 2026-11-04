import mongoose from 'mongoose';

const workerApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  profileImage: { type: String, default: '' },
  skills: [{ type: String }],
  selectedCategories: [{ type: String, required: true }],
  approvedCategories: [{ type: String, default: [] }],
  experience: { type: Number, default: 1, min: 0 },
  serviceLocation: { type: String, required: true },
  address: { type: String, required: true },
  professionalDescription: { type: String, required: true },
  documents: [{ type: String }],
  applicationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('WorkerApplication', workerApplicationSchema);
