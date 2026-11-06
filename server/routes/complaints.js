import express from 'express';
import {
  submitComplaint,
  submitCustomerComplaint,
  submitWorkerComplaint,
  getMyComplaints,
  getWorkerComplaints,
  getBookingComplaints,
  getAdminComplaints,
  getAdminComplaintById,
  updateComplaintStatus
} from '../controllers/complaintController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

// Customer and Worker Complaint submission
router.post('/customer', submitCustomerComplaint);
router.post('/worker', submitWorkerComplaint);
router.post('/', submitComplaint);

// User complaints retrieval
router.get('/worker/my', getWorkerComplaints);
router.get('/my', getMyComplaints);
router.get('/booking/:bookingId', getBookingComplaints);

// Admin-only endpoints
router.get('/admin', requireAdmin, getAdminComplaints);
router.get('/:id', getAdminComplaintById);
router.put('/:id/status', requireAdmin, updateComplaintStatus);

export default router;
