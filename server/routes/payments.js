import express from 'express';
import {
  getMyPayments,
  getAllPayments,
  mockCheckout,
  getInvoice
} from '../controllers/paymentController.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/my', getMyPayments);
router.post('/mock-checkout', mockCheckout);
router.get('/:id/invoice', getInvoice);

// Admin
router.get('/', requireAdmin, getAllPayments);

export default router;
