import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
import app from './app.js';
import connectDB from './config/db.js';
import { initializeTrackingSocket } from './sockets/trackingSocket.js';

dotenv.config();

const port = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Make io accessible in Express routes
app.set('io', io);

// Initialize live tracking socket events
initializeTrackingSocket(io);

try {
  await connectDB();
  server.listen(port, () => {
    console.log(`Hometech API & Socket server running at http://localhost:${port}`);
  });
} catch (error) {
  console.error('Startup failed:', error.message);
  process.exit(1);
}
