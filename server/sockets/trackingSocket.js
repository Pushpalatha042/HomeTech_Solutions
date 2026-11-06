import WorkerLocation from '../models/WorkerLocation.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

export function initializeTrackingSocket(io) {
  io.on('connection', (socket) => {
    // Join customer-specific notifications room
    socket.on('join-customer-room', ({ customerId }) => {
      if (!customerId) return;
      socket.join(`customer:${customerId}`);
      socket.join(`customer_${customerId}`);
      console.log(`[Socket] Customer joined room: customer:${customerId}`);
    });

    socket.on('join-customer', (customerId) => {
      if (!customerId) return;
      socket.join(`customer:${customerId}`);
      socket.join(`customer_${customerId}`);
      console.log(`[Socket] Customer joined room: customer:${customerId}`);
    });

    // Join worker-specific notifications room (Requirement 7)
    socket.on('join-worker-room', ({ workerId }) => {
      if (!workerId) return;
      socket.join(`worker:${workerId}`);
      socket.join(`worker_${workerId}`);
    });

    socket.on('join-worker', (workerId) => {
      if (!workerId) return;
      socket.join(`worker:${workerId}`);
      socket.join(`worker_${workerId}`);
    });

    // Join customer or worker tracking room for a specific booking
    socket.on('join-tracking', async ({ bookingId, userId, role }) => {
      if (!bookingId) return;

      // Join primary room variations
      socket.join(`booking:${bookingId}`);
      socket.join(`booking_${bookingId}`);

      try {
        // Resolve booking to join both ObjectId and human-readable ID rooms
        let query = { _id: bookingId };
        if (typeof bookingId === 'string' && !bookingId.match(/^[0-9a-fA-F]{24}$/)) {
          query = { bookingId };
        }
        const booking = await Booking.findOne(query);
        if (booking) {
          const bIdStr = booking._id.toString();
          const bReadable = booking.bookingId;
          socket.join(`booking:${bIdStr}`);
          socket.join(`booking:${bReadable}`);
          socket.join(`booking_${bIdStr}`);
          socket.join(`booking_${bReadable}`);

          // If latest location exists, send it immediately to this newly joined socket
          let latestLoc = await WorkerLocation.findOne({ bookingId: booking._id });
          if (!latestLoc && booking.workerLocation?.latitude != null) {
            latestLoc = booking.workerLocation;
          }

          if (latestLoc && latestLoc.latitude != null) {
            const initialPayload = {
              bookingId: bIdStr,
              bookingReadableId: bReadable,
              workerId: booking.workerId,
              latitude: Number(latestLoc.latitude),
              longitude: Number(latestLoc.longitude),
              accuracy: Number(latestLoc.accuracy) || 0,
              heading: Number(latestLoc.heading) || 0,
              speed: Number(latestLoc.speed) || 0,
              lastUpdated: latestLoc.lastUpdated || new Date()
            };
            socket.emit('worker_location_updated', initialPayload);
            socket.emit('location-updated', initialPayload);
          }
        }
      } catch (err) {
        console.warn('[Socket] join-tracking room lookup:', err.message);
      }
    });

    // Leave tracking room
    socket.on('leave-tracking', async ({ bookingId }) => {
      if (!bookingId) return;
      socket.leave(`booking:${bookingId}`);
      socket.leave(`booking_${bookingId}`);
      try {
        let query = { _id: bookingId };
        if (typeof bookingId === 'string' && !bookingId.match(/^[0-9a-fA-F]{24}$/)) {
          query = { bookingId };
        }
        const b = await Booking.findOne(query).select('_id bookingId');
        if (b) {
          socket.leave(`booking:${b._id.toString()}`);
          socket.leave(`booking:${b.bookingId}`);
          socket.leave(`booking_${b._id.toString()}`);
          socket.leave(`booking_${b.bookingId}`);
        }
      } catch (e) {}
    });

    // Join admin live-tracking room
    socket.on('join-admin-tracking', () => {
      socket.join('admin-tracking');
    });

    // Worker broadcasts location update (supports both naming styles)
    const handleWorkerLocationUpdate = async (data) => {
      try {
        const { bookingId, workerId, latitude, longitude, accuracy, heading, speed } = data;
        if (!bookingId || latitude == null || longitude == null) return;

        const numLat = Number(latitude);
        const numLng = Number(longitude);
        if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) return;
        console.log('[GPS] Coordinates received');

        let query = { _id: bookingId };
        if (typeof bookingId === 'string' && !bookingId.match(/^[0-9a-fA-F]{24}$/)) {
          query = { bookingId };
        }

        const booking = await Booking.findOne(query);
        if (!booking) return;

        // Verify status is Accepted or in-progress
        if (!['Accepted', 'accepted', 'In Progress', 'in-progress', 'in_progress'].includes(booking.status)) return;

        const resolvedWorkerId = workerId || booking.workerId;
        const now = new Date();

        // 1. Update latest in WorkerLocation collection (no duplicate proliferation)
        const loc = await WorkerLocation.findOneAndUpdate(
          { bookingId: booking._id },
          {
            $set: {
              workerId: resolvedWorkerId,
              latitude: numLat,
              longitude: numLng,
              accuracy: Number(accuracy) || 0,
              heading: Number(heading) || 0,
              speed: Number(speed) || 0,
              lastUpdated: now
            }
          },
          { upsert: true, new: true }
        );

        // 2. Also cache directly on Booking model for instantaneous retrieval
        await Booking.findByIdAndUpdate(booking._id, {
          $set: {
            workerLocation: {
              latitude: numLat,
              longitude: numLng,
              accuracy: loc.accuracy,
              heading: loc.heading,
              speed: loc.speed,
              lastUpdated: now
            }
          }
        });
        console.log('[GPS] Coordinates saved to MongoDB');

        const updatePayload = {
          bookingId: booking._id.toString(),
          bookingReadableId: booking.bookingId,
          workerId: resolvedWorkerId,
          latitude: numLat,
          longitude: numLng,
          accuracy: loc.accuracy,
          heading: loc.heading,
          speed: loc.speed,
          lastUpdated: now
        };

        // Broadcast to both colon and underscore room names
        const bIdStr = booking._id.toString();
        const bRead = booking.bookingId;

        io.to(`booking:${bIdStr}`).emit('worker_location_updated', updatePayload);
        io.to(`booking:${bRead}`).emit('worker_location_updated', updatePayload);
        io.to(`booking_${bIdStr}`).emit('worker_location_updated', updatePayload);
        io.to(`booking_${bRead}`).emit('worker_location_updated', updatePayload);

        io.to(`booking:${bIdStr}`).emit('location-updated', updatePayload);
        io.to(`booking:${bRead}`).emit('location-updated', updatePayload);
        io.to(`booking_${bIdStr}`).emit('location-updated', updatePayload);
        io.to(`booking_${bRead}`).emit('location-updated', updatePayload);

        // Also broadcast to admin monitoring room
        io.to('admin-tracking').emit('admin-worker-location-updated', updatePayload);
        console.log('[SOCKET] Worker location broadcast');
      } catch (err) {
        console.error('[Socket] worker-location-update error:', err.message);
      }
    };

    socket.on('worker-location-update', handleWorkerLocationUpdate);
    socket.on('worker_location_update', handleWorkerLocationUpdate);

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });
}
