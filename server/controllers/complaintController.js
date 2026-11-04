import Complaint from '../models/Complaint.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

// Internal helper for complaint creation
async function handleComplaintCreation(req, res, forcedType = null) {
  try {
    const { bookingId, category, description, attachments = [] } = req.body;
    const userId = req.user._id;

    if (!bookingId || !category || !description) {
      return res.status(400).json({ message: 'Booking ID, category, and description are required.' });
    }

    // Lookup booking by _id or bookingId
    let query = { _id: bookingId };
    if (typeof bookingId === 'string' && !bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId };
    }

    const booking = await Booking.findOne(query)
      .populate('customerId', 'name email phone')
      .populate('workerId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ message: 'Associated booking not found.' });
    }

    const isCustomer = booking.customerId?._id?.toString() === userId.toString();
    const isWorker = booking.workerId?._id?.toString() === userId.toString();

    if (!isCustomer && !isWorker) {
      return res.status(403).json({ message: 'You are neither the customer nor the assigned worker for this booking.' });
    }

    let complaintType = forcedType;
    if (!complaintType) {
      complaintType = isCustomer ? 'customer' : 'worker';
    }

    if (complaintType === 'customer' && !isCustomer) {
      return res.status(403).json({ message: 'Only the customer can submit a customer complaint for this booking.' });
    }
    if (complaintType === 'worker' && !isWorker) {
      return res.status(403).json({ message: 'Only the assigned worker can submit a workplace complaint for this booking.' });
    }

    const complaintId = `CMP-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const complaint = await Complaint.create({
      complaintId,
      bookingId: booking._id,
      submittedBy: userId,
      customerId: booking.customerId?._id,
      workerId: booking.workerId?._id,
      complaintType,
      category,
      description: description.trim(),
      attachments: Array.isArray(attachments) ? attachments : [attachments].filter(Boolean),
      status: 'Submitted'
    });

    const populatedComplaint = await Complaint.findById(complaint._id)
      .populate('customerId', 'name phone email profileImage')
      .populate('workerId', 'name phone email profileImage')
      .populate('submittedBy', 'name phone email')
      .populate('bookingId', 'bookingId category serviceId status totalAmount address');

    // Notify Admin via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('admin-tracking').emit('new-complaint', populatedComplaint);
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully and forwarded to administrator for review.',
      complaint: populatedComplaint
    });
  } catch (err) {
    console.error('handleComplaintCreation error:', err);
    res.status(500).json({ message: 'Failed to submit complaint.' });
  }
}

// 1a. Submit General Complaint (Auto-detect customer vs worker)
export async function submitComplaint(req, res) {
  return handleComplaintCreation(req, res);
}

// 1b. Customer Complaint (POST /api/complaints/customer)
export async function submitCustomerComplaint(req, res) {
  return handleComplaintCreation(req, res, 'customer');
}

// 1c. Worker Complaint / Workplace Problem (POST /api/complaints/worker)
export async function submitWorkerComplaint(req, res) {
  return handleComplaintCreation(req, res, 'worker');
}

// 2. Get User's Complaints (Customer or Worker)
export async function getMyComplaints(req, res) {
  try {
    const userId = req.user._id;
    const complaints = await Complaint.find({
      $or: [
        { submittedBy: userId },
        { customerId: userId },
        { workerId: userId }
      ]
    })
      .populate('customerId', 'name phone email profileImage')
      .populate('workerId', 'name phone email profileImage')
      .populate('submittedBy', 'name phone email')
      .populate('bookingId', 'bookingId category status totalAmount address')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (err) {
    console.error('getMyComplaints error:', err);
    res.status(500).json({ message: 'Failed to fetch complaints.' });
  }
}

// 3. Get Complaints for a Specific Booking
export async function getBookingComplaints(req, res) {
  try {
    const { bookingId } = req.params;
    let query = { bookingId };
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      const b = await Booking.findOne({ bookingId }).select('_id');
      if (b) query = { bookingId: b._id };
    }

    const complaints = await Complaint.find(query)
      .populate('submittedBy', 'name phone')
      .populate('customerId', 'name')
      .populate('workerId', 'name')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking complaints.' });
  }
}

// 4. Admin: Get All Complaints with Filtering (GET /api/admin/complaints & GET /api/complaints/admin)
export async function getAdminComplaints(req, res) {
  try {
    const { type, status } = req.query;
    const filter = {};

    if (type && ['customer', 'worker'].includes(type)) {
      filter.complaintType = type;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const complaints = await Complaint.find(filter)
      .populate('customerId', 'name phone email profileImage')
      .populate('workerId', 'name phone email profileImage')
      .populate('submittedBy', 'name phone email activeRole')
      .populate('bookingId', 'bookingId category status totalAmount address bookingDate bookingTime')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (err) {
    console.error('getAdminComplaints error:', err);
    res.status(500).json({ message: 'Failed to fetch admin complaints.' });
  }
}

// 5. Admin / User: Get Single Complaint by ID (GET /api/admin/complaints/:id)
export async function getAdminComplaintById(req, res) {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { complaintId: id };
    }

    const complaint = await Complaint.findOne(query)
      .populate('customerId', 'name phone email profileImage')
      .populate('workerId', 'name phone email profileImage')
      .populate('submittedBy', 'name phone email activeRole')
      .populate('bookingId', 'bookingId category status totalAmount address bookingDate bookingTime');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    res.json(complaint);
  } catch (err) {
    console.error('getAdminComplaintById error:', err);
    res.status(500).json({ message: 'Failed to fetch complaint details.' });
  }
}

// 6. Admin: Update Complaint Status and Resolution Notes (PUT /api/admin/complaints/:id/status)
export async function updateComplaintStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, adminNotes = '' } = req.body;

    if (!['Submitted', 'Under Review', 'Resolved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid complaint status.' });
    }

    let complaint = await Complaint.findById(id);
    if (!complaint && !id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findOne({ complaintId: id });
    }

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    complaint.status = status;
    if (adminNotes !== undefined) {
      complaint.adminNotes = adminNotes;
    }

    if (['Resolved', 'Rejected'].includes(status)) {
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = req.user._id;
    }

    await complaint.save();

    const populatedComplaint = await Complaint.findById(complaint._id)
      .populate('customerId', 'name phone email profileImage')
      .populate('workerId', 'name phone email profileImage')
      .populate('submittedBy', 'name phone email')
      .populate('bookingId', 'bookingId category status');

    const io = req.app.get('io');
    if (io) {
      io.to('admin-tracking').emit('complaint-updated', populatedComplaint);
      io.to(`booking_${complaint.bookingId}`).emit('complaint-updated', populatedComplaint);
    }

    res.json({
      success: true,
      message: `Complaint marked as ${status}.`,
      complaint: populatedComplaint
    });
  } catch (err) {
    console.error('updateComplaintStatus error:', err);
    res.status(500).json({ message: 'Failed to update complaint status.' });
  }
}
