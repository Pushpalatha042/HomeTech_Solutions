import express from 'express';
import {
  getMyWorkRequests,
  acceptWorkRequest,
  rejectWorkRequest
} from '../controllers/workRequestController.js';
import { verifyToken, requireApprovedWorker } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, requireApprovedWorker);

router.get('/my', getMyWorkRequests);
router.put('/:id/accept', acceptWorkRequest);
router.put('/:id/reject', rejectWorkRequest);

export default router;
