import express from 'express';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  getAllBookings,
  assignWorker,
  updateBookingStatus,
  cancelBooking,
  confirmCompletion,
  submitBookingReview,
  getBookingReview,
  uploadProblemPhotosHandler,
  addProblemPhotosToBooking,
  addCompletionPhotosToBooking,
  startArrivalVerification,
  verifyArrivalOtp,
  getArrivalVerification,
  resendArrivalOtp
} from '../controllers/bookingController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { uploadProblemPhotos, uploadCompletionPhotos } from '../middleware/upload.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', createBooking);
router.post('/upload-problem-photos', uploadProblemPhotos, uploadProblemPhotosHandler);
router.post('/:id/problem-photos', uploadProblemPhotos, addProblemPhotosToBooking);
router.post('/:id/completion-photos', uploadCompletionPhotos, addCompletionPhotosToBooking);
router.post('/:id/after-photos', uploadCompletionPhotos, addCompletionPhotosToBooking);

// Arrival OTP Verification routes
router.post('/:id/start-verification', startArrivalVerification);
router.post('/:id/verify-arrival-otp', verifyArrivalOtp);
router.get('/:id/arrival-verification', getArrivalVerification);
router.post('/:id/resend-arrival-otp', resendArrivalOtp);

router.get('/my', getMyBookings);
router.get('/:id', getBookingById);
router.delete('/:id', cancelBooking);

// Customer Completion & Reviews
router.put('/:id/confirm-completion', confirmCompletion);
router.put('/:id/complete', confirmCompletion);
router.post('/:id/review', submitBookingReview);
router.get('/:id/review', getBookingReview);

// Admin-only operations
router.get('/', requireAdmin, getAllBookings);
router.put('/:id/assign', requireAdmin, assignWorker);
router.put('/:id/status', updateBookingStatus);

export default router;
