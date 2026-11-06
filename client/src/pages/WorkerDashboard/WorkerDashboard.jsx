import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  TrendingUp,
  Star,
  MapPin,
  Play,
  Check,
  X,
  Radio,
  Power,
  RefreshCw,
  Phone,
  Clock,
  AlertCircle,
  AlertTriangle,
  Send,
  Navigation,
  ShieldAlert,
  Image as ImageIcon,
  Plus,
  PlusCircle,
  Layers,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import ServiceHistory from './ServiceHistory';
import WorkerComplaints from './WorkerComplaints';
import WorkerApplications from './WorkerApplications';
import api from '../../api';
import { getServiceImage, homeMaintenanceImg } from '../../assets/images';

const WORKER_COMPLAINT_CATEGORIES = [
  'Customer Misconduct',
  'Unsafe Workplace',
  'Payment Dispute',
  'Incorrect Service Information',
  'Unreasonable Additional Work',
  'Customer Not Available',
  'Incorrect Address',
  'Customer Providing Incorrect Address',
  'Access or Location Issue',
  'Poor Communication',
  'Other'
];

const DEFAULT_SERVICE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Carpentry',
  'Painting',
  'Appliance Repair',
  'AC Repair',
  'Pest Control',
  'Home Maintenance'
];

export default function WorkerDashboard({ initialTab }) {
  const { user, notify, switchRole } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const queryTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(initialTab || queryTab || 'dashboard');

  useEffect(() => {
    const qTab = new URLSearchParams(location.search).get('tab');
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (qTab) {
      setActiveTab(qTab);
    } else {
      setActiveTab('dashboard');
    }
  }, [location.search, initialTab]);
  const [profileData, setProfileData] = useState(null);
  const [jobsData, setJobsData] = useState({
    availableRequests: [],
    assignedJobs: [],
    completedJobs: []
  });
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable ?? true);

  // Automatic GPS Tracking State
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [lastCoords, setLastCoords] = useState(null);
  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ time: 0, lat: null, lng: null });

  // Arrival OTP Verification State
  const [arrivalOtpModalJob, setArrivalOtpModalJob] = useState(null);
  const [arrivalOtpInput, setArrivalOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Worker Complaints State (Booking-Specific Complaint Modal)
  const [complaintsList, setComplaintsList] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [bookingComplaintJob, setBookingComplaintJob] = useState(null);
  const [complaintForm, setComplaintForm] = useState({
    category: WORKER_COMPLAINT_CATEGORIES[0],
    description: '',
    attachment: ''
  });
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState('');

  // Additional Categories Application State (Feature 2)
  const [additionalApplications, setAdditionalApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [allCategoriesList, setAllCategoriesList] = useState(DEFAULT_SERVICE_CATEGORIES);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    requestedCategories: [],
    experience: 1,
    skills: '',
    professionalDescription: '',
    documents: []
  });
  const [submittingApply, setSubmittingApply] = useState(false);
  const [applyError, setApplyError] = useState('');

  const fetchWorkerData = async () => {
    setLoading(true);
    try {
      const [profRes, jobsRes, wrRes] = await Promise.allSettled([
        api.get('/workers/profile'),
        api.get('/workers/jobs'),
        api.get('/work-requests/my')
      ]);

      if (profRes.status === 'fulfilled') {
        setProfileData(profRes.value.data);
        setIsAvailable(profRes.value.data.worker?.isAvailable ?? true);
      }

      let available = [];
      let assigned = [];
      let completed = [];

      if (jobsRes.status === 'fulfilled') {
        available = jobsRes.value.data.availableRequests || [];
        assigned = jobsRes.value.data.assignedJobs || [];
        completed = jobsRes.value.data.completedJobs || [];
      }

      // If /work-requests/my returned WorkRequest records from MongoDB, format them
      if (wrRes.status === 'fulfilled' && Array.isArray(wrRes.value.data) && wrRes.value.data.length > 0) {
        available = wrRes.value.data.map((wr) => {
          const bookingObj = wr.bookingId && typeof wr.bookingId === 'object' ? wr.bookingId : {};
          return {
            _id: wr._id,
            workRequestId: wr._id,
            bookingMongoId: bookingObj._id || wr.bookingId,
            bookingId: bookingObj.bookingId || (wr.bookingId?.bookingId ? wr.bookingId.bookingId : `REQ-${wr._id.toString().slice(-6)}`),
            category: wr.category || bookingObj.category,
            serviceId: wr.serviceId || bookingObj.serviceId,
            customerId: wr.customerId || bookingObj.customerId,
            bookingDate: bookingObj.bookingDate || wr.createdAt,
            bookingTime: bookingObj.bookingTime || 'Scheduled Slot',
            address: bookingObj.address || 'Address provided upon acceptance',
            contactNumber: bookingObj.contactNumber || 'Contact provided upon acceptance',
            instructions: bookingObj.instructions || '',
            totalAmount: bookingObj.totalAmount || wr.serviceId?.price || 0,
            status: wr.status
          };
        });
      }

      setJobsData({
        availableRequests: available,
        assignedJobs: assigned,
        completedJobs: completed
      });
    } catch (err) {
      console.error(err);
      notify('Failed to load worker data.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerComplaints = async () => {
    setLoadingComplaints(true);
    try {
      let res;
      try {
        res = await api.get('/complaints/worker/my');
      } catch (e) {
        res = await api.get('/complaints/my');
      }
      setComplaintsList(res.data || []);
    } catch (err) {
      console.error('fetchWorkerComplaints error:', err);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const fetchAdditionalApplications = async () => {
    setLoadingApplications(true);
    try {
      const res = await api.get('/workers/additional-categories/my');
      setAdditionalApplications(res.data || []);
    } catch (err) {
      console.error('fetchAdditionalApplications error:', err);
    } finally {
      setLoadingApplications(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAllCategoriesList(res.data.map((c) => (typeof c === 'object' ? c.name : c)));
      }
    } catch (err) {
      console.error('fetchCategories error:', err);
    }
  };

  useEffect(() => {
    fetchWorkerData();
    fetchWorkerComplaints();
    fetchAdditionalApplications();
    fetchCategories();
  }, []);

  const handleOpenBookingComplaint = (job) => {
    setBookingComplaintJob(job);
    setComplaintError('');
    setComplaintForm({
      category: WORKER_COMPLAINT_CATEGORIES[0],
      description: '',
      attachment: ''
    });
  };

  const handleSubmitBookingComplaint = async (e) => {
    e.preventDefault();
    if (!bookingComplaintJob) return;
    setComplaintError('');

    if (!complaintForm.category || !complaintForm.category.trim()) {
      setComplaintError('Complaint category is required.');
      return;
    }
    if (!complaintForm.description || !complaintForm.description.trim()) {
      setComplaintError('Complaint description is required.');
      return;
    }

    setSubmittingComplaint(true);
    try {
      const payload = {
        bookingId: bookingComplaintJob._id,
        category: complaintForm.category.trim(),
        description: complaintForm.description.trim(),
        attachments: complaintForm.attachment ? [complaintForm.attachment.trim()] : []
      };

      const { data } = await api.post('/complaints/worker', payload);
      notify(data.message || 'Complaint submitted successfully!', 'success');
      setBookingComplaintJob(null);
      setComplaintForm({
        category: WORKER_COMPLAINT_CATEGORIES[0],
        description: '',
        attachment: ''
      });
      fetchWorkerComplaints();
      fetchWorkerData();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to submit complaint. Please try again.';
      setComplaintError(errMsg);
      notify(errMsg, 'danger');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleToggleCategorySelect = (categoryName) => {
    setApplyForm((prev) => {
      const current = prev.requestedCategories || [];
      const updated = current.includes(categoryName)
        ? current.filter((c) => c !== categoryName)
        : [...current, categoryName];
      return { ...prev, requestedCategories: updated };
    });
  };

  const handleSubmitApplyServices = async (e) => {
    e.preventDefault();
    setApplyError('');
    if (!applyForm.requestedCategories || applyForm.requestedCategories.length === 0) {
      setApplyError('Please select at least one additional category to apply for.');
      return;
    }

    setSubmittingApply(true);
    try {
      const payload = {
        requestedCategories: applyForm.requestedCategories,
        experience: Number(applyForm.experience) || 1,
        skills: applyForm.skills,
        professionalDescription: (applyForm.professionalDescription || '').trim()
      };

      const { data } = await api.post('/workers/additional-categories', payload);
      notify(data.message || 'Application submitted successfully for admin review!', 'success');
      setIsApplyModalOpen(false);
      setApplyForm({
        requestedCategories: [],
        experience: 1,
        skills: '',
        professionalDescription: '',
        documents: []
      });
      fetchAdditionalApplications();
      setActiveTab('applications');
      navigate('/worker/dashboard?tab=applications');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to submit application. Please try again.';
      setApplyError(errMsg);
      notify(errMsg, 'danger');
    } finally {
      setSubmittingApply(false);
    }
  };

  // Join worker-specific Socket.IO room (Requirement 7)
  useEffect(() => {
    if (socket && user?._id) {
      socket.emit('join-worker-room', { workerId: user._id });
      socket.emit('join-worker', user._id);
    }
  }, [socket, user?._id]);

  // Socket notification when new work requests arrive or jobs are accepted elsewhere
  useEffect(() => {
    if (!socket) return;
    const handleNewJob = (data) => {
      const userCats = (user?.approvedCategories || []).map((c) => (c || '').toLowerCase().trim());
      const jobCat = (data.category || '').toLowerCase().trim();
      const isMatch =
        !data.category ||
        userCats.includes(jobCat) ||
        (jobCat.includes('cleaning') && userCats.some((c) => c.includes('cleaning'))) ||
        (jobCat.includes('plumb') && userCats.some((c) => c.includes('plumb'))) ||
        (jobCat.includes('electr') && userCats.some((c) => c.includes('electr')));

      if (isMatch) {
        notify(`New ${data.category || 'service'} work request available!`, 'info');
        fetchWorkerData();
      }
    };

    const handleJobAcceptedElsewhere = (data) => {
      setJobsData((prev) => ({
        ...prev,
        availableRequests: prev.availableRequests.filter(
          (r) =>
            r._id !== data.bookingId &&
            r.workRequestId !== data.workRequestId &&
            r.bookingMongoId !== data.bookingId &&
            r.bookingId !== data.bookingReadableId
        )
      }));
    };

    socket.on('new_work_request', handleNewJob);
    socket.on('new-job-request', handleNewJob);
    socket.on('job-accepted-elsewhere', handleJobAcceptedElsewhere);
    socket.on('work_request_cancelled', handleJobAcceptedElsewhere);

    return () => {
      socket.off('new_work_request', handleNewJob);
      socket.off('new-job-request', handleNewJob);
      socket.off('job-accepted-elsewhere', handleJobAcceptedElsewhere);
      socket.off('work_request_cancelled', handleJobAcceptedElsewhere);
    };
  }, [socket, user]);

  // AUTOMATIC GPS TRACKING EFFECT (Requirement 1 & 2)
  // Whenever worker has an active job (Accepted or In Progress), start continuous tracking automatically
  useEffect(() => {
    const activeJobs = jobsData.assignedJobs.filter((j) =>
      ['Accepted', 'accepted', 'In Progress', 'in-progress', 'in_progress'].includes(j.status)
    );

    if (activeJobs.length === 0) {
      // No active jobs -> clear any active geolocation watcher
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      setGpsError(null);
      return;
    }

    // Active job exists: target the first active job
    const activeJob = activeJobs[0];

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device/browser.');
      return;
    }

    setGpsError(null);

    // Send coordinates with rate-limiting and threshold check
    const sendLocationUpdate = (pos) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      const now = Date.now();
      const last = lastSentRef.current;

      // Throttle: send if first reading OR at least 5s elapsed OR moved > 0.0001 deg (~10m)
      const timeDiff = now - last.time;
      const moved =
        last.lat == null ||
        Math.abs(latitude - last.lat) > 0.0001 ||
        Math.abs(longitude - last.lng) > 0.0001;

      if (timeDiff >= 5000 || moved) {
        lastSentRef.current = { time: now, lat: latitude, lng: longitude };
        setLastCoords({ latitude, longitude, time: new Date() });
        setGpsActive(true);
        setGpsError(null);

        // 1. Broadcast via Socket.IO
        if (socket) {
          const payload = {
            bookingId: activeJob._id,
            workerId: user?._id,
            latitude: Number(latitude),
            longitude: Number(longitude),
            accuracy: Number(accuracy) || 0,
            heading: Number(heading) || 0,
            speed: speed ? Number(speed) * 3.6 : 0
          };
          socket.emit('worker-location-update', payload);
          socket.emit('worker_location_update', payload);
        }

        // 2. Persist to API endpoint
        api.post(`/tracking/${activeJob._id}/location`, {
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracy: Number(accuracy) || 0,
          heading: Number(heading) || 0,
          speed: speed ? Number(speed) * 3.6 : 0
        }).catch((err) => {
          console.warn('Auto GPS post error:', err.message);
        });
      }
    };

    const handleGpsError = (err) => {
      console.warn('GPS location error:', err.code, err.message);
      if (err.code === 1) {
        // PERMISSION_DENIED
        setGpsError(
          'Location permission is required for customer tracking so customers can see your arrival. Please allow location access in your browser.'
        );
        setGpsActive(false);
      } else {
        // Timeout or Position Unavailable: retry with lower accuracy requirements (Wi-Fi / cell triangulation)
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          sendLocationUpdate,
          (err2) => {
            console.warn('GPS fallback error:', err2.message);
            setGpsError('Unable to retrieve precise GPS coordinates. Please ensure device location is turned on.');
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
        );
      }
    };

    // Initial position fetch
    navigator.geolocation.getCurrentPosition(sendLocationUpdate, handleGpsError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    });

    // Start continuous watching
    watchIdRef.current = navigator.geolocation.watchPosition(sendLocationUpdate, handleGpsError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [jobsData.assignedJobs, socket, user]);

  // Handle Accept Job (Supports both /work-requests/:id/accept and /workers/jobs/:id/accept)
  const handleAcceptJob = async (item) => {
    try {
      const targetId = typeof item === 'object' ? (item.workRequestId || item._id) : item;
      let res;
      try {
        res = await api.put(`/work-requests/${targetId}/accept`);
      } catch (wrErr) {
        const bookingId = typeof item === 'object' ? (item.bookingMongoId || item._id) : item;
        res = await api.put(`/workers/jobs/${bookingId}/accept`);
      }
      notify(res.data.message || 'Job request accepted successfully!', 'success');
      fetchWorkerData();
    } catch (err) {
      notify(err.response?.data?.message || 'Could not accept job.', 'danger');
    }
  };

  // Handle Reject Job (Supports both /work-requests/:id/reject and /workers/jobs/:id/reject)
  const handleRejectJob = async (item) => {
    try {
      const targetId = typeof item === 'object' ? (item.workRequestId || item._id) : item;
      let res;
      try {
        res = await api.put(`/work-requests/${targetId}/reject`);
      } catch (wrErr) {
        const bookingId = typeof item === 'object' ? (item.bookingMongoId || item._id) : item;
        res = await api.put(`/workers/jobs/${bookingId}/reject`);
      }
      notify(res.data.message || 'Job request declined.', 'info');
      fetchWorkerData();
    } catch (err) {
      notify('Failed to decline job.', 'danger');
    }
  };

  // Start Job with Arrival OTP Verification
  const handleStartJob = async (job) => {
    try {
      const jobId = job._id || job.bookingMongoId;
      if (job.status === 'Accepted') {
        const { data } = await api.post(`/bookings/${jobId}/start-verification`);
        notify(data.message || 'Arrival verification initiated. Ask customer for 6-digit code.', 'info');
      }
      setArrivalOtpModalJob(job);
      setArrivalOtpInput('');
      setOtpError('');
      fetchWorkerData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to start arrival verification.', 'danger');
    }
  };

  const handleVerifyArrivalOtp = async (e) => {
    e.preventDefault();
    if (!arrivalOtpModalJob) return;
    if (!arrivalOtpInput.trim()) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const jobId = arrivalOtpModalJob._id || arrivalOtpModalJob.bookingMongoId;
      const { data } = await api.post(`/bookings/${jobId}/verify-arrival-otp`, {
        otp: arrivalOtpInput.trim()
      });
      notify(data.message || 'Arrival verified! Job is now In Progress.', 'success');
      setArrivalOtpModalJob(null);
      setArrivalOtpInput('');
      fetchWorkerData();
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Verification failed. Please check the OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Toggle Availability
  const handleToggleAvailability = async () => {
    try {
      const nextVal = !isAvailable;
      const { data } = await api.put('/workers/availability', { isAvailable: nextVal });
      setIsAvailable(data.isAvailable);
      notify(data.message, 'info');
    } catch (err) {
      notify('Failed to update availability.', 'danger');
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'history') {
            navigate('/worker/dashboard?tab=history');
          } else {
            navigate('/worker/dashboard');
          }
        }}
      />

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* GPS Permission Warning Banner (Requirement 1) */}
        {gpsError && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertTriangle size={24} color="#dc2626" />
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#991b1b', fontSize: '14px' }}>
                Location Access Required for Live Tracking
              </strong>
              <p style={{ color: '#7f1d1d', fontSize: '13px', margin: '2px 0 0 0' }}>
                {gpsError}
              </p>
            </div>
          </div>
        )}

        {/* Automatic GPS Active Indicator Pill */}
        {gpsActive && lastCoords && (
          <div
            style={{
              backgroundColor: '#dcfce7',
              border: '1px solid #22c55e',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                  boxShadow: '0 0 8px #16a34a',
                  animation: 'pulse 1.5s infinite'
                }}
              />
              <strong style={{ color: '#166534', fontSize: '13px' }}>
                Automatic GPS Tracking Active
              </strong>
              <span style={{ color: '#15803d', fontSize: '12px' }}>
                • Sharing live location with customer (Lat: {lastCoords.latitude.toFixed(4)}, Lng:{' '}
                {lastCoords.longitude.toFixed(4)})
              </span>
            </div>
            <span style={{ color: '#15803d', fontSize: '11px', fontWeight: 600 }}>
              Updated: {lastCoords.time.toLocaleTimeString()}
            </span>
          </div>
        )}

        {activeTab === 'history' ? (
          <ServiceHistory
            onBackToDashboard={() => {
              setActiveTab('dashboard');
              navigate('/worker/dashboard');
            }}
            onRaiseComplaint={handleOpenBookingComplaint}
            complaintsList={complaintsList}
            onRefreshComplaints={fetchWorkerComplaints}
          />
        ) : activeTab === 'complaints' ? (
          <WorkerComplaints
            complaints={complaintsList}
            loading={loadingComplaints}
            onOpenComplaintModal={() => {
              if (jobsData.assignedJobs.length > 0) {
                handleOpenBookingComplaint(jobsData.assignedJobs[0]);
              } else {
                notify('Please select an active booking from your dashboard to raise a complaint.', 'info');
                setActiveTab('dashboard');
                navigate('/worker/dashboard');
              }
            }}
            onRefresh={fetchWorkerComplaints}
          />
        ) : activeTab === 'applications' ? (
          <WorkerApplications
            applications={additionalApplications}
            approvedCategories={user?.approvedCategories || []}
            loading={loadingApplications}
            onOpenApplyModal={() => {
              setApplyError('');
              setIsApplyModalOpen(true);
            }}
            onRefresh={fetchAdditionalApplications}
          />
        ) : (
          <>
            {/* Header with Availability and Category Pills */}
            <div
          className="card"
          style={{
            marginBottom: '28px',
            padding: '24px',
            background: 'var(--white)',
            borderLeft: '5px solid var(--accent-yellow)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src="/assets/images/avatar-worker.jpg"
              alt={user?.name || 'Worker'}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/images/electrical.jpg';
              }}
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--primary-navy)'
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-navy)', margin: 0 }}>
                  {user?.name || 'Service Professional'}
                </h1>
                <span className="badge badge-accepted">
                  <Star size={12} fill="#f59e0b" color="#f59e0b" /> {profileData?.stats?.averageRating || 5.0} ★
                </span>
                <span className="badge badge-completed">Certified Pro</span>
              </div>
              <p style={{ color: 'var(--secondary-text)', fontSize: '14px', marginTop: '4px' }}>
                Approved Trades:{' '}
                <strong style={{ color: 'var(--primary-navy)' }}>
                  {(user?.approvedCategories || []).join(', ') || 'General Services'}
                </strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-small"
              data-testid="apply-more-services-btn"
              onClick={() => {
                setApplyError('');
                setIsApplyModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Apply for additional service categories"
            >
              <PlusCircle size={14} />
              <span>Apply for More Services</span>
            </button>

            <button
              type="button"
              className={`btn ${isAvailable ? 'btn-success' : 'btn-outline'} btn-small`}
              onClick={handleToggleAvailability}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Power size={14} />
              <span>Status: {isAvailable ? 'Available for Jobs' : 'Offline / Busy'}</span>
            </button>

            <button
              type="button"
              className="btn btn-navy btn-small"
              onClick={async () => {
                const ok = await switchRole('customer');
                if (ok) navigate('/customer/dashboard');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Switch to Customer Dashboard"
            >
              <RefreshCw size={14} />
              <span>Switch to Customer</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-grid">
          <StatCard
            label="Today's Jobs"
            value={profileData?.stats?.todayJobs ?? 0}
            icon={CalendarDays}
          />
          <div
            onClick={() => {
              setActiveTab('history');
              navigate('/worker/dashboard?tab=history');
            }}
            style={{ cursor: 'pointer' }}
            title="Click to view Service History"
          >
            <StatCard
              label="Completed Jobs"
              value={profileData?.stats?.completedJobs ?? 0}
              icon={CheckCircle2}
            />
          </div>
          <StatCard
            label="Total Earnings"
            value={`₹${(profileData?.stats?.totalEarnings ?? 0).toLocaleString('en-IN')}`}
            icon={TrendingUp}
          />
          <StatCard
            label="Average Rating"
            value={`${profileData?.stats?.averageRating ?? 5.0} ★`}
            icon={Star}
            color="#f59e0b"
          />
        </div>

        {/* SECTION 1: New Category-Matched Job Requests */}
        <section className="card" style={{ marginBottom: '32px', padding: '24px' }}>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                New Job Requests ({jobsData.availableRequests.length})
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                Showing only requests matching your approved categories:{' '}
                {(user?.approvedCategories || []).join(', ')}
              </p>
            </div>
            <button className="btn btn-outline btn-small" onClick={fetchWorkerData}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {jobsData.availableRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--secondary-text)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <img
                src="/assets/images/home-maintenance.jpg"
                alt="No requests"
                style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)', opacity: 0.8 }}
              />
              <strong>No pending job requests matching your category right now.</strong>
              <span>New booking alerts will appear here automatically.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {jobsData.availableRequests.map((req) => (
                <div
                  key={req._id}
                  style={{
                    border: '1px solid var(--border-color)',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: '16px',
                    alignItems: 'center',
                    background: 'var(--bg-color)'
                  }}
                >
                  <img
                    src={getServiceImage(req.serviceId || req)}
                    alt={req.category}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = homeMaintenanceImg;
                    }}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: 'var(--radius-md)',
                      objectFit: 'cover'
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span className="badge badge-accepted" style={{ fontWeight: 800 }}>
                        {req.bookingId}
                      </span>
                      <span className="badge badge-pending">{req.category}</span>
                      <strong style={{ fontSize: '16px', color: 'var(--primary-navy)' }}>
                        {req.serviceId?.name || req.category}
                      </strong>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-navy)', marginLeft: 'auto' }}>
                        ₹{req.totalAmount}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--secondary-text)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <MapPin size={14} /> {req.address}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '2px' }}>
                      Customer: {req.customerId?.name} ({req.contactNumber}) • Scheduled: {new Date(req.bookingDate).toLocaleDateString('en-IN')} at {req.bookingTime}
                    </p>
                    {req.instructions && (
                      <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                        Note: "{req.instructions}"
                      </p>
                    )}

                    {/* Customer Problem Photos */}
                    {req.problemPhotos && req.problemPhotos.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ImageIcon size={12} /> Issue Photos ({req.problemPhotos.length}):
                        </span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {req.problemPhotos.map((p, idx) => (
                            <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer" title="View Problem Photo">
                              <img
                                src={p.url}
                                alt={`Problem ${idx + 1}`}
                                style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      data-testid={`accept-request-btn-${req._id}`}
                      className="btn btn-success btn-small accept-job-btn"
                      onClick={() => handleAcceptJob(req)}
                      style={{ padding: '8px 18px', fontWeight: 700 }}
                    >
                      <Check size={16} /> Accept
                    </button>
                    <button
                      data-testid={`reject-request-btn-${req._id}`}
                      className="btn btn-danger btn-small"
                      onClick={() => handleRejectJob(req)}
                      style={{ padding: '8px 14px' }}
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: Active / Assigned Jobs (Requirements 1, 3, 4, 7) */}
        <section className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '16px' }}>
            My Active & Ongoing Jobs ({jobsData.assignedJobs.length})
          </h3>

          {jobsData.assignedJobs.length === 0 ? (
            <p style={{ color: 'var(--secondary-text)', textAlign: 'center', padding: '24px' }}>
              You do not have any active accepted jobs right now. Accept available requests above to get started.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service & Customer</th>
                    <th>Schedule</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsData.assignedJobs.map((job) => (
                    <tr key={job._id} data-testid={`booking-card-${job.bookingId || job._id}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="badge badge-accepted" style={{ fontWeight: 800 }}>
                            #{job.bookingId}
                          </span>
                          <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                            {job.category}
                          </span>
                        </div>
                        <strong style={{ fontSize: '14px', color: 'var(--primary-navy)' }}>
                          {job.serviceId?.name || job.serviceName || job.category}
                        </strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)', marginTop: '2px' }}>
                          Customer: <strong>{job.customerId?.name || 'Customer'}</strong> {job.contactNumber ? `(${job.contactNumber})` : ''}
                        </div>
                        {job.problemPhotos && job.problemPhotos.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            {job.problemPhotos.map((p, pIdx) => (
                              <a key={pIdx} href={p.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={p.url}
                                  alt="Problem"
                                  style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        {/* Show Complaint Status Badge if a complaint exists for this booking (Requirement 5) */}
                        {(() => {
                          const jobComp = complaintsList.find(
                            (c) =>
                              (c.bookingId?._id || c.bookingId) === job._id ||
                              (c.bookingId?.bookingId || c.bookingId) === job.bookingId
                          );
                          if (!jobComp) return null;
                          return (
                            <div style={{ marginTop: '6px' }}>
                              <span
                                className={`badge badge-${jobComp.status.toLowerCase().replace(/\s+/g, '')}`}
                                data-testid={`booking-complaint-badge-${job.bookingId}`}
                                style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title={`Complaint ID: ${jobComp.complaintId} • Category: ${jobComp.category}`}
                              >
                                <AlertCircle size={11} /> Complaint: {jobComp.status}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {new Date(job.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          {job.bookingTime}
                        </div>
                      </td>
                      <td style={{ maxWidth: '200px', fontSize: '13px' }}>{job.address}</td>
                      <td>
                        <span className={`badge badge-${job.status.toLowerCase().replace(/\s+/g, '')}`}>
                          {job.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* START JOB BUTTON */}
                          {job.status === 'Accepted' && (
                            <button
                              className="btn btn-navy btn-small"
                              onClick={() => handleStartJob(job)}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Play size={14} /> Start Job
                            </button>
                          )}

                          {/* AWAITING ARRIVAL VERIFICATION BUTTON */}
                          {job.status === 'Awaiting Arrival Verification' && (
                            <button
                              className="btn btn-navy btn-small"
                              onClick={() => {
                                setArrivalOtpModalJob(job);
                                setArrivalOtpInput('');
                                setOtpError('');
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#0284c7' }}
                            >
                              <ShieldAlert size={14} /> Enter Arrival Code
                            </button>
                          )}

                          {/* JOB IN PROGRESS BADGE (Requirement 3: Replaces Start Job once started) */}
                          {['In Progress', 'in-progress', 'in_progress'].includes(job.status) && (
                            <span
                              className="badge badge-accepted"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                padding: '6px 12px'
                              }}
                            >
                              <Clock size={13} /> Job In Progress
                            </span>
                          )}

                          {/* RAISE COMPLAINT BUTTON ON EVERY BOOKING (Requirement 2) */}
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            data-testid={`raise-complaint-btn-${job.bookingId}`}
                            data-booking-id={job.bookingId}
                            onClick={() => handleOpenBookingComplaint(job)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', borderColor: '#fca5a5' }}
                            title={`Raise a complaint against booking #${job.bookingId}`}
                          >
                            <AlertCircle size={14} />
                            <span>Raise Complaint</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
      )}
      </main>

      {/* ARRIVAL OTP VERIFICATION MODAL */}
      {arrivalOtpModalJob && (
        <Modal
          isOpen={Boolean(arrivalOtpModalJob)}
          onClose={() => setArrivalOtpModalJob(null)}
          title="Customer Arrival Verification"
        >
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '18px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <ShieldAlert size={22} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#0369a1', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  Verify Customer Code
                </strong>
                <p style={{ color: '#075985', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                  Ask the customer for the 6-digit arrival verification code displayed in their dashboard to confirm your arrival and begin work.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyArrivalOtp}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)' }}>
                  Enter 6-Digit Arrival Code *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="e.g. 123456"
                  className="form-input"
                  style={{
                    fontSize: '24px',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontWeight: 800,
                    padding: '12px'
                  }}
                  value={arrivalOtpInput}
                  onChange={(e) => setArrivalOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  required
                />
              </div>

              {otpError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    marginBottom: '16px'
                  }}
                >
                  {otpError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setArrivalOtpModalJob(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-navy"
                  disabled={verifyingOtp || arrivalOtpInput.length !== 6}
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify Code & Start Job'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* MODAL: BOOKING-SPECIFIC WORKER COMPLAINT (Requirement 3) */}
      {bookingComplaintJob && (
        <Modal
          isOpen={Boolean(bookingComplaintJob)}
          onClose={() => {
            setBookingComplaintJob(null);
            setComplaintError('');
          }}
          title={`Raise Complaint — Booking #${bookingComplaintJob.bookingId}`}
          maxWidth="640px"
        >
          <form onSubmit={handleSubmitBookingComplaint}>
            <p style={{ color: 'var(--secondary-text)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
              Submit a formal grievance regarding this customer or service job. All booking details are securely associated from this record.
            </p>

            {complaintError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  marginBottom: '16px'
                }}
              >
                {complaintError}
              </div>
            )}

            {/* Read-Only Pre-populated Booking Details (Requirement 3) */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: '18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '13px'
              }}
            >
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Booking Reference
                </span>
                <strong data-testid="complaint-modal-booking-id" style={{ color: 'var(--primary-navy)' }}>
                  #{bookingComplaintJob.bookingId}
                </strong>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                  ID: {bookingComplaintJob._id}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Service Category
                </span>
                <strong data-testid="complaint-modal-category" style={{ color: 'var(--primary-navy)' }}>
                  {bookingComplaintJob.category}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Service Name
                </span>
                <strong data-testid="complaint-modal-service" style={{ color: 'var(--primary-navy)' }}>
                  {bookingComplaintJob.serviceId?.name || bookingComplaintJob.serviceName || bookingComplaintJob.category}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Customer Details
                </span>
                <strong data-testid="complaint-modal-customer" style={{ color: 'var(--primary-navy)' }}>
                  {bookingComplaintJob.customerId?.name || 'Customer'}
                </strong>
                <span data-testid="complaint-modal-customer-id" style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                  ID: {bookingComplaintJob.customerId?._id || (typeof bookingComplaintJob.customerId === 'string' ? bookingComplaintJob.customerId : 'N/A')}
                </span>
                {bookingComplaintJob.contactNumber && (
                  <span style={{ fontSize: '11px', color: 'var(--secondary-text)', display: 'block' }}>
                    +91 {bookingComplaintJob.contactNumber}
                  </span>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Booking Status
                </span>
                <span
                  data-testid="complaint-modal-status"
                  className={`badge badge-${(bookingComplaintJob.status || '').toLowerCase().replace(/\s+/g, '')}`}
                >
                  {bookingComplaintJob.status || 'Assigned'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Assigned Technician
                </span>
                <strong data-testid="complaint-modal-worker" style={{ color: 'var(--primary-navy)' }}>
                  {user?.name || 'Technician'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                  Customer Service Address
                </span>
                <span style={{ fontSize: '12px', color: 'var(--primary-text)' }}>
                  {bookingComplaintJob.address || 'Address on file'}
                </span>
              </div>
            </div>

            {/* Previously Submitted Complaints for this booking if any (Requirement 5) */}
            {(() => {
              const existingForThisBooking = complaintsList.filter(
                (c) =>
                  (c.bookingId?._id || c.bookingId) === bookingComplaintJob._id ||
                  (c.bookingId?.bookingId || c.bookingId) === bookingComplaintJob.bookingId
              );
              if (existingForThisBooking.length === 0) return null;

              return (
                <div style={{ marginBottom: '18px', padding: '12px', background: '#eff6ff', borderRadius: 'var(--radius-md)', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', marginBottom: '8px' }}>
                    Previously Submitted Complaint for this Booking ({existingForThisBooking.length}):
                  </div>
                  {existingForThisBooking.map((ec) => (
                    <div key={ec._id} style={{ fontSize: '12px', color: '#1e3a8a', padding: '6px 0', borderBottom: '1px dashed #dbeafe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{ec.complaintId} — {ec.category}</strong>
                        <span className={`badge badge-${ec.status.toLowerCase().replace(/\s+/g, '')}`}>{ec.status}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', color: '#334155' }}>"{ec.description}"</p>
                      {ec.adminNotes && (
                        <div style={{ marginTop: '4px', fontWeight: 600, color: '#047857' }}>
                          Admin Response: {ec.adminNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Complaint Category (Required) */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)' }}>
                Complaint Category *
              </label>
              <select
                className="form-select"
                data-testid="complaint-category-select"
                value={complaintForm.category}
                onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
                required
              >
                {WORKER_COMPLAINT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Complaint Description (Required) */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)' }}>
                Complaint Description *
              </label>
              <textarea
                rows="4"
                className="form-textarea"
                data-testid="complaint-description-input"
                placeholder="Detail what happened with this booking, customer misconduct, incorrect address, unsafe hazards, or dispute specifics..."
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                required
              />
            </div>

            {/* Optional Photo Attachment */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--secondary-text)' }}>
                Optional Attachment / Photo Link
              </label>
              <input
                type="text"
                data-testid="complaint-attachment-input"
                className="form-input"
                placeholder="e.g. /assets/images/home-maintenance.jpg or photo URL"
                value={complaintForm.attachment}
                onChange={(e) => setComplaintForm({ ...complaintForm, attachment: e.target.value })}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setBookingComplaintJob(null);
                  setComplaintError('');
                }}
                disabled={submittingComplaint}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                data-testid="submit-complaint-btn"
                disabled={submittingComplaint}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Send size={14} />
                {submittingComplaint ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: APPLY FOR MORE SERVICES (Feature 2) */}
      {isApplyModalOpen && (
        <Modal
          isOpen={isApplyModalOpen}
          onClose={() => {
            setIsApplyModalOpen(false);
            setApplyError('');
          }}
          title="Apply for More Service Categories"
          maxWidth="640px"
        >
          <form onSubmit={handleSubmitApplyServices}>
            <p style={{ color: 'var(--secondary-text)', fontSize: '13px', marginBottom: '18px', lineHeight: 1.5 }}>
              Expand your trade offerings to receive customer booking requests in new categories. Select the trade categories you wish to add for administrator review.
            </p>

            {applyError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  marginBottom: '16px'
                }}
              >
                {applyError}
              </div>
            )}

            {/* Currently Approved Categories (Read-Only) */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)', display: 'block', marginBottom: '6px' }}>
                Currently Approved Categories (Read-Only)
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(profileData?.worker?.approvedCategories || user?.approvedCategories || []).length > 0 ? (
                  (profileData?.worker?.approvedCategories || user?.approvedCategories || []).map((cat, idx) => (
                    <span
                      key={idx}
                      className="badge badge-completed"
                      style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle2 size={12} /> {cat} (Active)
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>None</span>
                )}
              </div>
            </div>

            {/* Additional Categories Available (Checkboxes) */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)', display: 'block', marginBottom: '8px' }}>
                Select Additional Categories to Apply For *
              </label>

              {(() => {
                const currentApproved = profileData?.worker?.approvedCategories || user?.approvedCategories || [];
                const pendingApps = additionalApplications.filter((a) => a.applicationStatus === 'pending');
                const pendingCats = pendingApps.flatMap((a) => a.requestedCategories || a.selectedCategories || []);

                return (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '10px',
                      backgroundColor: '#f8fafc',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      maxHeight: '220px',
                      overflowY: 'auto'
                    }}
                  >
                    {allCategoriesList.map((cat) => {
                      const isApproved = currentApproved.includes(cat);
                      const isPending = pendingCats.includes(cat);
                      const isSelected = (applyForm.requestedCategories || []).includes(cat);
                      const isDisabled = isApproved || isPending;

                      return (
                        <label
                          key={cat}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? '#eff6ff' : 'var(--white)',
                            border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                            color: isDisabled ? '#94a3b8' : 'var(--primary-text)',
                            fontWeight: isSelected ? 600 : 400
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`apply-category-checkbox-${cat}`}
                            checked={isApproved || isSelected}
                            disabled={isDisabled}
                            onChange={() => handleToggleCategorySelect(cat)}
                            style={{ accentColor: 'var(--primary-navy)' }}
                          />
                          <span>
                            {cat}
                            {isApproved && <span style={{ fontSize: '10px', display: 'block', color: '#16a34a' }}>Approved</span>}
                            {isPending && <span style={{ fontSize: '10px', display: 'block', color: '#b45309' }}>Pending Review</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
              <span style={{ fontSize: '12px', color: 'var(--secondary-text)', marginTop: '4px', display: 'block' }}>
                You can select one or multiple categories you have skills and qualifications in.
              </span>
            </div>

            {/* Years of Experience */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)' }}>
                Relevant Experience in Requested Categories (Years) *
              </label>
              <input
                type="number"
                min="1"
                max="40"
                className="form-input"
                data-testid="apply-experience-input"
                value={applyForm.experience}
                onChange={(e) => setApplyForm({ ...applyForm, experience: e.target.value })}
                required
              />
            </div>

            {/* Skills & Qualification Details */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-navy)' }}>
                Skills, Tools & Qualification Details
              </label>
              <textarea
                rows="3"
                className="form-textarea"
                data-testid="apply-qualifications-input"
                placeholder="Mention trade certifications, vocational diplomas, specialized tools you own, and prior project experience..."
                value={applyForm.professionalDescription}
                onChange={(e) => setApplyForm({ ...applyForm, professionalDescription: e.target.value })}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setIsApplyModalOpen(false);
                  setApplyError('');
                }}
                disabled={submittingApply}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-navy"
                data-testid="submit-apply-services-btn"
                disabled={submittingApply}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={14} />
                {submittingApply ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
