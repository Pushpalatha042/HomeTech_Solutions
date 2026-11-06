import WorkerApplication from '../models/WorkerApplication.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import ServiceCategory from '../models/ServiceCategory.js';
import WorkRequest from '../models/WorkRequest.js';
import Review from '../models/Review.js';
import Complaint from '../models/Complaint.js';

// 1. Submit Worker Application (Customer -> Worker)
export async function submitWorkerApplication(req, res) {
  try {
    const userId = req.user._id;

    // Check if user already applied
    const existing = await WorkerApplication.findOne({ userId });
    if (existing && existing.applicationStatus === 'pending') {
      return res.status(400).json({
        message: 'You already have a pending worker application under review.'
      });
    }

    const {
      skills = [],
      selectedCategories = [],
      experience = 1,
      serviceLocation,
      address,
      professionalDescription,
      documents = []
    } = req.body;

    if (!selectedCategories || selectedCategories.length === 0) {
      return res.status(400).json({ message: 'Please select at least one work category.' });
    }
    if (!serviceLocation || !serviceLocation.trim()) {
      return res.status(400).json({ message: 'Service location is required.' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ message: 'Complete address is required.' });
    }
    if (!professionalDescription || !professionalDescription.trim()) {
      return res.status(400).json({ message: 'Professional description is required.' });
    }

    const application = await WorkerApplication.findOneAndUpdate(
      { userId },
      {
        $set: {
          fullName: req.user.name,
          phone: req.user.phone,
          email: req.user.email,
          profileImage: req.user.profileImage || '',
          skills: Array.isArray(skills) ? skills : [skills],
          selectedCategories: Array.isArray(selectedCategories) ? selectedCategories : [selectedCategories],
          experience: Number(experience) || 1,
          serviceLocation: serviceLocation.trim(),
          address: address.trim(),
          professionalDescription: professionalDescription.trim(),
          documents: Array.isArray(documents) ? documents : [],
          applicationStatus: 'pending',
          rejectionReason: '',
          reviewedBy: null,
          reviewedAt: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update user's workerStatus to pending
    await User.findByIdAndUpdate(userId, { $set: { workerStatus: 'pending' } });

    res.status(201).json({
      success: true,
      message: 'Your worker application has been submitted successfully for admin review.',
      application
    });
  } catch (err) {
    console.error('submitWorkerApplication error:', err);
    res.status(500).json({ message: 'Failed to submit worker application.' });
  }
}

// 2. Get My Worker Application Status
export async function getMyWorkerApplication(req, res) {
  try {
    const application = await WorkerApplication.findOne({ userId: req.user._id });
    res.json({
      application,
      workerStatus: req.user.workerStatus,
      roles: req.user.roles,
      approvedCategories: req.user.approvedCategories || []
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve application status.' });
  }
}

// 3. Admin: List All Worker Applications
export async function getAllWorkerApplications(req, res) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.applicationStatus = status;
    }
    const applications = await WorkerApplication.find(filter)
      .populate('userId', 'name email phone profileImage workerStatus')
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker applications.' });
  }
}

// 4. Admin: Approve Worker Application
export async function approveWorkerApplication(req, res) {
  try {
    const { id } = req.params;
    const { approvedCategories } = req.body;

    const application = await WorkerApplication.findById(id);
    if (!application) {
      return res.status(404).json({ message: 'Worker application not found.' });
    }

    const finalCategories = (approvedCategories && approvedCategories.length > 0)
      ? approvedCategories
      : application.selectedCategories;

    application.applicationStatus = 'approved';
    application.approvedCategories = finalCategories;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    application.rejectionReason = '';
    await application.save();

    // Upgrade User account: add 'worker' to roles, set workerStatus to 'approved'
    const user = await User.findById(application.userId);
    if (user) {
      if (!user.roles.includes('worker')) {
        user.roles.push('worker');
      }
      user.workerStatus = 'approved';
      user.approvedCategories = finalCategories;
      user.isAvailable = true;
      await user.save();
    }

    res.json({
      success: true,
      message: `Worker application approved with categories: ${finalCategories.join(', ')}`,
      application
    });
  } catch (err) {
    console.error('approveWorkerApplication error:', err);
    res.status(500).json({ message: 'Failed to approve application.' });
  }
}

// 5. Admin: Reject Worker Application
export async function rejectWorkerApplication(req, res) {
  try {
    const { id } = req.params;
    const { rejectionReason = 'Application does not meet current criteria.' } = req.body;

    const application = await WorkerApplication.findById(id);
    if (!application) {
      return res.status(404).json({ message: 'Worker application not found.' });
    }

    application.applicationStatus = 'rejected';
    application.rejectionReason = rejectionReason;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    await User.findByIdAndUpdate(application.userId, {
      $set: { workerStatus: 'rejected' }
    });

    res.json({
      success: true,
      message: 'Worker application rejected.',
      application
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject application.' });
  }
}

// 5b. Worker: Submit Additional Category Application (POST /api/workers/additional-categories)
export async function submitAdditionalCategoryApplication(req, res) {
  try {
    const userId = req.user._id;

    // Verify worker is approved
    const user = await User.findById(userId);
    if (!user || !user.roles.includes('worker') || user.workerStatus !== 'approved') {
      return res.status(403).json({ message: 'Only approved workers can apply for additional service categories.' });
    }

    const {
      requestedCategories = [],
      experience = 1,
      skills = [],
      professionalDescription = '',
      documents = []
    } = req.body;

    if (!Array.isArray(requestedCategories) || requestedCategories.length === 0) {
      return res.status(400).json({ message: 'Please select at least one additional service category.' });
    }

    const currentApproved = user.approvedCategories || [];

    // Restriction 1: Do not allow selecting categories already approved
    const alreadyApproved = requestedCategories.filter((c) => currentApproved.includes(c));
    if (alreadyApproved.length > 0) {
      return res.status(400).json({
        message: `You already have the following category(ies) approved: ${alreadyApproved.join(', ')}.`
      });
    }

    // Restriction 2: Do not allow duplicate applications for the same category while an application is pending
    const pendingApps = await WorkerApplication.find({
      userId,
      applicationType: 'additional_category',
      applicationStatus: 'pending'
    });
    const pendingCategories = pendingApps.flatMap((a) => a.requestedCategories || a.selectedCategories || []);
    const duplicatePending = requestedCategories.filter((c) => pendingCategories.includes(c));
    if (duplicatePending.length > 0) {
      return res.status(400).json({
        message: `You already have a pending application under review for: ${duplicatePending.join(', ')}.`
      });
    }

    const application = await WorkerApplication.create({
      userId,
      fullName: user.name,
      phone: user.phone,
      email: user.email,
      profileImage: user.profileImage || '',
      applicationType: 'additional_category',
      currentCategories: currentApproved,
      requestedCategories,
      selectedCategories: requestedCategories,
      experience: Number(experience) || 1,
      skills: Array.isArray(skills) ? skills : (skills ? [skills] : []),
      professionalDescription: String(professionalDescription).trim(),
      documents: Array.isArray(documents) ? documents : [],
      applicationStatus: 'pending',
      adminNotes: '',
      rejectionReason: ''
    });

    const populatedApp = await WorkerApplication.findById(application._id)
      .populate('userId', 'name phone email profileImage approvedCategories');

    // Notify Admin via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('admin-tracking').emit('new-worker-application', populatedApp);
    }

    res.status(201).json({
      success: true,
      message: 'Your additional service category application has been submitted successfully for admin review.',
      application: populatedApp
    });
  } catch (err) {
    console.error('submitAdditionalCategoryApplication error:', err);
    res.status(500).json({ message: 'Failed to submit additional category application.' });
  }
}

// 5c. Worker: Get My Additional Category Applications (GET /api/workers/additional-categories/my)
export async function getMyAdditionalCategoryApplications(req, res) {
  try {
    const userId = req.user._id;
    const applications = await WorkerApplication.find({
      userId,
      applicationType: 'additional_category'
    })
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (err) {
    console.error('getMyAdditionalCategoryApplications error:', err);
    res.status(500).json({ message: 'Failed to fetch your applications.' });
  }
}

// 5d. Worker/Admin: Get Single Additional Application by ID (GET /api/workers/additional-categories/:id)
export async function getAdditionalCategoryApplicationById(req, res) {
  try {
    const { id } = req.params;
    const application = await WorkerApplication.findById(id)
      .populate('userId', 'name phone email profileImage approvedCategories')
      .populate('reviewedBy', 'name email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    // Ownership check: must be owner or admin
    if (application.userId?._id?.toString() !== req.user._id.toString() && req.user.activeRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied to this application.' });
    }

    res.json(application);
  } catch (err) {
    console.error('getAdditionalCategoryApplicationById error:', err);
    res.status(500).json({ message: 'Failed to fetch application details.' });
  }
}

// 5e. Admin: List All Additional Category Applications (GET /api/admin/worker-applications/additional)
export async function getAllAdditionalCategoryApplications(req, res) {
  try {
    const { status } = req.query;
    const filter = { applicationType: 'additional_category' };
    if (status && status !== 'all') {
      filter.applicationStatus = status;
    }

    const applications = await WorkerApplication.find(filter)
      .populate('userId', 'name phone email profileImage approvedCategories rating')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (err) {
    console.error('getAllAdditionalCategoryApplications error:', err);
    res.status(500).json({ message: 'Failed to fetch additional category applications.' });
  }
}

// 5f. Admin: Review (Approve / Reject) Additional Category Application (PUT /api/admin/worker-applications/:id/review-additional)
export async function reviewAdditionalCategoryApplication(req, res) {
  try {
    const { id } = req.params;
    const {
      action, // 'approve' | 'reject'
      approvedCategories = [],
      rejectedCategories = [],
      adminNotes = '',
      rejectionReason = ''
    } = req.body;

    const application = await WorkerApplication.findById(id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (action === 'approve') {
      const finalApproved = (approvedCategories && approvedCategories.length > 0)
        ? approvedCategories
        : (application.requestedCategories && application.requestedCategories.length > 0
            ? application.requestedCategories
            : application.selectedCategories);

      const finalRejected = rejectedCategories || (application.requestedCategories || []).filter(c => !finalApproved.includes(c));

      application.applicationStatus = (finalRejected.length === 0 || finalApproved.length === (application.requestedCategories || []).length)
        ? 'approved'
        : 'partially_approved';
      application.approvedCategories = finalApproved;
      application.rejectedCategories = finalRejected;
      application.adminNotes = adminNotes || 'Approved by administrator.';
      application.reviewedBy = req.user._id;
      application.reviewedAt = new Date();
      await application.save();

      // Add to Worker's approvedCategories in MongoDB
      const updatedUser = await User.findByIdAndUpdate(
        application.userId,
        { $addToSet: { approvedCategories: { $each: finalApproved } } },
        { new: true }
      );

      const io = req.app.get('io');
      if (io) {
        io.to('admin-tracking').emit('worker-application-updated', application);
        io.to(`worker:${application.userId}`).emit('category-application-reviewed', {
          applicationId: application._id,
          status: application.applicationStatus,
          approvedCategories: finalApproved,
          rejectedCategories: finalRejected,
          adminNotes: application.adminNotes,
          workerApprovedCategories: updatedUser?.approvedCategories || []
        });
      }

      return res.json({
        success: true,
        message: `Successfully approved categories: ${finalApproved.join(', ')}`,
        application,
        workerApprovedCategories: updatedUser?.approvedCategories || []
      });
    } else if (action === 'reject') {
      const reason = adminNotes || rejectionReason || 'Application does not meet current criteria.';
      application.applicationStatus = 'rejected';
      application.approvedCategories = [];
      application.rejectedCategories = application.requestedCategories || application.selectedCategories;
      application.rejectionReason = reason;
      application.adminNotes = reason;
      application.reviewedBy = req.user._id;
      application.reviewedAt = new Date();
      await application.save();

      const io = req.app.get('io');
      if (io) {
        io.to('admin-tracking').emit('worker-application-updated', application);
        io.to(`worker:${application.userId}`).emit('category-application-reviewed', {
          applicationId: application._id,
          status: 'rejected',
          rejectionReason: reason
        });
      }

      return res.json({
        success: true,
        message: 'Additional category application rejected.',
        application
      });
    } else {
      return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject".' });
    }
  } catch (err) {
    console.error('reviewAdditionalCategoryApplication error:', err);
    res.status(500).json({ message: 'Failed to review additional category application.' });
  }
}

// Helper to resolve worker's approved categories with fallback to WorkerApplication
export async function resolveWorkerCategories(user) {
  let cats = user.approvedCategories || [];
  if (!cats || cats.length === 0) {
    const app = await WorkerApplication.findOne({
      userId: user._id,
      applicationStatus: 'approved'
    });
    if (app) {
      cats = (app.approvedCategories && app.approvedCategories.length > 0)
        ? app.approvedCategories
        : (app.selectedCategories || []);
      if (cats.length > 0) {
        await User.findByIdAndUpdate(user._id, { $set: { approvedCategories: cats } });
      }
    }
  }
  return (cats || []).filter(Boolean);
}

// Helper to build robust category match conditions (case-insensitive & aliases)
export function buildCategoryQuery(cats) {
  if (!cats || cats.length === 0) return null;
  const conditions = [];
  cats.forEach((c) => {
    if (!c) return;
    const trimmed = c.trim();
    conditions.push(trimmed);
    conditions.push(new RegExp(`^${trimmed}$`, 'i'));
    const lower = trimmed.toLowerCase();
    if (lower === 'cleaning') conditions.push(/^home cleaning$/i);
    if (lower === 'home cleaning') conditions.push(/^cleaning$/i);
    if (lower === 'electrician') conditions.push(/^electrical repairs$/i, /^electrical$/i);
    if (lower === 'electrical repairs' || lower === 'electrical') conditions.push(/^electrician$/i);
  });
  return { $in: conditions };
}

// 6a. Worker: Get Work Requests Endpoint (GET /api/workers/jobs/requests)
export async function getWorkerRequests(req, res) {
  try {
    const workerId = req.user._id;

    // First check persistent WorkRequests
    const workRequests = await WorkRequest.find({
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
      .populate('serviceId', 'name price image category')
      .sort({ createdAt: -1 });

    if (workRequests.length > 0) {
      const active = workRequests
        .filter((wr) => wr.bookingId && ['Pending', 'Confirmed'].includes(wr.bookingId.status) && !wr.bookingId.workerId)
        .map((wr) => {
          const b = wr.bookingId.toObject ? wr.bookingId.toObject() : wr.bookingId;
          b.workRequestId = wr._id;
          return b;
        });
      return res.json(active);
    }

    // Fallback if no WorkRequest records exist yet
    const approvedCats = await resolveWorkerCategories(req.user);
    if (approvedCats.length === 0) {
      return res.json([]);
    }

    const catQuery = buildCategoryQuery(approvedCats);
    const availableRequests = await Booking.find({
      status: { $in: ['Pending', 'Confirmed'] },
      workerId: null,
      category: catQuery,
      rejectedWorkers: { $ne: workerId }
    })
      .populate('customerId', 'name phone email profileImage address')
      .populate('serviceId', 'name price image category')
      .sort({ createdAt: -1 });

    res.json(availableRequests);
  } catch (err) {
    console.error('getWorkerRequests error:', err);
    res.status(500).json({ message: 'Failed to fetch work requests.' });
  }
}

// 6b. Worker: Get Jobs (Strictly Category-Matched Work Requests & My Active Jobs)
export async function getWorkerJobs(req, res) {
  try {
    const workerId = req.user._id;

    // Check persistent WorkRequests
    const workRequests = await WorkRequest.find({
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
      .populate('serviceId', 'name price image category')
      .sort({ createdAt: -1 });

    let availableRequests = [];
    if (workRequests.length > 0) {
      availableRequests = workRequests
        .filter((wr) => wr.bookingId && ['Pending', 'Confirmed'].includes(wr.bookingId.status) && !wr.bookingId.workerId)
        .map((wr) => {
          const b = wr.bookingId.toObject ? wr.bookingId.toObject() : wr.bookingId;
          b.workRequestId = wr._id;
          return b;
        });
    } else {
      const approvedCats = await resolveWorkerCategories(req.user);
      if (approvedCats.length > 0) {
        const catQuery = buildCategoryQuery(approvedCats);
        availableRequests = await Booking.find({
          status: { $in: ['Pending', 'Confirmed'] },
          workerId: null,
          category: catQuery,
          rejectedWorkers: { $ne: workerId }
        })
          .populate('customerId', 'name phone email profileImage address')
          .populate('serviceId', 'name price image category')
          .sort({ createdAt: -1 });
      }
    }

    // Assigned/Active jobs assigned to this worker
    const assignedJobs = await Booking.find({
      workerId,
      status: {
        $in: [
          'Assigned', 'assigned',
          'Accepted', 'accepted',
          'Awaiting Arrival Verification', 'awaiting-arrival-verification',
          'In Progress', 'in-progress', 'in_progress'
        ]
      }
    })
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category')
      .sort({ scheduledDate: 1, bookingDate: 1, createdAt: -1 });

    // Completed jobs
    const completedJobs = await Booking.find({
      workerId,
      status: { $in: ['Completed', 'completed', 'Cancelled', 'cancelled'] }
    })
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category')
      .sort({ completedAt: -1, updatedAt: -1 });

    res.json({
      availableRequests,
      assignedJobs,
      completedJobs,
      requests: availableRequests,
      accepted: assignedJobs.filter((j) => ['Accepted', 'accepted', 'Awaiting Arrival Verification', 'awaiting-arrival-verification', 'Assigned', 'assigned'].includes(j.status)),
      ongoing: assignedJobs.filter((j) => ['In Progress', 'in-progress', 'in_progress'].includes(j.status)),
      history: completedJobs
    });
  } catch (err) {
    console.error('getWorkerJobs error:', err);
    res.status(500).json({ message: 'Failed to fetch worker jobs.' });
  }
}

// 6c. Worker: Get Accepted Jobs (GET /api/workers/jobs/accepted)
export async function getWorkerAcceptedJobs(req, res) {
  try {
    const workerId = req.user._id;
    const acceptedJobs = await Booking.find({
      workerId,
      status: { $in: ['Accepted', 'Awaiting Arrival Verification', 'Assigned'] }
    })
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category description')
      .sort({ scheduledDate: 1, bookingDate: 1, createdAt: -1 });

    res.json(acceptedJobs);
  } catch (err) {
    console.error('getWorkerAcceptedJobs error:', err);
    res.status(500).json({ message: 'Failed to fetch accepted jobs.' });
  }
}

// 6d. Worker: Get Ongoing Jobs (GET /api/workers/jobs/ongoing)
export async function getWorkerOngoingJobs(req, res) {
  try {
    const workerId = req.user._id;
    const ongoingJobs = await Booking.find({
      workerId,
      status: 'In Progress'
    })
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category description')
      .sort({ startedAt: -1, updatedAt: -1 });

    res.json(ongoingJobs);
  } catch (err) {
    console.error('getWorkerOngoingJobs error:', err);
    res.status(500).json({ message: 'Failed to fetch ongoing jobs.' });
  }
}

// 6e. Worker: Get Job History (GET /api/workers/jobs/history)
export async function getWorkerJobHistory(req, res) {
  try {
    const workerId = req.user._id;
    const historyJobs = await Booking.find({
      workerId,
      status: { $in: ['Completed', 'Cancelled'] }
    })
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category description')
      .sort({ completedAt: -1, updatedAt: -1 });

    res.json(historyJobs);
  } catch (err) {
    console.error('getWorkerJobHistory error:', err);
    res.status(500).json({ message: 'Failed to fetch worker job history.' });
  }
}

// 6f. Worker: Service History with Search, Filter & Pagination (GET /api/worker/service-history)
export async function getWorkerServiceHistory(req, res) {
  try {
    const workerId = req.user._id;
    const {
      search = '',
      category = '',
      date = '',
      startDate = '',
      endDate = '',
      sort = 'newest',
      page = 1,
      limit = 10
    } = req.query;

    // Base query: Strictly only completed jobs belonging to the authenticated worker
    const query = {
      workerId,
      status: { $regex: /^completed$/i }
    };

    // Filter by Service Category
    if (category && category !== 'All' && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    const andConditions = [];

    // Search by Booking ID or Customer Name
    if (search && search.trim()) {
      const searchTrimmed = search.trim();
      const matchingUsers = await User.find({
        name: { $regex: searchTrimmed, $options: 'i' }
      }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);

      andConditions.push({
        $or: [
          { bookingId: { $regex: searchTrimmed, $options: 'i' } },
          { customerId: { $in: userIds } }
        ]
      });
    }

    // Filter by Completion Date
    if (date && date.trim()) {
      const d = new Date(date.trim());
      if (!isNaN(d.getTime())) {
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);
        andConditions.push({
          $or: [
            { completedAt: { $gte: startOfDay, $lte: endOfDay } },
            { updatedAt: { $gte: startOfDay, $lte: endOfDay } }
          ]
        });
      }
    } else if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date('2099-12-31');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        andConditions.push({
          $or: [
            { completedAt: { $gte: start, $lte: end } },
            { updatedAt: { $gte: start, $lte: end } }
          ]
        });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Sorting: newest first (default) vs oldest first
    const sortOrder = sort === 'oldest' ? 1 : -1;
    const sortQuery = { completedAt: sortOrder, updatedAt: sortOrder, createdAt: sortOrder };

    // Counts
    const total = await Booking.countDocuments(query);
    const totalCompleted = await Booking.countDocuments({
      workerId,
      status: { $regex: /^completed$/i }
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const totalPages = Math.ceil(total / limitNum) || 1;
    const skip = (pageNum - 1) * limitNum;

    const bookings = await Booking.find(query)
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category description')
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Populate ratings and feedback from Review model
    const bookingIds = bookings.map((b) => b._id);
    const reviews = await Review.find({ bookingId: { $in: bookingIds } }).lean();
    const reviewMap = {};
    reviews.forEach((r) => {
      reviewMap[r.bookingId.toString()] = r;
    });

    // Populate worker complaints submitted for these bookings
    const complaints = await Complaint.find({
      bookingId: { $in: bookingIds },
      submittedBy: workerId,
      complaintType: 'worker'
    }).sort({ createdAt: -1 }).lean();

    const complaintsMap = {};
    complaints.forEach((c) => {
      const bKey = c.bookingId ? c.bookingId.toString() : '';
      if (!complaintsMap[bKey]) complaintsMap[bKey] = [];
      complaintsMap[bKey].push(c);
    });

    const enrichedServices = bookings.map((b) => {
      const rev = reviewMap[b._id.toString()];
      const bComplaints = complaintsMap[b._id.toString()] || [];
      return {
        ...b,
        rating: rev ? rev.rating : null,
        feedback: rev ? rev.comment : null,
        review: rev || null,
        complaints: bComplaints,
        complaint: bComplaints[0] || null,
        beforePhotos: b.problemPhotos || [],
        afterPhotos:
          b.completionPhotos && b.completionPhotos.length > 0
            ? b.completionPhotos
            : b.completedPhotos || []
      };
    });

    res.json({
      success: true,
      services: enrichedServices,
      total,
      totalCompleted,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (err) {
    console.error('getWorkerServiceHistory error:', err);
    res.status(500).json({ message: 'Failed to retrieve service history.' });
  }
}

// 6g. Worker: Get Single Completed Service Details (GET /api/worker/service-history/:id)
export async function getWorkerServiceHistoryDetail(req, res) {
  try {
    const workerId = req.user._id;
    const { id } = req.params;

    let query = {
      workerId,
      status: { $regex: /^completed$/i }
    };

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.bookingId = id;
    }

    const booking = await Booking.findOne(query)
      .populate('customerId', 'name phone email address profileImage')
      .populate('serviceId', 'name price image category description')
      .lean();

    if (!booking) {
      return res.status(404).json({ message: 'Completed service record not found or access unauthorized.' });
    }

    const review = await Review.findOne({ bookingId: booking._id }).lean();
    const complaints = await Complaint.find({
      bookingId: booking._id,
      submittedBy: workerId,
      complaintType: 'worker'
    }).sort({ createdAt: -1 }).lean();

    const serviceDetail = {
      ...booking,
      rating: review ? review.rating : null,
      feedback: review ? review.comment : null,
      review: review || null,
      complaints,
      complaint: complaints[0] || null,
      beforePhotos: booking.problemPhotos || [],
      afterPhotos:
        booking.completionPhotos && booking.completionPhotos.length > 0
          ? booking.completionPhotos
          : booking.completedPhotos || []
    };

    res.json({
      success: true,
      service: serviceDetail
    });
  } catch (err) {
    console.error('getWorkerServiceHistoryDetail error:', err);
    res.status(500).json({ message: 'Failed to retrieve service details.' });
  }
}

// 7. Worker: Accept Job Request (Atomic update to prevent race conditions)
export async function acceptJob(req, res) {
  try {
    const { id } = req.params;
    const workerId = req.user._id;

    // Check if id is a WorkRequest id
    let bookingId = id;
    let workReq = await WorkRequest.findById(id);
    if (workReq) {
      bookingId = workReq.bookingId;
    }

    // Atomic update: only succeeds if booking is still unassigned
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
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
      .populate('customerId', 'name phone email profileImage')
      .populate('serviceId', 'name price image');

    if (!booking) {
      if (workReq) {
        workReq.status = 'Cancelled';
        await workReq.save();
      }
      return res.status(409).json({
        message: 'This job request is no longer available or has already been accepted by another worker.'
      });
    }

    // Synchronize WorkRequests in MongoDB
    await WorkRequest.findOneAndUpdate(
      { bookingId: booking._id, workerId },
      { $set: { status: 'Accepted' } }
    );
    await WorkRequest.updateMany(
      { bookingId: booking._id, workerId: { $ne: workerId }, status: 'Pending' },
      { $set: { status: 'Cancelled' } }
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
      const custId = booking.customerId?._id || booking.customerId;
      if (custId) {
        io.to(`customer:${custId}`).emit('booking-status-updated', statusPayload);
        io.to(`customer_${custId}`).emit('booking-status-updated', statusPayload);
      }
      io.emit('booking-status-updated', statusPayload);

      // Tell other workers to remove this accepted request from their lists
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
      message: 'Job request accepted successfully.',
      booking
    });
  } catch (err) {
    console.error('acceptJob error:', err);
    res.status(500).json({ message: 'Failed to accept job.' });
  }
}

// 8. Worker: Reject Job Request
export async function rejectJob(req, res) {
  try {
    const { id } = req.params;
    const workerId = req.user._id;

    let bookingId = id;
    let workReq = await WorkRequest.findById(id);
    if (workReq) {
      bookingId = workReq.bookingId;
      workReq.status = 'Rejected';
      await workReq.save();
    } else {
      await WorkRequest.findOneAndUpdate(
        { bookingId: id, workerId },
        { $set: { status: 'Rejected' } }
      );
    }

    // Add this worker to rejectedWorkers so it will not appear again for them
    await Booking.findByIdAndUpdate(
      bookingId,
      { $addToSet: { rejectedWorkers: workerId } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Job request declined.',
      bookingId
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to decline job request.' });
  }
}

// 9. Worker: Update Job Status (e.g. Start Job -> In Progress)
export async function updateJobStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, completionNotes = '' } = req.body;
    const workerId = req.user._id;

    if (status === 'Completed' || status === 'completed') {
      return res.status(403).json({
        message: 'Workers cannot confirm job completion. Only the customer can confirm that the work has been completed.'
      });
    }

    if (!['In Progress', 'in-progress', 'Cancelled', 'cancelled'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status update. Worker can only start (In Progress) or cancel a job.'
      });
    }

    const booking = await Booking.findOne({ _id: id, workerId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or not assigned to you.' });
    }

    if (status === 'In Progress') {
      return res.status(400).json({
        message: 'Starting a job requires customer arrival OTP verification. Please verify the 6-digit arrival OTP provided by the customer.'
      });
    }

    booking.status = status;
    if (status === 'In Progress') {
      booking.startedAt = new Date();
    }
    if (completionNotes) booking.completionNotes = completionNotes;
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking._id,
        bookingReadableId: booking.bookingId,
        status: booking.status,
        startedAt: booking.startedAt,
        worker: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone
        }
      };
      io.to(`booking_${booking._id}`).emit('booking-status-updated', payload);
      io.to(`booking_${booking.bookingId}`).emit('booking-status-updated', payload);
      if (booking.customerId) {
        io.to(`customer:${booking.customerId}`).emit('booking-status-updated', payload);
        io.to(`customer_${booking.customerId}`).emit('booking-status-updated', payload);
      }
      io.emit('booking-status-updated', payload);
      io.to('admin-tracking').emit('admin-booking-updated', payload);
    }

    res.json({
      success: true,
      message: `Job started successfully! Booking status updated to ${status}.`,
      booking
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update job status.' });
  }
}

// 10. Worker: Toggle Availability
export async function toggleAvailability(req, res) {
  try {
    const { isAvailable } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { isAvailable: Boolean(isAvailable) } },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      isAvailable: user.isAvailable,
      message: `Availability updated to ${user.isAvailable ? 'Available' : 'Busy / Off-duty'}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle availability.' });
  }
}

// 11. Worker: Profile & Stats
export async function getWorkerProfile(req, res) {
  try {
    const workerId = req.user._id;
    const completedCount = await Booking.countDocuments({ workerId, status: { $regex: /^completed$/i } });
    const todayCount = await Booking.countDocuments({
      workerId,
      bookingDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    const completedBookings = await Booking.find({ workerId, status: { $regex: /^completed$/i } });
    const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const application = await WorkerApplication.findOne({ userId: workerId });
    const workerUser = await User.findById(workerId);

    res.json({
      worker: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        approvedCategories: req.user.approvedCategories,
        isAvailable: req.user.isAvailable,
        skills: application?.skills || [],
        experience: application?.experience || 1,
        serviceLocation: application?.serviceLocation || '',
        description: application?.professionalDescription || ''
      },
      stats: {
        todayJobs: todayCount,
        completedJobs: completedCount,
        totalEarnings,
        averageRating: workerUser?.rating || 4.8
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker profile.' });
  }
}
