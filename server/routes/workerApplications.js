import express from 'express';
import {
  submitWorkerApplication,
  getMyWorkerApplication,
  getAllWorkerApplications,
  approveWorkerApplication,
  rejectWorkerApplication
} from '../controllers/workerController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

// Customer application routes
router.post('/', submitWorkerApplication);
router.get('/my', getMyWorkerApplication);

// Admin-only management routes
router.get('/', requireAdmin, getAllWorkerApplications);
router.put('/:id/approve', requireAdmin, approveWorkerApplication);
router.put('/:id/reject', requireAdmin, rejectWorkerApplication);

export default router;
