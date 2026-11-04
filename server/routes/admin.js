import express from 'express';
import {
  getAdminDashboardStats,
  getAdminUsers,
  toggleUserStatus,
  getAdminWorkers,
  getAdminReports,
  getWorkDistributionDiagnostics
} from '../controllers/adminController.js';
import {
  getAdminComplaints,
  getAdminComplaintById,
  updateComplaintStatus
} from '../controllers/complaintController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get('/dashboard', getAdminDashboardStats);
router.get('/users', getAdminUsers);
router.put('/users/:id/status', toggleUserStatus);
router.get('/workers', getAdminWorkers);
router.get('/reports', getAdminReports);

// Admin Work Distribution Diagnostics (/api/admin/diagnostics/work-distribution)
router.get('/diagnostics/work-distribution', getWorkDistributionDiagnostics);

// Admin Complaints routes (/api/admin/complaints)
router.get('/complaints', getAdminComplaints);
router.get('/complaints/:id', getAdminComplaintById);
router.put('/complaints/:id/status', updateComplaintStatus);

export default router;
