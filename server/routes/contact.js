import express from 'express';
import ContactMessage from '../models/ContactMessage.js';
import { validateEmail, validatePhone } from '../utils/validators.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone = '', message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ message: emailCheck.message });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    if (phone && phone.trim()) {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ message: phoneCheck.message });
      }
    }

    const contact = await ContactMessage.create({
      name: name.trim(),
      email: emailCheck.cleanEmail,
      phone: phone.trim(),
      message: message.trim(),
      status: 'unread'
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Our support team will get back to you shortly.',
      contactId: contact._id
    });
  } catch (err) {
    console.error('Contact submit error:', err);
    res.status(500).json({ message: 'Failed to submit contact message. Please try again.' });
  }
});

export default router;
