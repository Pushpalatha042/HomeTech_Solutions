import WorkRequest from '../models/WorkRequest.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import ServiceCategory from '../models/ServiceCategory.js';
import WorkerApplication from '../models/WorkerApplication.js';

// 1. Worker: Get My Pending Work Requests (GET /api/work-requests/my)
export async function getMyWorkRequests(req, res) {
  try {
    const workerId = req.user._id;
    console.log(`[WORK REQUEST] API called by worker: ${workerId}`);

    // Verify worker is approved
    if (!req.user.roles.includes('worker') || req.user.workerStatus !== 'approved') {
      return res.status(403).json({ message: 'Access requires an approved worker account.' });
    }

    // Retrieve WorkRequest documents associated with this worker
    const requests = await WorkRequest.find({
      workerId,
      status: 'Pending'
    })
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'customerId', select: 'name phone email profileImage address' },
          { path: 'serviceId', select: 'name price image category description' }
        ]
      })
      .populate('customerId', 'name phone email profileImage address')
      .populate('serviceId', 'name price image category description')
      .populate('categoryId', 'name icon')
      .sort({ createdAt: -1 });

    // Filter out requests whose bookings were already assigned to someone else or cancelled
    const validPendingRequests = [];
    for (const wr of requests) {
      if (!wr.bookingId) {
        wr.status = 'Cancelled';
        await wr.save();
        continue;
      }
      // If booking is already accepted by someone else or cancelled, cancel this WorkRequest
      if (wr.bookingId.workerId && wr.bookingId.workerId.toString() !== workerId.toString()) {
        wr.status = 'Cancelled';
        await wr.save();
        continue;
      }
      if (['Completed', 'Cancelled'].includes(wr.bookingId.status)) {
        wr.status = 'Cancelled';
        await wr.save();
        continue;
      }
      validPendingRequests.push(wr);
    }

    console.log(`[WORK REQUEST] WorkRequest records returned: ${validPendingRequests.length}`);
    res.json(validPendingRequests);
  } catch (err) {
    console.error('getMyWorkRequests error:', err);
    res.status(500).json({ message: 'Failed to fetch work requests.' });
  }
}

// 2. Worker: Accept Work Request (PUT /api/work-requests/:id/accept)
export async function acceptWorkRequest(req, res) {
  try {
    const { id } = req.params;
    const workerId = req.user._id;

    let wr = await WorkRequest.findById(id);
    if (!wr) {
      // Also allow lookup by bookingId if caller passes bookingId
      wr = await WorkRequest.findOne({ bookingId: id, workerId });
    }

    if (!wr) {
      return res.status(404).json({ message: 'Work request not found.' });
    }

    // Verify ownership
    if (wr.workerId.toString() !== workerId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to accept this work request.' });
    }

    // Verify request is still Pending
    if (wr.status !== 'Pending') {
      return res.status(400).json({ message: `This work request is already ${wr.status.toLowerCase()}.` });
    }

    // Atomically assign booking to this worker to prevent race conditions
    const booking = await Booking.findOneAndUpdate(
      {
        _id: wr.bookingId,
        status: { $in: ['Pending', 'Confirmed'] },
        workerId: null
      },
      {
        $set: {
          workerId,
          status: 'Accepted'
        }
      },
      { new: true }
    )
      .populate('customerId', 'name phone email profileImage address')
      .populate('serviceId', 'name price image category');

    if (!booking) {
      // Booking was already accepted by another worker or cancelled
      wr.status = 'Cancelled';
      await wr.save();
      return res.status(409).json({
        message: 'This job request is no longer available or has already been accepted by another worker.'
      });
    }

    // Mark this work request as Accepted
    wr.status = 'Accepted';
    await wr.save();

    // Cancel all other workers' pending requests for this same booking
    await WorkRequest.updateMany(
      {
        bookingId: wr.bookingId,
        _id: { $ne: wr._id },
        status: 'Pending'
      },
      {
        $set: { status: 'Cancelled' }
      }
    );

    // Notify customer and other workers via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const statusPayload = {
        bookingId: booking._id,
        bookingReadableId: booking.bookingId,
        status: 'Accepted',
        worker: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone,
          profileImage: req.user.profileImage
        }
      };

      io.to(`booking_${booking._id}`).emit('booking-status-updated', statusPayload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', statusPayload);
      io.to('admin-tracking').emit('admin-booking-updated', statusPayload);

      // Broadcast event so other workers remove this job from their dashboards immediately
      io.emit('job-accepted-elsewhere', {
        bookingId: booking._id,
        bookingReadableId: booking.bookingId,
        acceptedBy: workerId
      });
      io.emit('work_request_cancelled', {
        bookingId: booking._id,
        acceptedBy: workerId
      });
    }

    res.json({
      success: true,
      message: 'Work request accepted successfully.',
      booking,
      workRequest: wr
    });
  } catch (err) {
    console.error('acceptWorkRequest error:', err);
    res.status(500).json({ message: 'Failed to accept work request.' });
  }
}

// 3. Worker: Reject Work Request (PUT /api/work-requests/:id/reject)
export async function rejectWorkRequest(req, res) {
  try {
    const { id } = req.params;
    const workerId = req.user._id;

    let wr = await WorkRequest.findById(id);
    if (!wr) {
      wr = await WorkRequest.findOne({ bookingId: id, workerId });
    }

    if (!wr) {
      return res.status(404).json({ message: 'Work request not found.' });
    }

    // Verify ownership
    if (wr.workerId.toString() !== workerId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to decline this work request.' });
    }

    // Update status to Rejected
    wr.status = 'Rejected';
    await wr.save();

    // Add this worker to rejectedWorkers on the booking so it won't be re-offered
    await Booking.findByIdAndUpdate(wr.bookingId, {
      $addToSet: { rejectedWorkers: workerId }
    });

    res.json({
      success: true,
      message: 'Work request declined.',
      workRequestId: wr._id
    });
  } catch (err) {
    console.error('rejectWorkRequest error:', err);
    res.status(500).json({ message: 'Failed to decline work request.' });
  }
}
