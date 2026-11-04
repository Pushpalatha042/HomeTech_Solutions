import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ['unread', 'read', 'resolved'], default: 'unread' }
}, { timestamps: true });

export default mongoose.model('ContactMessage', contactMessageSchema);
