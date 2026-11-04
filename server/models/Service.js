import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  features: [{ type: String }],
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 120 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Service', serviceSchema);
