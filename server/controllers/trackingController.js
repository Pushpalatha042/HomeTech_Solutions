import WorkerLocation from '../models/WorkerLocation.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

// 1. Get Live Tracking Data for a Specific Booking
export async function getBookingTracking(req, res) {
  try {
    const { bookingId } = req.params;

    let query = { _id: bookingId };
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId };
    }

    const booking = await Booking.findOne(query)
      .populate('customerId', 'name phone address profileImage')
      .populate('workerId', 'name phone profileImage approvedCategories rating')
      .populate('serviceId', 'name category price image');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Access control: customer, assigned worker, or admin
    const isCustomer = booking.customerId?._id?.toString() === req.user._id.toString();
    const isWorker = booking.workerId?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');

    if (!isCustomer && !isWorker && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to track this booking.' });
    }

    // Find latest location (WorkerLocation collection or cached on Booking)
    let latestLocation = await WorkerLocation.findOne({
      bookingId: booking._id
    });

    if (!latestLocation && booking.workerLocation?.latitude != null) {
      latestLocation = booking.workerLocation;
    }

    const workerObj = booking.workerId
      ? {
          id: booking.workerId._id,
          name: booking.workerId.name,
          phone: booking.workerId.phone,
          profileImage: booking.workerId.profileImage,
          categories: booking.workerId.approvedCategories
        }
      : null;

    if (!latestLocation || latestLocation.latitude == null || latestLocation.longitude == null) {
      return res.json({
        success: true,
        bookingId: booking.bookingId,
        bookingDbId: booking._id,
        status: booking.status,
        category: booking.category,
        serviceName: booking.serviceId?.name || booking.category,
        address: booking.address,
        worker: workerObj,
        location: null,
        currentLocation: null,
        message: 'Waiting for worker GPS location'
      });
    }

    // Calculate approximate ETA if location exists
    let etaMinutes = 15;
    if (latestLocation && latestLocation.speed > 5) {
      etaMinutes = Math.max(5, Math.round(15 - latestLocation.speed / 5));
    }

    const locData = {
      latitude: Number(latestLocation.latitude),
      longitude: Number(latestLocation.longitude),
      accuracy: Number(latestLocation.accuracy) || 0,
      heading: Number(latestLocation.heading) || 0,
      speed: Number(latestLocation.speed) || 0,
      lastUpdated: latestLocation.lastUpdated || new Date()
    };

    res.json({
      success: true,
      bookingId: booking.bookingId,
      bookingDbId: booking._id,
      status: booking.status,
      category: booking.category,
      serviceName: booking.serviceId?.name || booking.category,
      address: booking.address,
      scheduledDate: booking.bookingDate,
      timeSlot: booking.bookingTime,
      worker: workerObj,
      customer: {
        name: booking.customerId?.name,
        phone: booking.customerId?.phone,
        address: booking.address
      },
      location: locData,
      currentLocation: locData,
      etaMinutes
    });
  } catch (err) {
    console.error('getBookingTracking error:', err);
    res.status(500).json({ message: 'Failed to retrieve tracking information.' });
  }
}

// 2. Post Worker GPS Location Update via HTTP
export async function postWorkerLocation(req, res) {
  try {
    console.log('[GPS] Worker authenticated');
    const { bookingId } = req.params;
    const { latitude, longitude, accuracy = 10, heading = 0, speed = 0 } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: 'Latitude and Longitude are required.' });
    }

    const numLat = Number(latitude);
    const numLng = Number(longitude);
    if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
      return res.status(400).json({
        message: 'Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.'
      });
    }
    console.log('[GPS] Coordinates received');

    let query = { _id: bookingId };
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId };
    }

    const booking = await Booking.findOne(query);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    // Only the assigned worker can share location for this job
    if (!booking.workerId || booking.workerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this booking.' });
    }
    console.log('[GPS] Booking assignment verified');

    // Verify booking status is Accepted or In Progress
    if (!['Accepted', 'In Progress'].includes(booking.status)) {
      return res.status(400).json({
        message: `Tracking is only active for accepted or in-progress bookings. Current status: ${booking.status}`
      });
    }

    const now = new Date();

    // Update the latest location in MongoDB rather than creating unnecessary duplicates
    const updatedLoc = await WorkerLocation.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          workerId: req.user._id,
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

    // Cache on booking for instant retrieval
    booking.workerLocation = {
      latitude: numLat,
      longitude: numLng,
      accuracy: Number(accuracy) || 0,
      heading: Number(heading) || 0,
      speed: Number(speed) || 0,
      lastUpdated: now
    };
    await booking.save();
    console.log('[GPS] Coordinates saved to MongoDB');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id.toString(),
        bookingReadableId: booking.bookingId,
        workerId: req.user._id,
        workerName: req.user.name,
        latitude: numLat,
        longitude: numLng,
        accuracy: Number(accuracy) || 0,
        heading: Number(heading) || 0,
        speed: Number(speed) || 0,
        lastUpdated: now
      };

      // Broadcast to both format rooms
      io.to(`booking:${booking._id.toString()}`).emit('worker_location_updated', payload);
      io.to(`booking:${booking.bookingId}`).emit('worker_location_updated', payload);
      io.to(`booking_${booking._id.toString()}`).emit('worker_location_updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('worker_location_updated', payload);

      io.to(`booking:${booking._id.toString()}`).emit('location-updated', payload);
      io.to(`booking:${booking.bookingId}`).emit('location-updated', payload);
      io.to(`booking_${booking._id.toString()}`).emit('location-updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('location-updated', payload);

      io.to('admin-tracking').emit('admin-worker-location-updated', payload);
      console.log('[SOCKET] Worker location broadcast');
    }

    res.json({
      success: true,
      message: 'Location updated successfully.',
      location: updatedLoc
    });
  } catch (err) {
    console.error('postWorkerLocation error:', err);
    res.status(500).json({ message: 'Failed to record worker location.' });
  }
}

// 3. Admin: Get All Active Workers on Map
export async function getAdminLiveWorkers(req, res) {
  try {
    // Active bookings that are Accepted or In Progress
    const activeBookings = await Booking.find({
      status: { $in: ['Accepted', 'In Progress', 'Assigned'] },
      workerId: { $ne: null }
    })
      .populate('workerId', 'name phone profileImage approvedCategories')
      .populate('customerId', 'name phone address')
      .populate('serviceId', 'name price');

    const result = [];
    for (const b of activeBookings) {
      const latestLoc = await WorkerLocation.findOne({ bookingId: b._id }).sort({ lastUpdated: -1 });
      result.push({
        bookingId: b.bookingId,
        bookingDbId: b._id,
        status: b.status,
        category: b.category,
        serviceName: b.serviceId?.name,
        customerName: b.customerId?.name,
        customerAddress: b.address,
        worker: {
          id: b.workerId?._id,
          name: b.workerId?.name,
          phone: b.workerId?.phone,
          approvedCategories: b.workerId?.approvedCategories
        },
        location: latestLoc
          ? {
              latitude: latestLoc.latitude,
              longitude: latestLoc.longitude,
              accuracy: latestLoc.accuracy,
              heading: latestLoc.heading,
              speed: latestLoc.speed,
              lastUpdated: latestLoc.lastUpdated
            }
          : {
              // Default center location if no GPS ping yet
              latitude: 19.0760,
              longitude: 72.8777,
              lastUpdated: b.updatedAt
            }
      });
    }

    res.json(result);
  } catch (err) {
    console.error('getAdminLiveWorkers error:', err);
    res.status(500).json({ message: 'Failed to fetch active worker locations.' });
  }
}
