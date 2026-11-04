import mongoose from 'mongoose';

const serviceCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'Wrench' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('ServiceCategory', serviceCategorySchema);
