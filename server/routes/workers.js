import express from 'express';
import {
  getWorkerJobs,
  getWorkerRequests,
  getWorkerAcceptedJobs,
  getWorkerOngoingJobs,
  getWorkerJobHistory,
  getWorkerServiceHistory,
  getWorkerServiceHistoryDetail,
  getWorkerProfile,
  toggleAvailability,
  acceptJob,
  rejectJob,
  updateJobStatus,
  submitAdditionalCategoryApplication,
  getMyAdditionalCategoryApplications,
  getAdditionalCategoryApplicationById
} from '../controllers/workerController.js';
import { verifyToken, requireApprovedWorker } from '../middleware/auth.js';

const router = express.Router();

// All worker routes require approved worker status
router.use(verifyToken, requireApprovedWorker);

router.get('/service-history', getWorkerServiceHistory);
router.get('/service-history/:id', getWorkerServiceHistoryDetail);
router.get('/history', getWorkerServiceHistory);
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

// Additional Service Category Applications
router.post('/additional-categories', submitAdditionalCategoryApplication);
router.get('/additional-categories/my', getMyAdditionalCategoryApplications);
router.get('/additional-categories/:id', getAdditionalCategoryApplicationById);

export default router;
