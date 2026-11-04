import express from 'express';
import {
  getBookingTracking,
  postWorkerLocation,
  getAdminLiveWorkers
} from '../controllers/trackingController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/admin/live-workers', requireAdmin, getAdminLiveWorkers);
router.get('/:bookingId', getBookingTracking);
router.post('/:bookingId/location', postWorkerLocation);

export default router;
