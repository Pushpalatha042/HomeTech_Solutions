import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Check,
  TrendingUp,
  MapPin,
  MapPinned,
  Eye,
  AlertCircle,
  Briefcase,
  User,
  Mail,
  Phone,
  ShieldCheck,
  CreditCard,
  Settings,
  RefreshCw,
  Camera,
  Star,
  Upload,
  X,
  Send,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useDashboard } from '../../context/DashboardContext';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import LiveMap from '../../components/tracking/LiveMap';
import api from '../../api';
import { getServiceImage, homeMaintenanceImg } from '../../assets/images';

export default function CustomerDashboard() {
  const { user, notify, updateUser, switchRole } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Consume persistent DashboardContext
  const {
    customerBookings: bookings,
    customerLoading: loading,
    customerError,
    customerInitialized,
    fetchCustomerBookings,
    activeArrivalOtps,
    resendArrivalOtp
  } = useDashboard();

  // Live Worker Location state for active jobs
  const [liveWorkerLoc, setLiveWorkerLoc] = useState(null);

  // Confirm Completion Modal state
  const [completionModalBooking, setCompletionModalBooking] = useState(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState('');

  // Rate Service Modal state
  const [rateModalBooking, setRateModalBooking] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Upload Completed Work Photos Modal state
  const [afterPhotosModalBooking, setAfterPhotosModalBooking] = useState(null);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [afterPhotoError, setAfterPhotoError] = useState('');
  const [uploadingAfterPhotos, setUploadingAfterPhotos] = useState(false);

  // Raise Complaint Modal state
  const [complaintModalBooking, setComplaintModalBooking] = useState(null);
  const [complaintCategory, setComplaintCategory] = useState('Poor Service Quality');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState(user?.name || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Access denied notification if redirected from protected worker route
  useEffect(() => {
    if (location.state?.deniedWorkerAccess) {
      notify('Access denied: You must be an approved service professional to access the Worker Dashboard.', 'danger');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Sync tab with URL search parameter ?tab=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'ongoing', 'profile', 'addresses'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Refresh profile details directly from database record
  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        if (data) {
          updateUser(data);
          setEditName(data.name || '');
          setEditAddress(data.address || '');
        }
      })
      .catch((err) => console.warn('Could not refresh user profile:', err.message));
  }, []);

  const fetchBookings = () => {
    fetchCustomerBookings(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelProfileEdit = () => {
    setEditName(user?.name || '');
    setEditAddress(user?.address || '');
    setActiveTab('dashboard');
  };

  const handleResendOtp = async (bookingId) => {
    try {
      const res = await resendArrivalOtp(bookingId);
      notify(res?.message || 'New arrival OTP generated!', 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to resend OTP.', 'danger');
    }
  };

  // Top-level Socket.IO listener: updates bookings in real-time when status changes
  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit('join-customer-room', { customerId: user._id });

    const handleGlobalStatusUpdate = (payload) => {
      fetchBookings();
    };

    socket.on('booking-status-updated', handleGlobalStatusUpdate);
    return () => {
      socket.off('booking-status-updated', handleGlobalStatusUpdate);
    };
  }, [socket, user?._id]);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditAddress(user.address || '');
    }
  }, [user]);

  // Status checking helpers
  const isInProgress = (status) => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return s === 'in-progress' || s === 'in progress' || s === 'in_progress';
  };

  const isCompleted = (status) => {
    if (!status) return false;
    return String(status).trim().toLowerCase() === 'completed';
  };

  const isAcceptedOrAssigned = (status) => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return s === 'accepted' || s === 'assigned';
  };

  const isAwaitingVerification = (status) => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return s === 'awaiting arrival verification' || s === 'awaiting-arrival-verification';
  };

  const isUpcoming = (status) => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return [
      'pending', 'confirmed', 'assigned', 'accepted',
      'awaiting arrival verification', 'awaiting-arrival-verification',
      'in progress', 'in-progress', 'in_progress'
    ].includes(s);
  };

  // Compute stats
  const totalBookings = bookings.length;
  const upcomingBookings = bookings.filter((b) => isUpcoming(b.status));
  // Identify next upcoming booking
  const nextBooking = upcomingBookings[0] || null;
  const awaitingOtpBooking = (nextBooking && isAwaitingVerification(nextBooking.status))
    ? nextBooking
    : bookings.find((b) => isAwaitingVerification(b.status));
  const completedBookings = bookings.filter((b) => isCompleted(b.status));
  const totalSpent = bookings
    .filter((b) => b.paymentStatus === 'Paid')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Real-time tracking effect for next booking if active
  useEffect(() => {
    if (!nextBooking || !(isAcceptedOrAssigned(nextBooking.status) || isAwaitingVerification(nextBooking.status) || isInProgress(nextBooking.status))) {
      setLiveWorkerLoc(null);
      return;
    }

    // Fetch initial tracking details immediately
    console.log('[TRACKING] Tracking API called');
    api.get(`/tracking/${nextBooking._id}`)
      .then(({ data }) => {
        const rawLoc = data.location || data.currentLocation;
        if (rawLoc && rawLoc.latitude != null && rawLoc.longitude != null) {
          const loc = {
            name: data.worker?.name || 'Service Pro',
            latitude: Number(rawLoc.latitude),
            longitude: Number(rawLoc.longitude),
            accuracy: rawLoc.accuracy || 0,
            speed: rawLoc.speed || 0,
            lastUpdated: rawLoc.lastUpdated ? new Date(rawLoc.lastUpdated) : new Date()
          };
          setLiveWorkerLoc(loc);
          console.log('[TRACKING] Latest location received', loc);
        } else if (nextBooking.workerLocation?.latitude != null) {
          setLiveWorkerLoc(nextBooking.workerLocation);
        }
      })
      .catch((err) => console.warn('CustomerDashboard tracking fetch:', err.message));

    if (!socket) return;

    socket.emit('join-tracking', { bookingId: nextBooking._id, role: 'customer' });

    const handleLocationUpdate = (payload) => {
      if (payload && payload.latitude != null && payload.longitude != null) {
        console.log('[TRACKING] Location update received', payload);
        setLiveWorkerLoc({
          name: payload.workerName || 'Service Pro',
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          accuracy: payload.accuracy || 0,
          speed: payload.speed || 0,
          lastUpdated: payload.lastUpdated ? new Date(payload.lastUpdated) : new Date()
        });
      }
    };

    const handleStatusUpdate = (payload) => {
      fetchBookings();
    };

    socket.on('worker_location_updated', handleLocationUpdate);
    socket.on('location-updated', handleLocationUpdate);
    socket.on('booking-status-updated', handleStatusUpdate);

    return () => {
      socket.emit('leave-tracking', { bookingId: nextBooking._id });
      socket.off('worker_location_updated', handleLocationUpdate);
      socket.off('location-updated', handleLocationUpdate);
      socket.off('booking-status-updated', handleStatusUpdate);
    };
  }, [socket, nextBooking?._id, nextBooking?.status]);

  const handleConfirmCompletion = async () => {
    if (!completionModalBooking) return;
    setConfirmingCompletion(true);
    setCompletionError('');
    const bookingId = completionModalBooking._id;

    try {
      console.log('[COMPLETION] Submitting completion confirmation for booking:', bookingId);
      let res;
      try {
        res = await api.put(`/bookings/${bookingId}/confirm-completion`);
      } catch (errFallback) {
        res = await api.put(`/bookings/${bookingId}/complete`);
      }

      // Refresh persistent bookings
      fetchBookings();

      notify(res?.data?.message || 'Work completion confirmed successfully! Thank you.', 'success');
      const justCompleted = completionModalBooking;
      setCompletionModalBooking(null);
      setCompletionError('');

      // Automatically open Rate Service prompt for the completed booking
      setRateModalBooking(justCompleted);
    } catch (err) {
      console.error('[COMPLETION] Error confirming completion:', err);
      const errMsg = err.response?.data?.message || 'Failed to confirm completion. Please try again.';
      setCompletionError(errMsg);
      notify(errMsg, 'danger');
    } finally {
      setConfirmingCompletion(false);
    }
  };

  // Submit Rating & Review
  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!rateModalBooking) return;
    setSubmittingRating(true);
    try {
      const { data } = await api.post(`/bookings/${rateModalBooking._id}/review`, {
        rating: ratingValue,
        comment: ratingComment.trim()
      });
      notify(data.message || 'Thank you for your rating!', 'success');
      setRateModalBooking(null);
      setRatingComment('');
      setRatingValue(5);
      fetchBookings();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit review.', 'danger');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Select After-Service Photos (Part 4)
  const handleAfterPhotoSelect = (e) => {
    setAfterPhotoError('');
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (afterPhotos.length + files.length > 5) {
      setAfterPhotoError('You can upload a maximum of 5 photographs.');
      return;
    }

    const validFiles = [];
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of files) {
      if (!allowed.includes(file.type)) {
        setAfterPhotoError('Only JPG, JPEG, PNG, and WEBP formats are supported.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setAfterPhotoError(`"${file.name}" exceeds the 5 MB limit.`);
        return;
      }
      validFiles.push({
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file)
      });
    }

    setAfterPhotos((prev) => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const handleRemoveAfterPhoto = (idx) => {
    setAfterPhotos((prev) => {
      const removed = prev[idx];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Submit After-Service Photos (Part 4)
  const handleSubmitAfterPhotos = async (e) => {
    e.preventDefault();
    if (!afterPhotosModalBooking || afterPhotos.length === 0) return;
    setUploadingAfterPhotos(true);
    try {
      const formData = new FormData();
      afterPhotos.forEach((item) => formData.append('photos', item.file));

      const { data } = await api.post(
        `/bookings/${afterPhotosModalBooking._id}/completion-photos`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      notify(data.message || 'Completed work photos uploaded successfully.', 'success');
      setAfterPhotosModalBooking(null);
      setAfterPhotos([]);
      fetchBookings();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to upload completed work photos.', 'danger');
    } finally {
      setUploadingAfterPhotos(false);
    }
  };

  // Submit Complaint
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintModalBooking) return;
    if (!complaintDescription.trim()) {
      notify('Please describe the problem.', 'danger');
      return;
    }
    setSubmittingComplaint(true);
    try {
      const { data } = await api.post('/complaints/customer', {
        bookingId: complaintModalBooking._id,
        category: complaintCategory,
        description: complaintDescription.trim()
      });
      notify(data.message || 'Complaint submitted successfully.', 'success');
      setComplaintModalBooking(null);
      setComplaintDescription('');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit complaint.', 'danger');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const isWorkerApproved = user?.roles?.includes('worker') && user?.workerStatus === 'approved';

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', {
        name: editName.trim(),
        address: editAddress.trim()
      });
      updateUser(data.user);
      notify(data.message, 'success');
      setActiveTab('dashboard');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update profile.', 'danger');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRoleSwitch = async (targetRole) => {
    const success = await switchRole(targetRole);
    if (success) {
      if (targetRole === 'worker') navigate('/worker/dashboard');
      else if (targetRole === 'customer') navigate('/customer/dashboard');
      else if (targetRole === 'admin') navigate('/admin/dashboard');
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenWorkerModal={() => setIsWorkerModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* COMPREHENSIVE PROFILE HEADER CARD */}
        <div
          className="card"
          style={{
            marginBottom: '28px',
            padding: '28px',
            background: 'var(--white)',
            borderLeft: '5px solid var(--accent-yellow)'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            {/* User Avatar & Basic Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={user?.profileImage || '/assets/images/avatar-customer.jpg'}
                  alt={user?.name || 'Customer'}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/images/cleaning.jpg';
                  }}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--primary-navy)',
                    boxShadow: 'var(--shadow-md)'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--success)',
                    border: '2px solid var(--white)'
                  }}
                  title="Active Account"
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-navy)', margin: 0 }}>
                    {user?.name || 'Customer Profile'}
                  </h1>
                  <span className="badge badge-completed" style={{ fontSize: '11px' }}>
                    <ShieldCheck size={13} /> Verified Customer
                  </span>
                  {isWorkerApproved && (
                    <span className="badge badge-accepted" style={{ fontSize: '11px' }}>
                      <Briefcase size={13} /> Approved Worker
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: 'var(--secondary-text)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Mail size={14} color="var(--primary-navy)" /> {user?.email}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Phone size={14} color="var(--primary-navy)" /> +91 {user?.phone}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={14} color="var(--primary-navy)" /> {user?.address || 'Vijayawada, India'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Profile Actions */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {isWorkerApproved && (
                <button
                  className="btn btn-yellow btn-small"
                  onClick={() => handleRoleSwitch('worker')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} /> Switch to Worker Dashboard
                </button>
              )}
              {user?.workerStatus === 'pending' && (
                <button
                  className="btn btn-outline btn-small"
                  disabled
                  style={{ backgroundColor: 'var(--warning-bg)', color: '#b45309', cursor: 'default' }}
                >
                  <Clock size={14} /> Worker App Pending Review
                </button>
              )}

              {/* Functional Edit Profile Button */}
              <button
                className={`btn ${activeTab === 'profile' ? 'btn-navy' : 'btn-outline'} btn-small`}
                onClick={() => {
                  setEditName(user?.name || '');
                  setEditAddress(user?.address || '');
                  setActiveTab(activeTab === 'profile' ? 'dashboard' : 'profile');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <User size={14} /> {activeTab === 'profile' ? 'View Dashboard' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {/* Quick Sub-Navigation Pills */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              borderTop: '1px solid var(--border-light)',
              marginTop: '20px',
              paddingTop: '16px',
              flexWrap: 'wrap'
            }}
          >
            <button
              className={`btn btn-small ${activeTab === 'dashboard' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard Overview
            </button>
            <button
              className={`btn btn-small ${activeTab === 'ongoing' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveTab('ongoing')}
            >
              <Clock size={14} /> Ongoing Jobs ({upcomingBookings.length})
            </button>
            <Link to="/customer/bookings" className="btn btn-outline btn-small">
              <CalendarDays size={14} /> Booking History ({totalBookings})
            </Link>
            <Link to="/customer/payments" className="btn btn-outline btn-small">
              <CreditCard size={14} /> Payment History (₹{totalSpent.toLocaleString('en-IN')})
            </Link>
            <button
              className={`btn btn-small ${activeTab === 'addresses' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setActiveTab('addresses')}
            >
              <MapPin size={14} /> Saved Addresses
            </button>
            <button
              className={`btn btn-small ${activeTab === 'profile' ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => {
                setEditName(user?.name || '');
                setEditAddress(user?.address || '');
                setActiveTab('profile');
              }}
            >
              <Settings size={14} /> Profile Settings
            </button>
          </div>
        </div>

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <>
            {/* Worker Application Pending Alert if applicable */}
            {user?.workerStatus === 'pending' && (
              <div
                style={{
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning)',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Clock size={22} color="#b45309" />
                <div>
                  <strong style={{ color: '#92400e', fontSize: '14px' }}>
                    Worker Application Under Review
                  </strong>
                  <p style={{ color: '#78350f', fontSize: '13px' }}>
                    Your application to join as a professional service provider is currently being reviewed by administrators. You will be notified once approved.
                  </p>
                </div>
              </div>
            )}

            {/* Stats Row matching prototype */}
            <div className="stats-grid">
              <StatCard label="Total Bookings" value={totalBookings} icon={CalendarDays} />
              <StatCard label="Upcoming" value={upcomingBookings.length} icon={Clock} />
              <StatCard label="Completed" value={completedBookings.length} icon={CheckCircle2} />
              <StatCard
                label="Total Spent"
                value={`₹${totalSpent.toLocaleString('en-IN')}`}
                icon={TrendingUp}
              />
            </div>

            {/* Arrival OTP Notification for Customer */}
            {awaitingOtpBooking && (
              <div
                className="card"
                style={{
                  marginBottom: '24px',
                  padding: '20px 24px',
                  backgroundColor: '#f0f9ff',
                  border: '2px dashed #0284c7',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: '#e0f2fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7',
                        flexShrink: 0
                      }}
                    >
                      <ShieldCheck size={26} />
                    </div>
                    <div>
                      <h4 style={{ color: '#0369a1', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                        Worker Has Arrived! Service Start Verification Code
                      </h4>
                      <p style={{ color: '#075985', fontSize: '13px', margin: '3px 0 0' }}>
                        Please share this 6-digit verification code with your service professional upon arrival to start work.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      className="arrival-otp-display"
                      data-testid="arrival-otp-code"
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        letterSpacing: '6px',
                        color: '#0369a1',
                        backgroundColor: '#ffffff',
                        padding: '8px 20px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid #bae6fd',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {activeArrivalOtps[awaitingOtpBooking._id]?.otp || '••••••'}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => handleResendOtp(awaitingOtpBooking._id)}
                      style={{ fontSize: '12px', borderColor: '#0284c7', color: '#0284c7' }}
                    >
                      Resend Code
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Booking Featured Card (Prototype Page 5) */}
            {nextBooking ? (
              <section className="card" style={{ marginBottom: '32px', padding: '24px' }}>
                <div className="flex-between" style={{ marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                    Upcoming Booking
                  </h3>
                  <span className={`badge badge-${String(nextBooking.status).toLowerCase().replace(/[\s_]+/g, '')}`}>
                    {isInProgress(nextBooking.status) ? 'Work In Progress' : nextBooking.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '20px', alignItems: 'center' }}>
                  <img
                    src={getServiceImage(nextBooking.serviceId || nextBooking)}
                    alt="Service"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = homeMaintenanceImg;
                    }}
                    style={{
                      width: '120px',
                      height: '85px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  />
                  <div>
                    <h4 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                      {nextBooking.serviceId?.name || nextBooking.category}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '2px' }}>
                      Date: {new Date(nextBooking.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {nextBooking.bookingTime}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--secondary-text)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={14} /> {nextBooking.address}
                    </p>
                    {nextBooking.workerId && (
                      <p style={{ fontSize: '13px', color: 'var(--primary-navy)', fontWeight: 600, marginTop: '4px' }}>
                        Assigned Professional: {nextBooking.workerId.name} ({nextBooking.workerId.phone})
                      </p>
                    )}

                    {/* Automatic Live GPS Display in Customer Dashboard */}
                    {liveWorkerLoc && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 10px',
                          backgroundColor: '#dcfce7',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '12px',
                          color: '#166534',
                          fontWeight: 600
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#16a34a',
                            boxShadow: '0 0 6px #16a34a',
                            animation: 'pulse 1.5s infinite'
                          }}
                        />
                        Live Worker GPS: Lat {Number(liveWorkerLoc.latitude).toFixed(4)}, Lng{' '}
                        {Number(liveWorkerLoc.longitude).toFixed(4)}
                        <span style={{ color: '#15803d', fontWeight: 400 }}>
                          (Updated: {new Date(liveWorkerLoc.lastUpdated || Date.now()).toLocaleTimeString()})
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* COMPLETE SERVICE BUTTON (Requirement 4: For in-progress bookings) */}
                    {isInProgress(nextBooking.status) && (
                      <button
                        className="btn btn-success"
                        data-testid="complete-service-btn"
                        onClick={() => setCompletionModalBooking(nextBooking)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                      >
                        <CheckCircle2 size={16} /> Complete Service
                      </button>
                    )}

                    {/* RAISE A COMPLAINT BUTTON (Requirement 4: For in-progress or accepted bookings) */}
                    {(isInProgress(nextBooking.status) || isAcceptedOrAssigned(nextBooking.status)) && (
                      <button
                        className="btn btn-outline"
                        data-testid="raise-complaint-btn"
                        onClick={() => setComplaintModalBooking(nextBooking)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <AlertCircle size={16} /> Raise a Complaint
                      </button>
                    )}

                    {/* TRACK WORKER BUTTON: Only visible during Accepted / Assigned (Removed during In-Progress) */}
                    {isAcceptedOrAssigned(nextBooking.status) && !isInProgress(nextBooking.status) && (
                      <Link
                        to={`/tracking/${nextBooking._id}`}
                        className="btn btn-yellow"
                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <MapPinned size={16} /> Track Worker
                      </Link>
                    )}
                  </div>
                </div>

                {/* Live Tracking Map for Active Upcoming Bookings */}
                {['Accepted', 'In Progress'].includes(nextBooking.status) && (
                  <div
                    style={{
                      marginTop: '20px',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      height: '320px',
                      border: '1px solid var(--border-color)',
                      position: 'relative'
                    }}
                  >
                    <LiveMap
                      workerLocation={liveWorkerLoc}
                      customerLocation={{ address: nextBooking.address }}
                    />
                  </div>
                )}
              </section>
            ) : (
              <div
                className="card"
                style={{
                  padding: '30px',
                  textAlign: 'center',
                  marginBottom: '32px',
                  background: 'var(--white)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <img
                  src="/assets/images/home-maintenance.jpg"
                  alt="Home Services"
                  style={{
                    width: '120px',
                    height: '80px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-md)',
                    opacity: 0.85
                  }}
                />
                <h4>No upcoming bookings</h4>
                <p style={{ color: 'var(--secondary-text)', fontSize: '14px', maxWidth: '400px' }}>
                  Need professional help with home repairs, deep cleaning, or appliance fixes?
                </p>
                <Link to="/services" className="btn btn-navy btn-small">
                  Browse Services Catalogue
                </Link>
              </div>
            )}

            {/* Recent Bookings Table (Prototype Page 5) */}
            <section className="card" style={{ padding: '24px' }}>
              <div className="flex-between" style={{ marginBottom: '18px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Recent Bookings
                </h3>
                <Link to="/customer/bookings" className="btn btn-outline btn-small">
                  View All
                </Link>
              </div>

              {bookings.length === 0 ? (
                <p style={{ color: 'var(--secondary-text)', textAlign: 'center', padding: '24px' }}>
                  You have not made any bookings yet.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.slice(0, 5).map((b) => (
                        <tr key={b._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img
                                src={getServiceImage(b.serviceId || b)}
                                alt="Service"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = homeMaintenanceImg;
                                }}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: 'var(--radius-sm)',
                                  objectFit: 'cover'
                                }}
                              />
                              <div>
                                <strong>{b.serviceId?.name || b.category}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                                  ID: {b.bookingId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {new Date(b.bookingDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                            <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                              {b.bookingTime}
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${String(b.status).toLowerCase().replace(/[\s_]+/g, '')}`}>
                              {b.status}
                            </span>
                          </td>
                          <td>
                            <strong>₹{Number(b.totalAmount).toLocaleString('en-IN')}</strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {isInProgress(b.status) && (
                                <>
                                  <button
                                    className="btn btn-success btn-small"
                                    data-testid="complete-service-btn"
                                    onClick={() => setCompletionModalBooking(b)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                                  >
                                    <CheckCircle2 size={13} /> Complete Service
                                  </button>
                                  <button
                                    className="btn btn-outline btn-small"
                                    data-testid="raise-complaint-btn"
                                    onClick={() => setComplaintModalBooking(b)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <AlertCircle size={13} /> Raise a Complaint
                                  </button>
                                </>
                              )}
                              {isAcceptedOrAssigned(b.status) && !isInProgress(b.status) && (
                                <Link to={`/tracking/${b._id}`} className="btn btn-yellow btn-small">
                                  Track
                                </Link>
                              )}
                              {isCompleted(b.status) && (
                                <>
                                  <button
                                    className="btn btn-navy btn-small"
                                    onClick={() => setRateModalBooking(b)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '4px 8px' }}
                                    title="Rate Service"
                                  >
                                    <Star size={12} fill="#f59e0b" color="#f59e0b" /> Rate
                                  </button>
                                  <button
                                    className="btn btn-outline btn-small"
                                    onClick={() => { setAfterPhotosModalBooking(b); setAfterPhotos([]); setAfterPhotoError(''); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '4px 8px' }}
                                    title="Upload Completed Photos"
                                  >
                                    <Upload size={12} /> Photos
                                  </button>
                                  <button
                                    className="btn btn-outline btn-small"
                                    data-testid="raise-complaint-btn"
                                    onClick={() => setComplaintModalBooking(b)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '4px 8px' }}
                                    title="Raise Complaint"
                                  >
                                    <AlertCircle size={12} />
                                  </button>
                                </>
                              )}
                              {['Completed', 'Cancelled'].includes(b.status) && (
                                <Link to={`/services`} className="btn btn-outline btn-small">
                                  Rebook
                                </Link>
                              )}
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

        {/* TAB: ONGOING JOBS */}
        {activeTab === 'ongoing' && (
          <section className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Ongoing & Active Jobs ({upcomingBookings.length})
                </h3>
                <p style={{ color: 'var(--secondary-text)', fontSize: '14px', marginTop: '2px' }}>
                  Track your scheduled visits, live worker locations, and confirm completion once work is finished.
                </p>
              </div>
              <Link to="/customer/bookings" className="btn btn-outline btn-small">
                View All Booking History
              </Link>
            </div>

            {upcomingBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <img
                  src="/assets/images/home-maintenance.jpg"
                  alt="No Ongoing Jobs"
                  style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)', opacity: 0.85, margin: '0 auto 16px' }}
                />
                <h4>No Ongoing Jobs</h4>
                <p style={{ color: 'var(--secondary-text)', fontSize: '14px', maxWidth: '400px', margin: '8px auto 16px' }}>
                  You currently have no active or in-progress service requests. Need help with repairs or maintenance?
                </p>
                <Link to="/services" className="btn btn-navy btn-small">
                  Book a Service
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {upcomingBookings.map((job) => (
                  <div
                    key={job._id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px',
                      background: 'var(--white)'
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={getServiceImage(job.serviceId || job)}
                          alt={job.serviceId?.name || job.category}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = homeMaintenanceImg;
                          }}
                          style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                        />
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                            {job.serviceId?.name || job.category}
                          </h4>
                          <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                            Booking ID: <strong>{job.bookingId}</strong> • Total: <strong>₹{Number(job.totalAmount).toLocaleString('en-IN')}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge badge-${job.status.toLowerCase().replace(/\s+/g, '')}`}>
                          {job.status === 'In Progress' ? 'Work In Progress' : job.status}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px', color: 'var(--secondary-text)', background: 'var(--bg-color)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                      <div>
                        <strong style={{ color: 'var(--primary-navy)' }}>Scheduled:</strong>{' '}
                        {new Date(job.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {job.bookingTime}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--primary-navy)' }}>Service Address:</strong>{' '}
                        {job.address}
                      </div>
                      {job.workerId && (
                        <div>
                          <strong style={{ color: 'var(--primary-navy)' }}>Professional:</strong>{' '}
                          {job.workerId.name} ({job.workerId.phone})
                        </div>
                      )}
                    </div>

                    {/* Arrival OTP Display if awaiting verification */}
                    {job.status === 'Awaiting Arrival Verification' && (
                      <div
                        style={{
                          backgroundColor: '#f0f9ff',
                          border: '2px dashed #0284c7',
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#0369a1', fontSize: '14px' }}>
                            Worker Has Arrived! Share Arrival OTP
                          </strong>
                          <p style={{ color: '#075985', fontSize: '12px', marginTop: '2px' }}>
                            Provide this 6-digit verification code to the professional to start work.
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            style={{
                              fontSize: '24px',
                              fontWeight: 800,
                              letterSpacing: '4px',
                              color: '#0369a1',
                              background: '#fff',
                              padding: '6px 16px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid #bae6fd'
                            }}
                          >
                            {activeArrivalOtps[job._id]?.otp || '••••••'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => handleResendOtp(job._id)}
                            style={{ fontSize: '12px' }}
                          >
                            Resend Code
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {isInProgress(job.status) && (
                        <button
                          className="btn btn-success btn-small"
                          data-testid="complete-service-btn"
                          onClick={() => setCompletionModalBooking(job)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        >
                          <CheckCircle2 size={15} /> Complete Service
                        </button>
                      )}

                      {(isInProgress(job.status) || isAcceptedOrAssigned(job.status)) && (
                        <button
                          className="btn btn-outline btn-small"
                          data-testid="raise-complaint-btn"
                          onClick={() => setComplaintModalBooking(job)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <AlertCircle size={15} /> Raise a Complaint
                        </button>
                      )}

                      {/* TRACK WORKER BUTTON: Only visible during Accepted / Assigned (Removed during In-Progress) */}
                      {isAcceptedOrAssigned(job.status) && !isInProgress(job.status) && (
                        <Link
                          to={`/tracking/${job._id}`}
                          className="btn btn-yellow btn-small"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <MapPinned size={15} /> Track Worker
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: PROFILE SETTINGS */}
        {activeTab === 'profile' && (
          <section className="card" style={{ maxWidth: '680px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: 'var(--primary-navy)' }}>
              Profile Settings & Account Details
            </h3>
            <p style={{ color: 'var(--secondary-text)', fontSize: '14px', marginBottom: '24px' }}>
              Update your personal details, service address, and view your verified account information.
            </p>

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Verified Mobile Number</label>
                  <input
                    className="form-input"
                    value={`+91 ${user?.phone || ''}`}
                    readOnly
                    style={{ background: '#f8fafc', color: 'var(--secondary-text)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--success)', marginTop: '3px' }}>
                    ✓ Mobile OTP Verified
                  </span>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    className="form-input"
                    value={user?.email || ''}
                    readOnly
                    style={{ background: '#f8fafc', color: 'var(--secondary-text)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Primary Service Address *</label>
                <textarea
                  rows="3"
                  className="form-textarea"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Enter house / flat number, street, city and pin code..."
                  required
                />
              </div>

              {/* Account Capabilities & Roles Box */}
              <div
                style={{
                  background: 'var(--bg-color)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '8px' }}>
                  Account Status & Capabilities
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--secondary-text)' }}>Account ID: </span>
                    <strong>{user?._id?.slice(-8).toUpperCase()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--secondary-text)' }}>Assigned Roles: </span>
                    <strong>{(user?.roles || []).join(', ')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--secondary-text)' }}>Worker Status: </span>
                    <strong style={{ textTransform: 'capitalize' }}>{user?.workerStatus || 'Not Applied'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--secondary-text)' }}>Active View: </span>
                    <strong style={{ textTransform: 'capitalize' }}>{user?.activeRole || 'Customer'}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCancelProfileEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-navy"
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 3: SAVED ADDRESSES */}
        {activeTab === 'addresses' && (
          <section className="card" style={{ maxWidth: '680px' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Saved Addresses
                </h3>
                <p style={{ color: 'var(--secondary-text)', fontSize: '14px' }}>
                  Manage addresses where service professionals visit for repair and maintenance.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '20px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--white)',
                marginBottom: '16px'
              }}
            >
              <div className="flex-between" style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} color="var(--primary-navy)" />
                  <strong>Primary Residential Address (Home)</strong>
                </div>
                <span className="badge badge-completed" style={{ fontSize: '11px' }}>Default</span>
              </div>
              <p style={{ color: 'var(--secondary-text)', fontSize: '14px', lineHeight: '1.5' }}>
                {user?.address || '123, Green Street, Vijayawada, Andhra Pradesh, India - 520001'}
              </p>
            </div>

            <button
              className="btn btn-outline btn-small"
              onClick={() => setActiveTab('profile')}
            >
              Edit Primary Address
            </button>
          </section>
        )}
      </main>

      {/* Confirm Completion Modal (Requirement 4) */}
      {completionModalBooking && (
        <Modal
          isOpen={Boolean(completionModalBooking)}
          onClose={() => setCompletionModalBooking(null)}
          title="Confirm Service Completion"
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                backgroundColor: '#eff6ff',
                borderRadius: 'var(--radius-md)',
                marginBottom: '18px'
              }}
            >
              <CheckCircle2 size={32} color="var(--primary-navy)" />
              <div>
                <strong style={{ fontSize: '16px', color: 'var(--primary-navy)' }}>
                  Are you sure the service has been completed?
                </strong>
                <p style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '4px' }}>
                  Booking ID: <strong>{completionModalBooking.bookingId}</strong> • Service:{' '}
                  {completionModalBooking.serviceId?.name || completionModalBooking.category}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--primary-text)', lineHeight: '1.5', marginBottom: '20px' }}>
              Please confirm whether the assigned service professional has successfully performed all requested repairs or maintenance at your address. Confirming will finalize the booking.
            </p>

            {completionError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  backgroundColor: '#fee2e2',
                  borderRadius: 'var(--radius-md)',
                  color: '#dc2626',
                  marginBottom: '16px',
                  fontSize: '13px'
                }}
              >
                <AlertCircle size={18} />
                <span style={{ flex: 1 }}>{completionError}</span>
                <button
                  type="button"
                  className="btn btn-navy btn-small"
                  onClick={handleConfirmCompletion}
                  disabled={confirmingCompletion}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Retry
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setCompletionModalBooking(null); setCompletionError(''); }}
                disabled={confirmingCompletion}
              >
                No, Go Back
              </button>
              <button
                type="button"
                className="btn btn-success"
                data-testid="confirm-completion-btn"
                onClick={handleConfirmCompletion}
                disabled={confirmingCompletion}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Check size={16} />
                {confirmingCompletion ? 'Confirming...' : 'Yes, Work is Completed'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rate Service Modal (Part 1) */}
      {rateModalBooking && (
        <Modal
          isOpen={Boolean(rateModalBooking)}
          onClose={() => setRateModalBooking(null)}
          title="Rate Your Service Experience"
        >
          <form onSubmit={handleSubmitRating}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--secondary-text)', marginBottom: '10px' }}>
                How was your experience for <strong>{rateModalBooking.serviceId?.name || rateModalBooking.category}</strong>?
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={32}
                    fill={star <= ratingValue ? '#f59e0b' : 'transparent'}
                    color={star <= ratingValue ? '#f59e0b' : '#cbd5e1'}
                    onClick={() => setRatingValue(star)}
                    style={{ transition: 'transform 0.15s' }}
                  />
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 700, color: '#b45309' }}>
                {ratingValue === 1 && '1 Star — Very Poor'}
                {ratingValue === 2 && '2 Stars — Poor'}
                {ratingValue === 3 && '3 Stars — Average'}
                {ratingValue === 4 && '4 Stars — Good'}
                {ratingValue === 5 && '5 Stars — Excellent'}
              </div>
            </div>

            <div className="form-group">
              <label>Feedback & Review (Optional)</label>
              <textarea
                rows="3"
                className="form-textarea"
                placeholder="Share your thoughts on the technician's punctuality, work quality, cleanliness..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRateModalBooking(null)}
                disabled={submittingRating}
              >
                Skip
              </button>
              <button
                type="submit"
                className="btn btn-navy"
                disabled={submittingRating}
              >
                {submittingRating ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload Completed Work Photos Modal (Part 4) */}
      {afterPhotosModalBooking && (
        <Modal
          isOpen={Boolean(afterPhotosModalBooking)}
          onClose={() => { setAfterPhotosModalBooking(null); setAfterPhotos([]); setAfterPhotoError(''); }}
          title="Upload Completed Work Photos"
        >
          <form onSubmit={handleSubmitAfterPhotos}>
            <p style={{ fontSize: '14px', color: 'var(--secondary-text)', marginBottom: '14px', lineHeight: 1.5 }}>
              Upload photographs of the completed work to verify service quality and record the final outcome.
            </p>

            {afterPhotos.length < 5 && (
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  border: '2px dashed #cbd5e1',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleAfterPhotoSelect}
                  style={{ display: 'none' }}
                />
                <Upload size={24} color="var(--primary-navy)" style={{ marginBottom: '6px' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-navy)' }}>
                  Click to browse after-service photos
                </span>
                <span style={{ fontSize: '11px', color: 'var(--secondary-text)', marginTop: '2px' }}>
                  JPG, JPEG, PNG, WEBP (Max 5 MB each, up to 5 photos)
                </span>
              </label>
            )}

            {afterPhotoError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
                <AlertCircle size={14} />
                <span>{afterPhotoError}</span>
              </div>
            )}

            {afterPhotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '14px' }}>
                {afterPhotos.map((item, idx) => (
                  <div key={idx} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', aspectRatio: '1' }}>
                    <img src={item.previewUrl} alt={`Completed preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveAfterPhoto(idx)}
                      style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setAfterPhotosModalBooking(null); setAfterPhotos([]); }}
                disabled={uploadingAfterPhotos}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-navy"
                disabled={uploadingAfterPhotos || afterPhotos.length === 0}
              >
                {uploadingAfterPhotos ? 'Uploading...' : `Upload ${afterPhotos.length} Photo(s)`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Raise Complaint Modal */}
      {complaintModalBooking && (
        <Modal
          isOpen={Boolean(complaintModalBooking)}
          onClose={() => setComplaintModalBooking(null)}
          title="Raise a Service Complaint"
        >
          <form onSubmit={handleSubmitComplaint}>
            <div className="form-group">
              <label>Complaint Issue Category *</label>
              <select
                className="form-select"
                value={complaintCategory}
                onChange={(e) => setComplaintCategory(e.target.value)}
                required
              >
                <option value="Poor Service Quality">Poor Service Quality</option>
                <option value="Worker Misconduct">Worker Misconduct</option>
                <option value="Delayed Service">Delayed Service</option>
                <option value="Incomplete Work">Incomplete Work</option>
                <option value="Payment Issue">Payment Issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Describe the Problem *</label>
              <textarea
                rows="4"
                className="form-textarea"
                placeholder="Please describe the issue in detail..."
                value={complaintDescription}
                onChange={(e) => setComplaintDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setComplaintModalBooking(null)}
                disabled={submittingComplaint}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={submittingComplaint}
              >
                {submittingComplaint ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
