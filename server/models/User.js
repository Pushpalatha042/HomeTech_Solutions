import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, select: false },
  roles: {
    type: [{ type: String, enum: ['customer', 'worker', 'admin'] }],
    default: ['customer']
  },
  activeRole: { type: String, enum: ['customer', 'worker', 'admin'], default: 'customer' },
  profileImage: { type: String, default: '' },
  isPhoneVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  workerStatus: {
    type: String,
    enum: ['not_applied', 'pending', 'approved', 'rejected'],
    default: 'not_applied'
  },
  approvedCategories: [{ type: String }],
  isAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 5.0 },
  ratingCount: { type: Number, default: 0 },
  address: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
