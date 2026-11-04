import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import api from '../../api';

const WORKER_PROBLEM_CATEGORIES = [
  'Customer Misconduct',
  'Unsafe Working Environment',
  'Incorrect Service Information',
  'Payment Dispute',
  'Additional Work Requested',
  'Access or Location Issue',
  'Other'
];

export default function WorkerDashboard() {
  const { user, notify, switchRole } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
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

  // Problem Report Modal State (Requirement 7)
  const [reportModalJob, setReportModalJob] = useState(null);
  const [reportForm, setReportForm] = useState({
    category: WORKER_PROBLEM_CATEGORIES[0],
    description: '',
    attachment: ''
  });
  const [submittingReport, setSubmittingReport] = useState(false);

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

  useEffect(() => {
    fetchWorkerData();
  }, []);

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
      ['Accepted', 'In Progress'].includes(j.status)
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

  // Start Job (Requirement 3: Changes status from Accepted to In Progress)
  const handleStartJob = async (jobId) => {
    try {
      const { data } = await api.put(`/workers/jobs/${jobId}/status`, { status: 'In Progress' });
      notify(data.message, 'success');
      fetchWorkerData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to start job.', 'danger');
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

  // Worker Complaint Submission (Requirement 7)
  const handleOpenReportModal = (job) => {
    setReportModalJob(job);
    setReportForm({
      category: WORKER_PROBLEM_CATEGORIES[0],
      description: '',
      attachment: ''
    });
  };

  const handleSubmitProblem = async (e) => {
    e.preventDefault();
    if (!reportForm.description.trim()) {
      notify('Please describe the issue you encountered.', 'danger');
      return;
    }

    setSubmittingReport(true);
    try {
      const { data } = await api.post('/complaints/worker', {
        bookingId: reportModalJob._id,
        category: reportForm.category,
        description: reportForm.description.trim(),
        attachments: reportForm.attachment ? [reportForm.attachment.trim()] : []
      });
      notify(data.message, 'success');
      setReportModalJob(null);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit problem report.', 'danger');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <DashboardSidebar activeTab={activeTab} onSelectTab={setActiveTab} />

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

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className={`btn ${isAvailable ? 'btn-success' : 'btn-outline'} btn-small`}
              onClick={handleToggleAvailability}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Power size={14} />
              <span>Status: {isAvailable ? 'Available for Jobs' : 'Offline / Busy'}</span>
            </button>

            <button
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
          <StatCard
            label="Completed Jobs"
            value={profileData?.stats?.completedJobs ?? 0}
            icon={CheckCircle2}
          />
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
                    src={req.serviceId?.image || '/assets/images/plumbing.jpg'}
                    alt={req.category}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/assets/images/home-maintenance.jpg';
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
                      className="btn btn-success btn-small"
                      onClick={() => handleAcceptJob(req)}
                      style={{ padding: '8px 18px', fontWeight: 700 }}
                    >
                      <Check size={16} /> Accept
                    </button>
                    <button
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
                    <tr key={job._id}>
                      <td>
                        <strong>{job.serviceId?.name || job.category}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          Customer: {job.customerId?.name} ({job.contactNumber})
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
                          {/* START JOB BUTTON (Requirement 3: Only when Accepted) */}
                          {job.status === 'Accepted' && (
                            <button
                              className="btn btn-navy btn-small"
                              onClick={() => handleStartJob(job._id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Play size={14} /> Start Job
                            </button>
                          )}

                          {/* JOB IN PROGRESS BADGE (Requirement 3: Replaces Start Job once started) */}
                          {job.status === 'In Progress' && (
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

                          {/* REPORT PROBLEM BUTTON (Requirement 7) */}
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => handleOpenReportModal(job)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <AlertCircle size={14} /> Report Problem
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
      </main>

      {/* REPORT WORKPLACE PROBLEM MODAL (Requirement 7) */}
      {reportModalJob && (
        <Modal
          isOpen={Boolean(reportModalJob)}
          onClose={() => setReportModalJob(null)}
          title="Report Workplace Problem"
        >
          <form onSubmit={handleSubmitProblem}>
            <p style={{ color: 'var(--secondary-text)', fontSize: '13px', marginBottom: '18px' }}>
              Report issues encountered at the customer site. Your report will be logged with administrators.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                <label>Booking ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={reportModalJob.bookingId}
                  readOnly
                  style={{ background: '#f8fafc', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={reportModalJob.customerId?.name || 'Customer'}
                  readOnly
                  style={{ background: '#f8fafc' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Problem Category *</label>
              <select
                className="form-select"
                value={reportForm.category}
                onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                required
              >
                {WORKER_PROBLEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Problem Description *</label>
              <textarea
                rows="4"
                className="form-textarea"
                placeholder="Describe the issue in detail (e.g., customer behavior, site safety, scope mismatch)..."
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Optional Supporting Image URL / Photo Link</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. /assets/images/home-maintenance.jpg or photo URL"
                value={reportForm.attachment}
                onChange={(e) => setReportForm({ ...reportForm, attachment: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setReportModalJob(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-navy"
                disabled={submittingReport}
              >
                <Send size={15} /> {submittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
