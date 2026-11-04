import express from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService
} from '../controllers/serviceController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getServices);
router.get('/:id', getServiceById);
router.post('/', verifyToken, requireAdmin, createService);
router.put('/:id', verifyToken, requireAdmin, updateService);
router.delete('/:id', verifyToken, requireAdmin, deleteService);

export default router;
