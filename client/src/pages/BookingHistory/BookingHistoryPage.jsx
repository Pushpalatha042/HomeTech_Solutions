import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPinned,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Star,
  AlertCircle,
  Send,
  Check,
  Clock,
  ShieldCheck,
  Upload,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar';
import Modal from '../../components/common/Modal';
import api from '../../api';

const RATING_LABELS = {
  1: '1 Star — Very Poor',
  2: '2 Stars — Poor',
  3: '3 Stars — Average',
  4: '4 Stars — Good',
  5: '5 Stars — Excellent'
};

const CUSTOMER_COMPLAINT_CATEGORIES = [
  'Poor Service Quality',
  'Worker Misconduct',
  'Delayed Service',
  'Incomplete Work',
  'Payment Issue',
  'Other'
];

export default function BookingHistoryPage() {
  const { user, notify } = useAuth();
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState('bookings');
  const [filterTab, setFilterTab] = useState('All');
  const [bookings, setBookings] = useState([]);
  const [reviewsMap, setReviewsMap] = useState({});
  const [complaintsList, setComplaintsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Completion Confirmation Dialog State (Requirement 4)
  const [completionConfirmBooking, setCompletionConfirmBooking] = useState(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState('');

  // After-Service Photos state per booking (Part 4)
  const [afterPhotosState, setAfterPhotosState] = useState({});

  // Review Form States (per bookingId) (Requirement 5)
  const [reviewForms, setReviewForms] = useState({});
  const [hoveredStars, setHoveredStars] = useState({});
  const [submittingReviewBookingId, setSubmittingReviewBookingId] = useState(null);

  // Complaint Modal State (Requirement 6)
  const [complaintModalBooking, setComplaintModalBooking] = useState(null);
  const [complaintForm, setComplaintForm] = useState({
    category: CUSTOMER_COMPLAINT_CATEGORIES[0],
    description: '',
    attachment: ''
  });
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, complaintsRes] = await Promise.all([
        api.get('/bookings/my'),
        api.get('/complaints/my').catch(() => ({ data: [] }))
      ]);

      setBookings(bookingsRes.data);
      setComplaintsList(complaintsRes.data || []);

      // Fetch reviews for completed bookings
      const completed = bookingsRes.data.filter((b) => b.status === 'Completed');
      const revMap = {};
      await Promise.all(
        completed.map(async (b) => {
          try {
            const { data } = await api.get(`/bookings/${b._id}/review`);
            if (data) revMap[b._id] = data;
          } catch (e) {}
        })
      );
      setReviewsMap(revMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time booking status synchronization
  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit('join-customer-room', { customerId: user._id });

    const handleStatusUpdate = (payload) => {
      if (payload?.bookingId || payload?.bookingReadableId) {
        setBookings((prev) =>
          prev.map((b) => {
            if (b._id === payload.bookingId || b.bookingId === payload.bookingReadableId) {
              return {
                ...b,
                status: payload.status,
                startedAt: payload.startedAt || b.startedAt,
                completedAt: payload.completedAt || b.completedAt
              };
            }
            return b;
          })
        );
      }
      fetchData();
    };

    socket.on('booking-status-updated', handleStatusUpdate);
    return () => {
      socket.off('booking-status-updated', handleStatusUpdate);
    };
  }, [socket, user?._id]);

  // Handle Customer Confirm Completion (Requirement 4)
  const handleConfirmCompletion = async () => {
    if (!completionConfirmBooking) return;
    setConfirmingCompletion(true);
    setCompletionError('');
    const bookingId = completionConfirmBooking._id;

    try {
      console.log('[COMPLETION] Submitting completion confirmation for booking:', bookingId);
      let res;
      try {
        res = await api.put(`/bookings/${bookingId}/confirm-completion`);
      } catch (e) {
        res = await api.put(`/bookings/${bookingId}/complete`);
      }

      // 9. Update the booking information in React state immediately
      const updatedBooking = res?.data?.booking;
      setBookings((prev) =>
        prev.map((b) => {
          if (b._id === bookingId || b.bookingId === completionConfirmBooking.bookingId) {
            return updatedBooking
              ? { ...b, ...updatedBooking, status: 'Completed', paymentStatus: 'Paid' }
              : { ...b, status: 'Completed', paymentStatus: 'Paid' };
          }
          return b;
        })
      );

      // 10. Display a successful completion message
      notify(res?.data?.message || 'Service completion confirmed successfully! Thank you.', 'success');
      setCompletionConfirmBooking(null);
      setCompletionError('');

      // Fetch fresh data in background without blocking or redirecting
      fetchData().catch((err) => console.warn('Background refresh error:', err));
    } catch (err) {
      console.error('[COMPLETION] Error confirming completion:', err);
      const errMsg = err.response?.data?.message || 'Failed to confirm completion. Please try again.';
      setCompletionError(errMsg);
      notify(errMsg, 'danger');
    } finally {
      setConfirmingCompletion(false);
    }
  };

  // After-service photo handlers (Part 4)
  const handleAfterPhotoSelect = (bookingId, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const current = afterPhotosState[bookingId] || { files: [], previews: [], error: '', uploading: false };
    if (current.files.length + files.length > 5) {
      setAfterPhotosState((prev) => ({
        ...prev,
        [bookingId]: { ...current, error: 'Maximum 5 completed work photos allowed.' }
      }));
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const newFiles = [];
    const newPreviews = [];

    for (const file of files) {
      if (!allowed.includes(file.type)) {
        setAfterPhotosState((prev) => ({
          ...prev,
          [bookingId]: { ...current, error: 'Only JPG, JPEG, PNG, and WEBP formats are supported.' }
        }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setAfterPhotosState((prev) => ({
          ...prev,
          [bookingId]: { ...current, error: `File "${file.name}" exceeds the 5 MB limit.` }
        }));
        return;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setAfterPhotosState((prev) => ({
      ...prev,
      [bookingId]: {
        files: [...current.files, ...newFiles],
        previews: [...current.previews, ...newPreviews],
        error: '',
        uploading: false
      }
    }));
    e.target.value = '';
  };

  const handleRemoveAfterPhoto = (bookingId, idx) => {
    const current = afterPhotosState[bookingId];
    if (!current) return;
    const revUrl = current.previews[idx];
    if (revUrl) URL.revokeObjectURL(revUrl);

    setAfterPhotosState((prev) => ({
      ...prev,
      [bookingId]: {
        ...current,
        files: current.files.filter((_, i) => i !== idx),
        previews: current.previews.filter((_, i) => i !== idx),
        error: ''
      }
    }));
  };

  const handleSubmitAfterPhotos = async (bookingId) => {
    const current = afterPhotosState[bookingId];
    if (!current || !current.files.length) return;

    setAfterPhotosState((prev) => ({
      ...prev,
      [bookingId]: { ...current, uploading: true, error: '' }
    }));

    try {
      const formData = new FormData();
      current.files.forEach((file) => formData.append('photos', file));

      const { data } = await api.post(`/bookings/${bookingId}/completion-photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      notify(data.message || 'Completed work photos uploaded successfully.', 'success');
      setAfterPhotosState((prev) => ({
        ...prev,
        [bookingId]: { files: [], previews: [], error: '', uploading: false }
      }));
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to upload completed work photos.';
      setAfterPhotosState((prev) => ({
        ...prev,
        [bookingId]: { ...current, uploading: false, error: msg }
      }));
      notify(msg, 'danger');
    }
  };

  // Handle Review Submission (Requirement 5)
  const handleStarSelect = (bookingId, rating) => {
    setReviewForms((prev) => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] || {}), rating }
    }));
  };

  const handleReviewCommentChange = (bookingId, comment) => {
    setReviewForms((prev) => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] || { rating: 5 }), comment }
    }));
  };

  const handleSubmitReview = async (bookingId) => {
    const form = reviewForms[bookingId] || { rating: 5, comment: '' };
    const rating = form.rating || 5;
    const comment = form.comment || '';

    setSubmittingReviewBookingId(bookingId);
    try {
      const { data } = await api.post(`/bookings/${bookingId}/review`, {
        rating,
        comment
      });
      notify(data.message, 'success');
      setReviewsMap((prev) => ({ ...prev, [bookingId]: data.review }));
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit review.', 'danger');
    } finally {
      setSubmittingReviewBookingId(null);
    }
  };

  // Handle Complaint Submission (Requirement 6)
  const handleOpenComplaintModal = (booking) => {
    setComplaintModalBooking(booking);
    setComplaintForm({
      category: CUSTOMER_COMPLAINT_CATEGORIES[0],
      description: '',
      attachment: ''
    });
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintForm.description.trim()) {
      notify('Please describe the complaint issue.', 'danger');
      return;
    }

    setSubmittingComplaint(true);
    try {
      const { data } = await api.post('/complaints/customer', {
        bookingId: complaintModalBooking._id,
        category: complaintForm.category,
        description: complaintForm.description.trim(),
        attachments: complaintForm.attachment ? [complaintForm.attachment.trim()] : []
      });
      notify(data.message, 'success');
      setComplaintModalBooking(null);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit complaint.', 'danger');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const { data } = await api.delete(`/bookings/${id}`);
      notify(data.message, 'success');
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Could not cancel booking.', 'danger');
    }
  };

  // Filter logic
  const filtered = bookings.filter((b) => {
    const statusMatch =
      filterTab === 'All'
        ? true
        : filterTab === 'Upcoming'
        ? ['Pending', 'Confirmed', 'Assigned', 'Accepted', 'In Progress'].includes(b.status)
        : filterTab === 'Completed'
        ? b.status === 'Completed'
        : filterTab === 'Cancelled'
        ? b.status === 'Cancelled'
        : true;

    const searchMatch =
      !searchTerm.trim() ||
      b.bookingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.serviceId?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    return statusMatch && searchMatch;
  });

  return (
    <div className="dashboard-layout">
      <DashboardSidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="dashboard-main">
        <div className="flex-between" style={{ marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary-navy)' }}>
              Booking History
            </h1>
            <p style={{ color: 'var(--secondary-text)', fontSize: '15px' }}>
              View and manage all your past, present, and scheduled home service appointments.
            </p>
          </div>

          <Link to="/services" className="btn btn-navy btn-small">
            + Book New Service
          </Link>
        </div>

        {/* Tab Filters */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['All', 'Upcoming', 'Completed', 'Cancelled'].map((tab) => (
                <button
                  key={tab}
                  className={`btn ${filterTab === tab ? 'btn-navy' : 'btn-outline'} btn-small`}
                  onClick={() => setFilterTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px' }}>
              <Search size={16} color="var(--secondary-text)" />
              <input
                type="text"
                className="form-input"
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <section className="card" style={{ padding: '24px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px' }}>Loading bookings history...</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <img
                src="/assets/images/home-maintenance.jpg"
                alt="No Bookings"
                style={{ width: '130px', height: '85px', objectFit: 'cover', borderRadius: 'var(--radius-md)', opacity: 0.8 }}
              />
              <h3>No bookings found</h3>
              <p style={{ color: 'var(--secondary-text)' }}>
                There are no bookings matching the selected filter.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filtered.map((b) => {
                const existingReview = reviewsMap[b._id];
                const activeForm = reviewForms[b._id] || { rating: 5, comment: '' };
                const currentRating = activeForm.rating || 5;
                const hovered = hoveredStars[b._id] || 0;
                const displayRating = hovered || currentRating;

                // Find if there is an existing complaint for this booking
                const existingComplaint = complaintsList.find(
                  (c) => c.bookingId?._id === b._id || c.bookingId === b._id || c.bookingId?.bookingId === b.bookingId
                );

                return (
                  <div
                    key={b._id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--white)',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {/* Top Row: Booking Details & Action Buttons */}
                    <div
                      style={{
                        padding: '18px 20px',
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto auto',
                        gap: '18px',
                        alignItems: 'center',
                        backgroundColor: '#fafbfc',
                        borderBottom: b.status === 'Completed' ? '1px solid var(--border-color)' : 'none'
                      }}
                    >
                      <img
                        src={b.serviceId?.image || '/assets/images/plumbing.jpg'}
                        alt={b.category}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/images/home-maintenance.jpg';
                        }}
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: 'var(--radius-md)',
                          objectFit: 'cover'
                        }}
                      />

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '16px', color: 'var(--primary-navy)' }}>
                            {b.serviceId?.name || b.category}
                          </strong>
                          <span className="badge badge-accepted" style={{ fontSize: '11px' }}>
                            {b.bookingId}
                          </span>
                          <span className={`badge badge-${b.status.toLowerCase().replace(/\s+/g, '')}`}>
                            {b.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '4px' }}>
                          Scheduled: {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {b.bookingTime} • {b.address}
                        </div>

                        {b.workerId && (
                          <div style={{ fontSize: '13px', color: 'var(--primary-navy)', fontWeight: 600, marginTop: '3px' }}>
                            Assigned Pro: {b.workerId.name} ({b.workerId.phone})
                          </div>
                        )}

                        {/* Customer Problem Photos (Before Service) */}
                        {b.problemPhotos && b.problemPhotos.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ImageIcon size={12} /> Problem Photos ({b.problemPhotos.length}):
                            </span>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {b.problemPhotos.map((p, pIdx) => (
                                <a key={pIdx} href={p.url} target="_blank" rel="noopener noreferrer" title="View Problem Photo">
                                  <img
                                    src={p.url}
                                    alt={`Problem ${pIdx + 1}`}
                                    style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', paddingRight: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--secondary-text)', textTransform: 'uppercase' }}>Amount</div>
                        <strong style={{ fontSize: '17px', color: 'var(--primary-navy)' }}>
                          ₹{Number(b.totalAmount).toLocaleString('en-IN')}
                        </strong>
                      </div>

                      {/* Action Buttons Column */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Track Worker button */}
                        {['Assigned', 'Accepted', 'In Progress'].includes(b.status) && (
                          <Link to={`/tracking/${b._id}`} className="btn btn-yellow btn-small">
                            <MapPinned size={14} /> Track Worker
                          </Link>
                        )}

                        {/* CONFIRM COMPLETION BUTTON (Requirement 4: For In Progress bookings) */}
                        {b.status === 'In Progress' && (
                          <button
                            className="btn btn-success btn-small"
                            onClick={() => setCompletionConfirmBooking(b)}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                          >
                            <CheckCircle2 size={15} /> Confirm Completion
                          </button>
                        )}

                        {/* Cancel button */}
                        {['Pending', 'Confirmed'].includes(b.status) && (
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleCancelBooking(b._id)}
                          >
                            Cancel
                          </button>
                        )}

                        {/* Raise Complaint Button for completed or ongoing jobs */}
                        {['In Progress', 'Completed'].includes(b.status) && (
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => handleOpenComplaintModal(b)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <AlertCircle size={14} /> Raise Complaint
                          </button>
                        )}

                        {['Completed', 'Cancelled'].includes(b.status) && (
                          <Link to="/services" className="btn btn-outline btn-small">
                            Rebook
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Complaint Status Banner if already filed */}
                    {existingComplaint && (
                      <div
                        style={{
                          backgroundColor: '#fef3c7',
                          borderTop: '1px solid #fde68a',
                          padding: '10px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '13px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertCircle size={16} color="#d97706" />
                          <span>
                            Complaint <strong>{existingComplaint.complaintId}</strong> ({existingComplaint.category}):{' '}
                            <em>"{existingComplaint.description}"</em>
                          </span>
                        </div>
                        <span className={`badge badge-${existingComplaint.status.toLowerCase().replace(/\s+/g, '')}`}>
                          Status: {existingComplaint.status}
                        </span>
                      </div>
                    )}

                    {/* STAR RATING SECTION (Requirement 5: Appears below Completed bookings) */}
                    {b.status === 'Completed' && (
                      <div style={{ padding: '20px', backgroundColor: 'var(--white)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <Star size={18} fill="#f59e0b" color="#f59e0b" />
                          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>
                            Rate Your Experience
                          </h4>
                        </div>

                        {existingReview ? (
                          /* Already Reviewed Display */
                          <div
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid var(--border-color)',
                              padding: '14px 18px',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '16px'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={18}
                                    fill={star <= existingReview.rating ? '#f59e0b' : '#cbd5e1'}
                                    color={star <= existingReview.rating ? '#f59e0b' : '#cbd5e1'}
                                  />
                                ))}
                                <strong style={{ marginLeft: '6px', color: 'var(--primary-navy)' }}>
                                  {RATING_LABELS[existingReview.rating]}
                                </strong>
                              </div>
                              {existingReview.comment && (
                                <p style={{ fontSize: '13px', color: 'var(--secondary-text)', marginTop: '6px', fontStyle: 'italic' }}>
                                  "{existingReview.comment}"
                                </p>
                              )}
                            </div>
                            <span className="badge badge-completed" style={{ fontSize: '11px' }}>
                              ✓ Review Submitted
                            </span>
                          </div>
                        ) : (
                          /* Star Selection & Submission Form */
                          <div
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid var(--border-color)',
                              padding: '16px 20px',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-navy)' }}>
                                Select Rating:
                              </span>
                              <div style={{ display: 'flex', gap: '6px', cursor: 'pointer' }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={24}
                                    fill={star <= displayRating ? '#f59e0b' : 'transparent'}
                                    color={star <= displayRating ? '#f59e0b' : '#94a3b8'}
                                    onMouseEnter={() =>
                                      setHoveredStars((prev) => ({ ...prev, [b._id]: star }))
                                    }
                                    onMouseLeave={() =>
                                      setHoveredStars((prev) => ({ ...prev, [b._id]: 0 }))
                                    }
                                    onClick={() => handleStarSelect(b._id, star)}
                                    style={{ transition: 'transform 0.15s ease', transform: star <= displayRating ? 'scale(1.1)' : 'scale(1)' }}
                                  />
                                ))}
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#b45309' }}>
                                {RATING_LABELS[displayRating]}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                              <textarea
                                rows="2"
                                className="form-textarea"
                                placeholder="Write an optional review about the service quality, worker professionalism, and experience..."
                                value={activeForm.comment || ''}
                                onChange={(e) => handleReviewCommentChange(b._id, e.target.value)}
                                style={{ flex: 1, fontSize: '13px' }}
                              />
                              <button
                                className="btn btn-navy"
                                onClick={() => handleSubmitReview(b._id)}
                                disabled={submittingReviewBookingId === b._id}
                                style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 18px' }}
                              >
                                <Send size={14} />
                                {submittingReviewBookingId === b._id ? 'Submitting...' : 'Submit Review'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* UPLOAD COMPLETED WORK PHOTOS SECTION (Part 4) */}
                    {b.status === 'Completed' && (() => {
                      const curAfter = afterPhotosState[b._id] || { files: [], previews: [], error: '', uploading: false };
                      const savedPhotos = b.completionPhotos || b.completedPhotos || [];
                      return (
                        <div style={{ padding: '18px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: '#fcfdfd' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Upload size={16} color="var(--primary-navy)" />
                              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>
                                Upload Completed Work Photos
                              </h4>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                              {savedPhotos.length} / 5 uploaded
                            </span>
                          </div>

                          <p style={{ fontSize: '13px', color: 'var(--secondary-text)', marginBottom: '12px', lineHeight: 1.4 }}>
                            Upload photographs of the completed work to verify service quality and record the final outcome.
                          </p>

                          {/* Existing Uploaded Photos */}
                          {savedPhotos.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: '6px' }}>
                                ✓ Verified After-Service Photos ({savedPhotos.length}):
                              </span>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {savedPhotos.map((ph, phIdx) => (
                                  <a key={phIdx} href={ph.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={ph.url}
                                      alt={`Completed ${phIdx + 1}`}
                                      style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                    />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Upload Picker if < 5 photos */}
                          {savedPhotos.length < 5 && (
                            <div style={{ backgroundColor: 'var(--white)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px dashed #cbd5e1' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <label className="btn btn-outline btn-small" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    multiple
                                    onChange={(e) => handleAfterPhotoSelect(b._id, e)}
                                    style={{ display: 'none' }}
                                  />
                                  <Upload size={13} /> Browse Photos
                                </label>
                                <span style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>
                                  JPG, JPEG, PNG, WEBP (Max 5 MB each)
                                </span>
                              </div>

                              {curAfter.error && (
                                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertCircle size={14} /> {curAfter.error}
                                </div>
                              )}

                              {curAfter.previews.length > 0 && (
                                <div style={{ marginTop: '10px' }}>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {curAfter.previews.map((prevUrl, pIdx) => (
                                      <div key={pIdx} style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                        <img src={prevUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAfterPhoto(b._id, pIdx)}
                                          style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    className="btn btn-navy btn-small"
                                    onClick={() => handleSubmitAfterPhotos(b._id)}
                                    disabled={curAfter.uploading}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    <Upload size={12} />
                                    {curAfter.uploading ? 'Uploading...' : `Upload ${curAfter.files.length} Photo(s)`}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* CONFIRM COMPLETION DIALOG (Requirement 4) */}
      {completionConfirmBooking && (
        <Modal
          isOpen={Boolean(completionConfirmBooking)}
          onClose={() => { setCompletionConfirmBooking(null); setCompletionError(''); }}
          title="Confirm Work Completion"
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
                  Booking ID: <strong>{completionConfirmBooking.bookingId}</strong> • Service:{' '}
                  {completionConfirmBooking.serviceId?.name || completionConfirmBooking.category}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--primary-text)', lineHeight: '1.5', marginBottom: '20px' }}>
              By confirming, you verify that the technician has finished all requested maintenance/repair tasks at your premises. Live GPS tracking will terminate and you will be able to submit a rating and feedback.
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
                onClick={() => setCompletionConfirmBooking(null)}
                disabled={confirmingCompletion}
              >
                No, Go Back
              </button>
              <button
                type="button"
                className="btn btn-success"
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

      {/* RAISE COMPLAINT MODAL (Requirement 6) */}
      {complaintModalBooking && (
        <Modal
          isOpen={Boolean(complaintModalBooking)}
          onClose={() => setComplaintModalBooking(null)}
          title="Raise a Service Complaint"
        >
          <form onSubmit={handleSubmitComplaint}>
            <p style={{ color: 'var(--secondary-text)', fontSize: '13px', marginBottom: '18px' }}>
              Please provide details about any issues encountered with this service. HomeTech administration investigates all reported complaints promptly.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                <label>Booking ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={complaintModalBooking.bookingId}
                  readOnly
                  style={{ background: '#f8fafc', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label>Assigned Professional</label>
                <input
                  type="text"
                  className="form-input"
                  value={complaintModalBooking.workerId?.name || 'Assigned Worker'}
                  readOnly
                  style={{ background: '#f8fafc' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Complaint Category *</label>
              <select
                className="form-select"
                value={complaintForm.category}
                onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
                required
              >
                {CUSTOMER_COMPLAINT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Complaint Description *</label>
              <textarea
                rows="4"
                className="form-textarea"
                placeholder="Explain the problem in detail (e.g. damages, delay, misconduct, incomplete repair)..."
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Optional Supporting Image URL / Photo Link</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. /assets/images/home-maintenance.jpg or photo link"
                value={complaintForm.attachment}
                onChange={(e) => setComplaintForm({ ...complaintForm, attachment: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setComplaintModalBooking(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={submittingComplaint}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={15} /> {submittingComplaint ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
