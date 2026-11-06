import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import ServiceCategory from '../models/ServiceCategory.js';
import User from '../models/User.js';
import WorkerApplication from '../models/WorkerApplication.js';
import WorkRequest from '../models/WorkRequest.js';
import Payment from '../models/Payment.js';
import Review from '../models/Review.js';
import { validatePhone } from '../utils/validators.js';

const OTP_SECRET = process.env.JWT_SECRET || 'hometech_default_secure_secret_key_2026';
const ENCRYPTION_KEY = crypto.scryptSync(OTP_SECRET, 'hometech_otp_salt', 32);

function hashOtp(otp) {
  return crypto.createHmac('sha256', OTP_SECRET).update(String(otp).trim()).digest('hex');
}

function encryptOtp(otp) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(String(otp), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptOtp(encryptedData) {
  if (!encryptedData || !encryptedData.includes(':')) return null;
  const [ivHex, cipherText] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(cipherText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper to build robust category match conditions
export function buildCategoryQueryConditions(categoryName) {
  if (!categoryName) return [];
  const trimmed = categoryName.trim();
  const conditions = [
    trimmed,
    new RegExp(`^${trimmed}$`, 'i')
  ];
  const lower = trimmed.toLowerCase();
  if (lower === 'cleaning' || lower === 'home cleaning') {
    conditions.push('Cleaning', 'Home Cleaning', /^cleaning$/i, /^home cleaning$/i);
  }
  if (lower === 'electrical' || lower === 'electrician' || lower === 'electrical repairs') {
    conditions.push('Electrical', 'Electrician', 'Electrical Repairs', /^electrical$/i, /^electrician$/i, /^electrical repairs$/i);
  }
  if (lower === 'plumbing' || lower === 'plumber') {
    conditions.push('Plumbing', 'Plumber', /^plumbing$/i, /^plumber$/i);
  }
  if (lower === 'carpentry' || lower === 'carpenter') {
    conditions.push('Carpentry', 'Carpenter', /^carpentry$/i, /^carpenter$/i);
  }
  if (lower === 'painting' || lower === 'painter') {
    conditions.push('Painting', 'Painter', /^painting$/i, /^painter$/i);
  }
  if (lower === 'ac repair' || lower === 'ac repair & service') {
    conditions.push('AC Repair', 'AC Repair & Service', /^ac repair$/i, /^ac repair & service$/i);
  }
  return conditions;
}

// Helper to find all eligible, approved, active and available workers
export async function findEligibleWorkersForCategory(categoryName) {
  // Synchronize any workers who have approved WorkerApplication records but unpopulated User.approvedCategories
  const approvedApps = await WorkerApplication.find({ applicationStatus: 'approved' });
  for (const app of approvedApps) {
    if (app.userId) {
      const cats = (app.approvedCategories && app.approvedCategories.length > 0)
        ? app.approvedCategories
        : (app.selectedCategories || []);
      if (cats.length > 0) {
        await User.findByIdAndUpdate(app.userId, {
          $addToSet: { roles: 'worker', approvedCategories: { $each: cats } },
          $set: { workerStatus: 'approved' }
        });
      }
    }
  }

  const conditions = buildCategoryQueryConditions(categoryName);

  const eligibleWorkers = await User.find({
    roles: 'worker',
    workerStatus: 'approved',
    isActive: true,
    isAvailable: true,
    approvedCategories: { $in: conditions }
  }).select('_id name phone email approvedCategories profileImage');

  return eligibleWorkers;
}

export async function createBooking(req, res) {
  try {
    console.log('[BOOKING] New booking received');
    console.log(`[BOOKING] Customer ID identified: ${req.user._id}`);

    const {
      serviceId,
      bookingDate,
      bookingTime,
      address,
      contactNumber,
      instructions = '',
      problemPhotos = []
    } = req.body;

    if (!serviceId) return res.status(400).json({ message: 'Please select a service.' });
    if (!bookingDate) return res.status(400).json({ message: 'Booking date is required.' });
    if (!bookingTime) return res.status(400).json({ message: 'Booking time slot is required.' });
    if (!address || !address.trim()) return res.status(400).json({ message: 'Service address is required.' });

    console.log(`[BOOKING] Service ID identified: ${serviceId}`);

    const phoneCheck = validatePhone(contactNumber || req.user.phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }

    // Process optional problem photos (from multipart upload or parsed JSON)
    let finalProblemPhotos = [];
    if (req.files && req.files.length > 0) {
      finalProblemPhotos = req.files.map((file) => ({
        url: `/uploads/problem-photos/${file.filename}`,
        publicId: file.filename,
        uploadedAt: new Date()
      }));
    } else if (problemPhotos) {
      try {
        const rawPhotos = typeof problemPhotos === 'string'
          ? JSON.parse(problemPhotos)
          : problemPhotos;
        if (Array.isArray(rawPhotos)) {
          finalProblemPhotos = rawPhotos.map((p) => ({
            url: typeof p === 'string' ? p : p.url,
            publicId: p.publicId || (typeof p === 'string' ? p.split('/').pop() : 'photo'),
            uploadedAt: p.uploadedAt ? new Date(p.uploadedAt) : new Date()
          })).filter((p) => p.url);
        }
      } catch (e) {
        console.warn('Failed to parse problemPhotos:', e.message);
      }
    }
    // Limit to 5 images maximum
    finalProblemPhotos = finalProblemPhotos.slice(0, 5);

    // Step 2: Verify service exists and is active
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Selected service not found.' });

    // Step 3: Retrieve actual service category from MongoDB
    let resolvedCategoryId = service.categoryId;
    if (!resolvedCategoryId) {
      const catDoc = await ServiceCategory.findOne({ name: new RegExp(`^${service.category.trim()}$`, 'i') });
      if (catDoc) resolvedCategoryId = catDoc._id;
    }

    console.log(`[BOOKING] Service category: ${service.category}`);

    const parsedDate = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedDate < today) {
      return res.status(400).json({ message: 'Booking date cannot be in the past.' });
    }

    const uniqueId = `HT-BKG-${Math.floor(100000 + Math.random() * 900000)}`;

    // Step 4: Save booking with status 'Pending'
    const newBooking = await Booking.create({
      bookingId: uniqueId,
      customerId: req.user._id,
      workerId: null,
      serviceId: service._id,
      category: service.category,
      categoryId: resolvedCategoryId,
      bookingDate: parsedDate,
      bookingTime,
      address: address.trim(),
      contactNumber: phoneCheck.cleanPhone,
      instructions: instructions.trim(),
      problemPhotos: finalProblemPhotos,
      totalAmount: service.price,
      status: 'Pending',
      paymentStatus: 'Pending'
    });

    console.log(`[BOOKING] Booking saved: ${newBooking.bookingId}`);

    const populated = await Booking.findById(newBooking._id)
      .populate('customerId', 'name email phone address profileImage')
      .populate('serviceId', 'name price image category description');

    // Step 5: Find all eligible approved workers in this category
    const eligibleWorkers = await findEligibleWorkersForCategory(service.category);
    console.log(`[WORKERS] Eligible workers found: ${eligibleWorkers.length}`);
    if (eligibleWorkers.length > 0) {
      console.log(`[WORKERS] Worker IDs matched: ${eligibleWorkers.map((w) => w._id).join(', ')}`);
    }

    // Step 6 & 7: Create a persistent WorkRequest record for every eligible worker
    const createdWorkRequests = [];
    for (const worker of eligibleWorkers) {
      try {
        const wr = await WorkRequest.findOneAndUpdate(
          { bookingId: newBooking._id, workerId: worker._id },
          {
            $setOnInsert: {
              bookingId: newBooking._id,
              customerId: req.user._id,
              serviceId: service._id,
              categoryId: resolvedCategoryId,
              category: service.category,
              workerId: worker._id,
              status: 'Pending'
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        createdWorkRequests.push(wr);
        console.log(`[WORK REQUEST] Created for worker: ${worker._id}`);
      } catch (err) {
        console.warn(`[WORK REQUEST] Failed to create record for worker ${worker._id}:`, err.message);
      }
    }
    console.log(`[WORK REQUEST] Total WorkRequest records created: ${createdWorkRequests.length}`);

    // Step 8: Send real-time notifications using Socket.IO
    const io = req.app.get('io');
    if (io) {
      // 1. Send to worker-specific rooms
      for (const wr of createdWorkRequests) {
        const payload = {
          workRequestId: wr._id,
          workRequest: wr,
          booking: populated,
          category: service.category,
          timestamp: new Date()
        };
        io.to(`worker:${wr.workerId}`).emit('new_work_request', payload);
        io.to(`worker_${wr.workerId}`).emit('new_work_request', payload);
      }

      // 2. Broadcast for general listeners and backward compatibility
      io.emit('new_work_request', {
        category: service.category,
        booking: populated,
        eligibleWorkerCount: eligibleWorkers.length
      });
      io.emit('new-job-request', {
        category: service.category,
        booking: populated,
        eligibleWorkerCount: eligibleWorkers.length
      });
      console.log('[SOCKET] Notification emitted');
    }

    // Step 9: Return booking result and eligible worker count
    const responseMsg = eligibleWorkers.length > 0
      ? `Booking created successfully! ${eligibleWorkers.length} matching service professional(s) have been notified.`
      : 'Booking created successfully. No matching workers are currently available; your request has been queued.';

    res.status(201).json({
      success: true,
      message: responseMsg,
      booking: populated,
      eligibleWorkerCount: eligibleWorkers.length,
      workRequestsCreated: createdWorkRequests.length
    });
  } catch (err) {
    console.error('createBooking error:', err);
    res.status(500).json({ message: 'Failed to create booking.' });
  }
}

export async function getMyBookings(req, res) {
  try {
    const bookings = await Booking.find({ customerId: req.user._id })
      .populate('workerId', 'name phone profileImage approvedCategories rating')
      .populate('serviceId', 'name price image category')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch your bookings.' });
  }
}

export async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query)
      .populate('customerId', 'name email phone address profileImage')
      .populate('workerId', 'name email phone approvedCategories profileImage rating')
      .populate('serviceId', 'name price image category description');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Authorization: customer, assigned worker, or admin
    const isCustomer = booking.customerId?._id?.toString() === req.user._id.toString();
    const isAssignedWorker = booking.workerId?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');

    if (!isCustomer && !isAssignedWorker && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to view this booking.' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking details.' });
  }
}

export async function getAllBookings(req, res) {
  try {
    const { status, category, search } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'all') filter.category = category;

    if (search && search.trim()) {
      filter.$or = [
        { bookingId: new RegExp(search.trim(), 'i') },
        { address: new RegExp(search.trim(), 'i') },
        { contactNumber: new RegExp(search.trim(), 'i') }
      ];
    }

    const bookings = await Booking.find(filter)
      .populate('customerId', 'name email phone')
      .populate('workerId', 'name email phone approvedCategories')
      .populate('serviceId', 'name price image')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
}

export async function assignWorker(req, res) {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const worker = await User.findById(workerId);
    if (!worker || !worker.roles.includes('worker') || worker.workerStatus !== 'approved') {
      return res.status(400).json({ message: 'Selected user is not an approved worker.' });
    }

    // Category matching enforcement!
    if (!worker.approvedCategories.includes(booking.category)) {
      return res.status(400).json({
        message: `Worker "${worker.name}" is not approved for the "${booking.category}" category. Approved categories: [${worker.approvedCategories.join(', ')}]`
      });
    }

    booking.workerId = worker._id;
    booking.status = 'Assigned';
    await booking.save();

    const populated = await Booking.findById(id)
      .populate('customerId', 'name email phone')
      .populate('workerId', 'name email phone')
      .populate('serviceId', 'name price image');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id,
        bookingReadableId: booking.bookingId,
        status: 'Assigned',
        worker: { id: worker._id, name: worker.name, phone: worker.phone }
      };
      io.to(`booking_${booking._id}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', payload);
      io.to('admin-tracking').emit('admin-booking-updated', payload);
    }

    res.json({
      success: true,
      message: `Worker ${worker.name} assigned to booking ${booking.bookingId}.`,
      booking: populated
    });
  } catch (err) {
    console.error('assignWorker error:', err);
    res.status(500).json({ message: 'Failed to assign worker.' });
  }
}

export async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['Pending', 'Confirmed', 'Assigned', 'Accepted', 'In Progress', 'Completed', 'Cancelled', 'Rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    booking.status = status;
    if (status === 'Completed' || status === 'completed') {
      booking.paymentStatus = 'Paid';
      booking.completedAt = new Date();
    }
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id,
        bookingReadableId: booking.bookingId,
        status
      };
      io.to(`booking_${booking._id}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', payload);
      io.to('admin-tracking').emit('admin-booking-updated', payload);
    }

    res.json({ success: true, message: `Booking status updated to ${status}.`, booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update booking status.' });
  }
}

// 4a. Worker: Start Arrival Verification (POST /api/bookings/:id/start-verification)
export async function startArrivalVerification(req, res) {
  try {
    const { id } = req.params;
    const workerId = req.user._id;

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query)
      .populate('customerId', 'name email phone address profileImage')
      .populate('workerId', 'name email phone approvedCategories profileImage rating')
      .populate('serviceId', 'name price image category description');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (!booking.workerId || booking.workerId._id.toString() !== workerId.toString()) {
      return res.status(403).json({ message: 'You are not the assigned worker for this booking.' });
    }

    // Only allow starting verification if Accepted, Assigned, or already Awaiting Arrival Verification
    if (!['Accepted', 'Assigned', 'Awaiting Arrival Verification'].includes(booking.status)) {
      return res.status(400).json({
        message: `Arrival verification cannot be initiated for booking in '${booking.status}' status.`
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashOtp(rawOtp);
    const encryptedCode = encryptOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendCooldownUntil = new Date(Date.now() + 60 * 1000); // 60s cooldown

    booking.status = 'Awaiting Arrival Verification';
    booking.arrivalOtp = {
      codeHash,
      encryptedCode,
      expiresAt,
      resendCooldownUntil,
      attemptsCount: 0,
      isVerified: false,
      verifiedAt: null
    };

    await Booking.findByIdAndUpdate(booking._id, {
      $set: {
        status: 'Awaiting Arrival Verification',
        arrivalOtp: booking.arrivalOtp
      }
    });

    const io = req.app.get('io');
    if (io) {
      const custId = booking.customerId?._id || booking.customerId;
      const statusPayload = {
        bookingId: booking._id.toString(),
        bookingReadableId: booking.bookingId,
        status: 'Awaiting Arrival Verification',
        expiresAt,
        resendCooldownUntil,
        worker: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone,
          profileImage: req.user.profileImage
        }
      };

      // Notify customer room WITH the plain OTP
      const customerPayload = {
        ...statusPayload,
        otp: rawOtp,
        expiresAt,
        resendCooldownUntil,
        service: booking.serviceId?.name
      };
      if (custId) {
        io.to(`customer:${custId}`).emit('arrival-otp-generated', customerPayload);
        io.to(`customer_${custId}`).emit('arrival-otp-generated', customerPayload);
        io.to(`customer:${custId}`).emit('booking-status-updated', statusPayload);
        io.to(`customer_${custId}`).emit('booking-status-updated', statusPayload);
      }

      // Notify booking rooms and general listeners WITHOUT the OTP
      io.to(`booking_${booking._id}`).emit('booking-status-updated', statusPayload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', statusPayload);
      io.to(`booking:${booking._id}`).emit('booking-status-updated', statusPayload);
      io.to(`booking:${booking.bookingId}`).emit('booking-status-updated', statusPayload);
      io.emit('booking-status-updated', statusPayload);
      io.to('admin-tracking').emit('admin-booking-updated', statusPayload);
    }

    // Response to worker: DO NOT include rawOtp or encryptedCode
    res.json({
      success: true,
      message: 'Arrival OTP has been generated and sent to the customer. Please ask the customer for the 6-digit verification code.',
      bookingId: booking._id,
      bookingReadableId: booking.bookingId,
      status: 'Awaiting Arrival Verification',
      expiresAt
    });
  } catch (err) {
    console.error('startArrivalVerification error:', err);
    res.status(500).json({ message: 'Failed to initiate arrival verification.' });
  }
}

// 4b. Worker: Verify Arrival OTP (POST /api/bookings/:id/verify-arrival-otp)
export async function verifyArrivalOtp(req, res) {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const workerId = req.user._id;

    if (!otp || !String(otp).trim()) {
      return res.status(400).json({ message: 'Please provide the 6-digit arrival OTP.' });
    }

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (!booking.workerId || booking.workerId.toString() !== workerId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this booking.' });
    }

    if (booking.status !== 'Awaiting Arrival Verification') {
      return res.status(400).json({
        message: `Booking is currently in '${booking.status}' status, not awaiting arrival verification.`
      });
    }

    const otpData = booking.arrivalOtp;
    if (!otpData || !otpData.codeHash) {
      return res.status(400).json({ message: 'No active arrival OTP found. Please click Start Job to request OTP.' });
    }

    if (otpData.expiresAt && new Date() > new Date(otpData.expiresAt)) {
      return res.status(400).json({
        message: 'The arrival OTP has expired. Please ask the customer to click Resend OTP.'
      });
    }

    if (otpData.attemptsCount >= 5) {
      return res.status(429).json({
        message: 'Maximum OTP verification attempts exceeded (5/5). Please ask the customer to generate a new OTP.'
      });
    }

    const submittedHash = hashOtp(String(otp).trim());
    if (submittedHash !== otpData.codeHash) {
      const newAttempts = (booking.arrivalOtp?.attemptsCount || 0) + 1;
      booking.arrivalOtp.attemptsCount = newAttempts;
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { 'arrivalOtp.attemptsCount': newAttempts }
      });
      const remaining = Math.max(0, 5 - newAttempts);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining
      });
    }

    // Success! Update booking status to in-progress
    const now = new Date();
    booking.status = 'in-progress';
    booking.startedAt = now;
    booking.arrivalVerifiedAt = now;
    booking.arrivalOtp.isVerified = true;
    booking.arrivalOtp.verifiedAt = now;
    booking.arrivalOtp.codeHash = null;
    booking.arrivalOtp.encryptedCode = null;

    await Booking.findByIdAndUpdate(booking._id, {
      $set: {
        status: 'in-progress',
        startedAt: now,
        arrivalVerifiedAt: now,
        'arrivalOtp.isVerified': true,
        'arrivalOtp.verifiedAt': now,
        'arrivalOtp.codeHash': null,
        'arrivalOtp.encryptedCode': null
      }
    });

    const populated = await Booking.findById(booking._id)
      .populate('customerId', 'name email phone address profileImage')
      .populate('workerId', 'name email phone approvedCategories profileImage rating')
      .populate('serviceId', 'name price image category description');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id.toString(),
        bookingReadableId: booking.bookingId,
        status: 'in-progress',
        startedAt: now,
        arrivalVerifiedAt: now,
        booking: populated,
        worker: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone
        }
      };

      const custId = booking.customerId?._id || booking.customerId;
      if (custId) {
        io.to(`customer:${custId}`).emit('booking-status-updated', payload);
        io.to(`customer_${custId}`).emit('booking-status-updated', payload);
        io.to(`customer:${custId}`).emit('arrival-verified', payload);
        io.to(`customer_${custId}`).emit('arrival-verified', payload);
      }
      io.to(`worker:${workerId}`).emit('booking-status-updated', payload);
      io.to(`worker_${workerId}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking._id}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', payload);
      io.to(`booking:${booking._id}`).emit('booking-status-updated', payload);
      io.to(`booking:${booking.bookingId}`).emit('booking-status-updated', payload);
      io.emit('booking-status-updated', payload);
      io.to('admin-tracking').emit('admin-booking-updated', payload);
    }

    res.json({
      success: true,
      message: 'Arrival OTP verified successfully. Job is now In Progress.',
      booking: populated
    });
  } catch (err) {
    console.error('verifyArrivalOtp error:', err);
    res.status(500).json({ message: 'Failed to verify arrival OTP.' });
  }
}

// 4c. Customer: Get Arrival Verification OTP (GET /api/bookings/:id/arrival-verification)
export async function getArrivalVerification(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const isCustomer = booking.customerId.toString() === userId.toString();
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ message: 'Only the customer or admin can retrieve the arrival OTP.' });
    }

    if (booking.status !== 'Awaiting Arrival Verification') {
      return res.json({
        success: true,
        status: booking.status,
        isVerified: booking.arrivalOtp?.isVerified || false,
        verifiedAt: booking.arrivalOtp?.verifiedAt || booking.arrivalVerifiedAt,
        otp: null
      });
    }

    const otpData = booking.arrivalOtp;
    if (!otpData || !otpData.encryptedCode) {
      return res.json({
        success: true,
        status: booking.status,
        otp: null,
        message: 'No OTP generated yet.'
      });
    }

    const decrypted = decryptOtp(otpData.encryptedCode);
    res.json({
      success: true,
      status: booking.status,
      otp: decrypted,
      expiresAt: otpData.expiresAt,
      resendCooldownUntil: otpData.resendCooldownUntil,
      isVerified: otpData.isVerified || false
    });
  } catch (err) {
    console.error('getArrivalVerification error:', err);
    res.status(500).json({ message: 'Failed to retrieve arrival OTP.' });
  }
}

// 4d. Customer: Resend Arrival OTP (POST /api/bookings/:id/resend-arrival-otp)
export async function resendArrivalOtp(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query)
      .populate('customerId', 'name email phone address profileImage')
      .populate('workerId', 'name email phone approvedCategories profileImage rating')
      .populate('serviceId', 'name price image category description');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const isCustomer = booking.customerId._id.toString() === userId.toString();
    const isWorker = booking.workerId && booking.workerId._id.toString() === userId.toString();
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isCustomer && !isWorker && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to resend OTP for this booking.' });
    }

    if (booking.status !== 'Awaiting Arrival Verification') {
      return res.status(400).json({
        message: `Cannot resend OTP for booking with status '${booking.status}'.`
      });
    }

    // Check cooldown
    if (booking.arrivalOtp?.resendCooldownUntil && new Date() < new Date(booking.arrivalOtp.resendCooldownUntil)) {
      const waitSeconds = Math.ceil((new Date(booking.arrivalOtp.resendCooldownUntil).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        message: `Please wait ${waitSeconds}s before requesting a new OTP.`,
        cooldownSeconds: waitSeconds
      });
    }

    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashOtp(rawOtp);
    const encryptedCode = encryptOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const resendCooldownUntil = new Date(Date.now() + 60 * 1000);

    booking.arrivalOtp = {
      codeHash,
      encryptedCode,
      expiresAt,
      resendCooldownUntil,
      attemptsCount: 0,
      isVerified: false,
      verifiedAt: null
    };

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { arrivalOtp: booking.arrivalOtp }
    });

    const io = req.app.get('io');
    if (io) {
      const custId = booking.customerId?._id || booking.customerId;
      const statusPayload = {
        bookingId: booking._id.toString(),
        bookingReadableId: booking.bookingId,
        status: 'Awaiting Arrival Verification',
        expiresAt,
        resendCooldownUntil
      };
      const customerPayload = {
        ...statusPayload,
        otp: rawOtp,
        service: booking.serviceId?.name
      };

      if (custId) {
        io.to(`customer:${custId}`).emit('arrival-otp-generated', customerPayload);
        io.to(`customer_${custId}`).emit('arrival-otp-generated', customerPayload);
      }
    }

    // Only return the plain OTP to customer or admin, never to worker
    const responsePayload = {
      success: true,
      message: 'New arrival OTP has been generated successfully.',
      expiresAt,
      resendCooldownUntil
    };
    if (isCustomer || isAdmin) {
      responsePayload.otp = rawOtp;
    }

    res.json(responsePayload);
  } catch (err) {
    console.error('resendArrivalOtp error:', err);
    res.status(500).json({ message: 'Failed to resend arrival OTP.' });
  }
}

// Customer Confirms Completion (Requirement 4)
export async function confirmCompletion(req, res) {
  try {
    console.log('[COMPLETION] Request received');
    const { id } = req.params;
    const customerId = req.user._id;
    console.log('[COMPLETION] Customer authenticated');

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Only the customer who owns the booking can confirm completion
    if (booking.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({ message: 'Only the customer who placed this booking can confirm completion.' });
    }
    console.log('[COMPLETION] Booking ownership verified');

    // Prevent duplicate completion
    if (['completed', 'Completed'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking has already been confirmed as completed.' });
    }

    // Do not allow completion before worker has started the job
    const isStarted = ['in-progress', 'In Progress', 'in_progress'].includes(booking.status);
    if (!isStarted) {
      return res.status(400).json({
        message: 'Completion can only be confirmed after the worker has started the job (status: in-progress).'
      });
    }

    const now = new Date();
    booking.status = 'completed';
    booking.paymentStatus = 'Paid';
    booking.completedAt = now;
    await Booking.findByIdAndUpdate(booking._id, {
      $set: {
        status: 'completed',
        paymentStatus: 'Paid',
        completedAt: now
      }
    });
    console.log('[COMPLETION] Booking updated successfully');

    const populated = await Booking.findById(booking._id)
      .populate('customerId', 'name email phone address profileImage')
      .populate('workerId', 'name email phone approvedCategories profileImage rating')
      .populate('serviceId', 'name price image category description');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id.toString(),
        bookingReadableId: booking.bookingId,
        status: 'completed',
        completedAt: now,
        booking: populated
      };
      io.to(`booking:${booking._id.toString()}`).emit('booking-status-updated', payload);
      io.to(`booking:${booking.bookingId}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking._id.toString()}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', payload);
      if (booking.workerId) {
        io.to(`worker:${booking.workerId}`).emit('booking-status-updated', payload);
        io.to(`worker_${booking.workerId}`).emit('booking-status-updated', payload);
        io.to(`worker:${booking.workerId}`).emit('stop-tracking', { bookingId: booking._id.toString(), bookingReadableId: booking.bookingId });
        io.to(`worker_${booking.workerId}`).emit('stop-tracking', { bookingId: booking._id.toString(), bookingReadableId: booking.bookingId });
      }
      if (booking.customerId) {
        io.to(`customer:${booking.customerId}`).emit('booking-status-updated', payload);
        io.to(`customer_${booking.customerId}`).emit('booking-status-updated', payload);
      }
      io.emit('booking-status-updated', payload);
      io.emit('stop-tracking', { bookingId: booking._id.toString(), bookingReadableId: booking.bookingId });

      io.to(`booking:${booking._id.toString()}`).emit('stop-tracking', { bookingId: booking._id.toString() });
      io.to(`booking:${booking.bookingId}`).emit('stop-tracking', { bookingId: booking.bookingId });
      io.to(`booking_${booking._id.toString()}`).emit('stop-tracking', { bookingId: booking._id.toString() });
      io.to(`booking_${booking.bookingId}`).emit('stop-tracking', { bookingId: booking.bookingId });
      io.to('admin-tracking').emit('admin-booking-updated', payload);
    }

    res.json({
      success: true,
      message: 'Work completion confirmed successfully! Thank you for choosing HomeTech Solutions.',
      booking: populated || booking
    });
  } catch (err) {
    console.error('confirmCompletion error:', err);
    res.status(500).json({ message: 'Failed to confirm booking completion.' });
  }
}

// Customer Submits Star Rating & Review (Requirement 5)
export async function submitBookingReview(req, res) {
  try {
    const { id } = req.params;
    const { rating, comment = '' } = req.body;
    const customerId = req.user._id;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5 stars.' });
    }

    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Only customer who owns the booking can submit review
    if (booking.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({ message: 'Only the customer who booked this service can submit a rating.' });
    }

    // Must be completed
    if (booking.status !== 'Completed' && booking.status !== 'completed') {
      return res.status(400).json({ message: 'Ratings can only be submitted for completed bookings.' });
    }

    if (!booking.workerId) {
      return res.status(400).json({ message: 'No worker was assigned to this booking.' });
    }

    // Check for duplicate review
    const existing = await Review.findOne({ bookingId: booking._id });
    if (existing) {
      return res.status(409).json({ message: 'You have already submitted a review for this booking.' });
    }

    const review = await Review.create({
      bookingId: booking._id,
      customerId,
      workerId: booking.workerId,
      rating: numRating,
      comment: comment.trim(),
      serviceName: booking.category
    });

    // Update worker's average rating in MongoDB
    const allWorkerReviews = await Review.find({ workerId: booking.workerId });
    const totalRating = allWorkerReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = Number((totalRating / allWorkerReviews.length).toFixed(1));

    await User.findByIdAndUpdate(booking.workerId, {
      rating: avgRating,
      ratingCount: allWorkerReviews.length
    });

    const io = req.app.get('io');
    if (io) {
      io.to('admin-tracking').emit('new-review', {
        review,
        workerId: booking.workerId,
        newAverageRating: avgRating
      });
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for your rating! Your review has been recorded.',
      review,
      workerNewRating: avgRating
    });
  } catch (err) {
    console.error('submitBookingReview error:', err);
    res.status(500).json({ message: 'Failed to submit review.' });
  }
}

// Get Review for a Specific Booking
export async function getBookingReview(req, res) {
  try {
    const { id } = req.params;
    let query = { bookingId: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      const b = await Booking.findOne({ bookingId: id }).select('_id');
      if (b) query = { bookingId: b._id };
    }

    const review = await Review.findOne(query)
      .populate('customerId', 'name profileImage')
      .populate('workerId', 'name profileImage');

    res.json(review || null);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve booking review.' });
  }
}

export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const isCustomer = booking.customerId.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to cancel this booking.' });
    }

    if (booking.status === 'Completed' || booking.status === 'completed') {
      return res.status(400).json({ message: 'Completed bookings cannot be cancelled.' });
    }

    booking.status = 'Cancelled';
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled successfully.', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
}

// Upload Problem Photos (Pre-booking or Post-booking)
export async function uploadProblemPhotosHandler(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded.' });
    }
    const photos = req.files.map((file) => ({
      url: `/uploads/problem-photos/${file.filename}`,
      publicId: file.filename,
      uploadedAt: new Date()
    }));
    res.json({
      success: true,
      message: `${photos.length} problem photo(s) uploaded successfully.`,
      photos
    });
  } catch (err) {
    console.error('uploadProblemPhotosHandler error:', err);
    res.status(500).json({ message: 'Failed to upload problem photos.' });
  }
}

// Add Problem Photos to Existing Booking
export async function addProblemPhotosToBooking(req, res) {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const isCustomer = booking.customerId.toString() === req.user._id.toString();
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to add problem photos to this booking.' });
    }

    let newPhotos = [];
    if (req.files && req.files.length > 0) {
      newPhotos = req.files.map((file) => ({
        url: `/uploads/problem-photos/${file.filename}`,
        publicId: file.filename,
        uploadedAt: new Date()
      }));
    } else if (req.body.photos) {
      const rawPhotos = typeof req.body.photos === 'string' ? JSON.parse(req.body.photos) : req.body.photos;
      if (Array.isArray(rawPhotos)) {
        newPhotos = rawPhotos.map((p) => ({
          url: typeof p === 'string' ? p : p.url,
          publicId: p.publicId || (typeof p === 'string' ? p.split('/').pop() : 'photo'),
          uploadedAt: new Date()
        })).filter((p) => p.url);
      }
    }

    const combined = [...(booking.problemPhotos || []), ...newPhotos].slice(0, 5);
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { problemPhotos: combined }
    });

    const updatedBooking = await Booking.findById(booking._id);

    res.json({
      success: true,
      message: 'Problem photos updated successfully.',
      photos: combined,
      booking: updatedBooking
    });
  } catch (err) {
    console.error('addProblemPhotosToBooking error:', err);
    res.status(500).json({ message: 'Failed to update problem photos.' });
  }
}

// Upload & Add Completed Work Photos
export async function addCompletionPhotosToBooking(req, res) {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { bookingId: id };
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Customer who booked, assigned worker, or admin
    const isCustomer = booking.customerId.toString() === req.user._id.toString();
    const isWorker = booking.workerId && booking.workerId.toString() === req.user._id.toString();
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isCustomer && !isWorker && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to upload completion photos for this booking.' });
    }

    let newPhotos = [];
    if (req.files && req.files.length > 0) {
      newPhotos = req.files.map((file) => ({
        url: `/uploads/completion-photos/${file.filename}`,
        publicId: file.filename,
        uploadedAt: new Date()
      }));
    } else if (req.body.photos) {
      try {
        const rawPhotos = typeof req.body.photos === 'string'
          ? JSON.parse(req.body.photos)
          : req.body.photos;
        if (Array.isArray(rawPhotos)) {
          newPhotos = rawPhotos.map((p) => ({
            url: typeof p === 'string' ? p : p.url,
            publicId: p.publicId || (typeof p === 'string' ? p.split('/').pop() : 'photo'),
            uploadedAt: p.uploadedAt ? new Date(p.uploadedAt) : new Date()
          })).filter((p) => p.url);
        }
      } catch (e) {
        console.warn('Failed to parse completion photos:', e.message);
      }
    }

    if (newPhotos.length === 0) {
      return res.status(400).json({ message: 'Please select at least one valid image to upload.' });
    }

    const existing = booking.completionPhotos || booking.completedPhotos || [];
    const combined = [...existing, ...newPhotos].slice(0, 5);

    await Booking.findByIdAndUpdate(booking._id, {
      $set: {
        completionPhotos: combined,
        completedPhotos: combined
      }
    });

    const populated = await Booking.findById(booking._id)
      .populate('customerId', 'name email phone address profileImage')
      .populate('workerId', 'name email phone approvedCategories profileImage rating')
      .populate('serviceId', 'name price image category description');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id.toString(),
        bookingReadableId: booking.bookingId,
        completionPhotos: combined,
        completedPhotos: combined,
        booking: populated
      };
      io.to(`booking:${booking._id.toString()}`).emit('booking-photos-updated', payload);
      io.to(`booking_${booking._id.toString()}`).emit('booking-photos-updated', payload);
      io.to('admin-tracking').emit('admin-booking-updated', payload);
    }

    res.json({
      success: true,
      message: 'Completed work photos uploaded successfully.',
      photos: combined,
      booking: populated
    });
  } catch (err) {
    console.error('addCompletionPhotosToBooking error:', err);
    res.status(500).json({ message: 'Failed to upload completion photos.' });
  }
}

