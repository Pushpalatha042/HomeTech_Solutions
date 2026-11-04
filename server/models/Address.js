import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Home' },
  addressLine: { type: String, required: true },
  city: { type: String, default: 'Vijayawada' },
  state: { type: String, default: 'Andhra Pradesh' },
  postalCode: { type: String, default: '520001' },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Address', addressSchema);
