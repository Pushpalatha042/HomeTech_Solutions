import express from 'express';
import {
  sendOTP,
  verifyOTP,
  register,
  login,
  getMe,
  switchRole,
  updateProfile,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', verifyToken, getMe);
router.put('/switch-role', verifyToken, switchRole);
router.put('/profile', verifyToken, updateProfile);

export default router;
