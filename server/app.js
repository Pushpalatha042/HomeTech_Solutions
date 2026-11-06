import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import categoryRoutes from './routes/categories.js';
import workerApplicationRoutes from './routes/workerApplications.js';
import workerRoutes from './routes/workers.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import trackingRoutes from './routes/tracking.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import complaintRoutes from './routes/complaints.js';
import workRequestRoutes from './routes/workRequests.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static serving for uploaded photos
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', app: 'HomeTech Solutions API', timestamp: new Date() })
);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/worker-applications', workerApplicationRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/work-requests', workRequestRoutes);

// 404 Handler
app.use((req, res) =>
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` })
);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'That record already exists.' });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid record identifier.' });
  if (err.name === 'MulterError') return res.status(400).json({ message: err.message });
  if (err.message && (err.message.includes('supported') || err.message.includes('image formats'))) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: 'Internal Server Error. Please try again.' });
});

export default app;
