import express from 'express';
import {
  getWorkerJobs,
  getWorkerRequests,
  getWorkerAcceptedJobs,
  getWorkerOngoingJobs,
  getWorkerJobHistory,
  getWorkerProfile,
  toggleAvailability,
  acceptJob,
  rejectJob,
  updateJobStatus
} from '../controllers/workerController.js';
import { verifyToken, requireApprovedWorker } from '../middleware/auth.js';

const router = express.Router();

// All worker routes require approved worker status
router.use(verifyToken, requireApprovedWorker);

router.get('/jobs/requests', getWorkerRequests);
router.get('/jobs/accepted', getWorkerAcceptedJobs);
router.get('/jobs/ongoing', getWorkerOngoingJobs);
router.get('/jobs/history', getWorkerJobHistory);
router.get('/jobs', getWorkerJobs);
router.get('/profile', getWorkerProfile);
router.put('/availability', toggleAvailability);
router.put('/jobs/:id/accept', acceptJob);
router.put('/jobs/:id/reject', rejectJob);
router.put('/jobs/:id/status', updateJobStatus);

export default router;
