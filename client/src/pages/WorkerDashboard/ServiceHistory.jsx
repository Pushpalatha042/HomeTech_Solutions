import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  AlertCircle,
  RefreshCw,
  Eye,
  ArrowLeft,
  Camera,
  FileText,
  Check,
  Briefcase,
  Mail,
  CreditCard,
  Image as ImageIcon,
  ShieldCheck,
  X
} from 'lucide-react';
import api from '../../api';
import Modal from '../../components/common/Modal';

const CATEGORIES = [
  'All',
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Carpentry',
  'Painting',
  'Appliance Repair',
  'Pest Control'
];

export default function ServiceHistory({
  onBackToDashboard,
  onRaiseComplaint,
  complaintsList = [],
  onRefreshComplaints
}) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 6;

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSort, setSelectedSort] = useState('newest');

  // Single Service Details View
  const [selectedService, setSelectedService] = useState(null);

  // View Complaint Modal State
  const [viewComplaintModal, setViewComplaintModal] = useState(null);

  const getJobComplaints = (job) => {
    if (!job) return [];
    if (job.complaints && job.complaints.length > 0) return job.complaints;
    return complaintsList.filter((c) => {
      const bId = c.bookingId?._id || c.bookingId;
      const bRef = c.bookingId?.bookingId || c.bookingId;
      return bId === job._id || bRef === job.bookingId;
    });
  };

  const fetchServiceHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        sort: selectedSort
      };
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedDate) params.date = selectedDate;

      let res;
      try {
        res = await api.get('/worker/service-history', { params });
      } catch (fallbackErr) {
        res = await api.get('/workers/service-history', { params });
      }

      const data = res.data;
      const list = Array.isArray(data) ? data : data.services || [];
      setServices(list);
      setTotal(data.total != null ? data.total : list.length);
      setTotalCompleted(data.totalCompleted != null ? data.totalCompleted : list.length);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('fetchServiceHistory error:', err);
      setError(err.response?.data?.message || 'Failed to load service history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedSort, appliedSearch, selectedCategory, selectedDate]);

  useEffect(() => {
    fetchServiceHistory();
  }, [fetchServiceHistory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchTerm);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setSelectedCategory('All');
    setSelectedDate('');
    setSelectedSort('newest');
    setPage(1);
  };

  const hasActiveFilters = Boolean(appliedSearch || (selectedCategory && selectedCategory !== 'All') || selectedDate || selectedSort !== 'newest');

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Render Single Service Details View
  if (selectedService) {
    const s = selectedService;
    const cust = s.customerId || {};
    const serv = s.serviceId || {};
    const beforePhotos = s.beforePhotos || s.problemPhotos || [];
    const afterPhotos = s.afterPhotos || s.completionPhotos || s.completedPhotos || [];

    return (
      <div className="service-history-details">
        {/* Top Back Navigation Bar */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setSelectedService(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <ArrowLeft size={16} /> Back to Service History
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onRaiseComplaint && (
              <button
                type="button"
                className="btn btn-outline"
                data-testid={`raise-complaint-btn-${s.bookingId}`}
                onClick={() => onRaiseComplaint(s)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <AlertCircle size={15} /> Raise a Complaint
              </button>
            )}
            <span className="badge badge-completed" style={{ fontSize: '13px', padding: '6px 14px' }}>
              <CheckCircle2 size={15} /> Final Status: Completed
            </span>
          </div>
        </div>

        {/* Main Service Details Card */}
        <div className="card" style={{ padding: '32px', marginBottom: '28px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Completed Service Record
                </span>
                <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary-navy)', margin: '4px 0 0' }}>
                  {serv.name || s.category}
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', color: 'var(--secondary-text)', display: 'block' }}>Booking Identifier</span>
                <strong style={{ fontSize: '18px', color: 'var(--primary-navy)', letterSpacing: '1px' }}>
                  {s.bookingId}
                </strong>
              </div>
            </div>
          </div>

          {/* Complaint Status Alert if submitted (Requirement 6) */}
          {(() => {
            const complaints = getJobComplaints(s);
            if (complaints.length === 0) return null;
            const latest = complaints[0];
            return (
              <div
                data-testid={`complaint-info-${s.bookingId}`}
                style={{
                  marginBottom: '24px',
                  padding: '16px 20px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-md)',
                  color: '#92400e'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle size={20} color="#b45309" />
                    <div>
                      <strong style={{ fontSize: '15px' }}>Complaint: #{latest.complaintId}</strong>
                      <span style={{ marginLeft: '8px', fontSize: '13px' }}>({latest.category})</span>
                    </div>
                  </div>
                  <span
                    className={`badge badge-${(latest.status || 'submitted').toLowerCase().replace(/\s+/g, '')}`}
                    data-testid={`complaint-badge-${s.bookingId}`}
                  >
                    Status: {latest.status}
                  </span>
                </div>
                <p style={{ margin: '10px 0 6px', fontSize: '14px', color: '#78350f' }}>
                  "{latest.description}"
                </p>
                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span>Submitted: {new Date(latest.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {latest.adminNotes && (
                    <span style={{ color: '#047857', fontWeight: 700 }}>
                      Admin Response: {latest.adminNotes}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 3-Column Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '28px' }}>
            {/* Customer Details Box */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="var(--primary-navy)" /> Customer Details
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Client Name</span>
                  <strong>{cust.name || 'Customer'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Contact Phone</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} color="var(--secondary-text)" />
                    <span>{s.contactNumber || cust.phone || 'Provided on booking'}</span>
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Service Address</span>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={14} color="var(--secondary-text)" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <span>{s.address || 'Address on record'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Service & Payment Box */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={16} color="var(--primary-navy)" /> Service & Payment
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Category</span>
                  <span className="badge badge-accepted" style={{ fontSize: '12px', display: 'inline-block' }}>
                    {s.category}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Total Amount Paid</span>
                  <strong style={{ fontSize: '20px', color: 'var(--primary-navy)' }}>
                    ₹{Number(s.totalAmount || serv.price || 0).toLocaleString('en-IN')}
                  </strong>
                  <span className="badge badge-completed" style={{ marginLeft: '8px', fontSize: '11px' }}>
                    Paid
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Work Description / Instructions</span>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--primary-text)', lineHeight: 1.4 }}>
                    {s.instructions || serv.description || 'Standard service requested.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Timestamps Box */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--primary-navy)" /> Job Timestamps
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Scheduled Date & Slot</span>
                  <strong>{formatDate(s.bookingDate)} • {s.bookingTime || 'Scheduled'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Work Started Time</span>
                  <span>{formatDateTime(s.startedAt || s.arrivalVerifiedAt)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '12px' }}>Completion Time</span>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                    {formatDateTime(s.completedAt || s.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Rating and Feedback Card */}
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              marginBottom: '28px'
            }}
          >
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={18} fill="#f59e0b" color="#f59e0b" /> Customer Rating & Feedback
            </h4>
            {s.rating ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={20}
                        fill={star <= s.rating ? '#f59e0b' : 'transparent'}
                        color={star <= s.rating ? '#f59e0b' : '#cbd5e1'}
                      />
                    ))}
                  </div>
                  <strong style={{ fontSize: '15px', color: '#b45309' }}>
                    {s.rating}.0 / 5.0 Stars
                  </strong>
                </div>
                {s.feedback ? (
                  <p style={{ margin: 0, fontSize: '14px', color: '#78350f', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{s.feedback}"
                  </p>
                ) : (
                  <span style={{ fontSize: '13px', color: '#92400e' }}>Rating provided without written comment.</span>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                No customer rating or review has been submitted for this service yet.
              </p>
            )}
          </div>

          {/* Before & After Service Photos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Before-Service Photos */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} /> Before-Service Photos ({beforePhotos.length})
              </h4>
              {beforePhotos.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {beforePhotos.map((photo, idx) => (
                    <a
                      key={idx}
                      href={photo.url || photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}
                    >
                      <img
                        src={photo.url || photo}
                        alt={`Before service ${idx + 1}`}
                        style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                  No before-service photos were uploaded for this booking.
                </p>
              )}
            </div>

            {/* After-Service Photos */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="var(--success)" /> After-Service Photos ({afterPhotos.length})
              </h4>
              {afterPhotos.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {afterPhotos.map((photo, idx) => (
                    <a
                      key={idx}
                      href={photo.url || photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}
                    >
                      <img
                        src={photo.url || photo}
                        alt={`After service ${idx + 1}`}
                        style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                  No completion photos on record for this booking.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="service-history-section">
      {/* Page Header */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px', borderLeft: '5px solid var(--accent-yellow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-navy)', margin: 0 }}>
                Service History
              </h2>
              <span className="badge badge-completed" style={{ fontSize: '12px' }}>
                {totalCompleted} Completed {totalCompleted === 1 ? 'Job' : 'Jobs'}
              </span>
            </div>
            <p style={{ color: 'var(--secondary-text)', fontSize: '14px', margin: '4px 0 0' }}>
              Review your previously completed jobs, customer ratings, completion timestamps, and work photos.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={fetchServiceHistory}
              title="Refresh service history"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {onBackToDashboard && (
              <button
                type="button"
                className="btn btn-navy btn-small"
                onClick={onBackToDashboard}
              >
                Dashboard Overview
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter, Search & Sort Control Panel */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
            {/* Search Input */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)' }}>
                Search by Name or ID
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Customer name or Booking ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingRight: '36px' }}
                />
                <button
                  type="submit"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-navy)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Search"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)' }}>
                Service Category
              </label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Completion Date Filter */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)' }}>
                Completion Date
              </label>
              <input
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Sort Order */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)' }}>
                Sort Order
              </label>
              <select
                className="form-select"
                value={selectedSort}
                onChange={(e) => {
                  setSelectedSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Active Filter Indicators & Clear Action */}
          {hasActiveFilters && (
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                Filtering active: Showing <strong>{total}</strong> of <strong>{totalCompleted}</strong> completed jobs
              </span>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={handleClearFilters}
                style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> Reset Filters
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ERROR STATE */}
      {error && !loading && (
        <div
          className="card"
          style={{
            padding: '24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#b91c1c" />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-navy btn-small"
            onClick={fetchServiceHistory}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--secondary-text)' }}>
          <RefreshCw size={32} className="spin-animation" style={{ color: 'var(--primary-navy)', margin: '0 auto 14px' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)' }}>
            Loading Service History...
          </h4>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
            Retrieving completed jobs and customer reviews from database.
          </p>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && services.length === 0 && (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--secondary-text)' }}>
          <Briefcase size={44} style={{ color: '#cbd5e1', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
            {hasActiveFilters ? 'No Completed Services Found' : 'No completed services yet'}
          </h3>
          <p style={{ fontSize: '14px', maxWidth: '440px', margin: '6px auto 18px', lineHeight: 1.5 }}>
            {hasActiveFilters
              ? 'No completed service jobs match your current search or filter criteria. Try adjusting your parameters.'
              : 'You have not completed any service appointments yet. As you fulfill assigned work requests, your completed service records will appear here.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={handleClearFilters}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* COMPLETED SERVICES LIST / TABLE */}
      {!loading && !error && services.length > 0 && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {services.map((job) => {
              const cust = job.customerId || {};
              const serv = job.serviceId || {};
              const beforeCount = (job.beforePhotos || job.problemPhotos || []).length;
              const afterCount = (job.afterPhotos || job.completionPhotos || job.completedPhotos || []).length;

              return (
                <div
                  key={job._id}
                  className="card"
                  style={{
                    padding: '24px',
                    transition: 'box-shadow 0.2s ease',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '16px', color: 'var(--primary-navy)', letterSpacing: '0.5px' }}>
                          {job.bookingId}
                        </strong>
                        <span className="badge badge-completed" style={{ fontSize: '11px' }}>
                          <CheckCircle2 size={12} /> Completed
                        </span>
                        <span className="badge badge-accepted" style={{ fontSize: '11px' }}>
                          {job.category}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', margin: '0 0 4px' }}>
                        {serv.name || job.category}
                      </h3>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--secondary-text)', display: 'block' }}>Total Paid</span>
                      <strong style={{ fontSize: '18px', color: 'var(--primary-navy)' }}>
                        ₹{Number(job.totalAmount || serv.price || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  {/* Service Meta Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '13px', background: '#f8fafc', padding: '14px 18px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                    <div>
                      <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px' }}>Customer</span>
                      <strong>{cust.name || 'Customer'}</strong>
                      <div style={{ color: 'var(--secondary-text)', fontSize: '12px', marginTop: '2px' }}>
                        {job.contactNumber || cust.phone || 'Phone verified'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px' }}>Address</span>
                      <span style={{ display: 'block', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.address || 'Address on record'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px' }}>Booking Scheduled</span>
                      <span>{formatDate(job.bookingDate)} • {job.bookingTime || 'Scheduled'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--secondary-text)', display: 'block', fontSize: '11px' }}>Completed At</span>
                      <strong style={{ color: 'var(--success)' }}>
                        {formatDateTime(job.completedAt || job.updatedAt)}
                      </strong>
                    </div>
                  </div>

                  {/* COMPLAINT STATUS SECTION (Requirement 6) */}
                  {(() => {
                    const jobComplaints = getJobComplaints(job);
                    if (jobComplaints.length === 0) return null;
                    const latest = jobComplaints[0];
                    return (
                      <div
                        data-testid={`complaint-info-${job.bookingId}`}
                        style={{
                          marginBottom: '14px',
                          padding: '12px 16px',
                          background: '#fef3c7',
                          border: '1px solid #fde68a',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          color: '#92400e'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={15} color="#b45309" />
                            <strong data-testid={`complaint-id-${job.bookingId}`}>#{latest.complaintId}</strong>
                            <span style={{ color: '#78350f' }}>• {latest.category}</span>
                          </div>
                          <span
                            className={`badge badge-${(latest.status || 'submitted').toLowerCase().replace(/\s+/g, '')}`}
                            data-testid={`complaint-badge-${job.bookingId}`}
                          >
                            Complaint: {latest.status}
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 4px', fontSize: '13px', color: '#78350f' }}>
                          "{latest.description}"
                        </p>
                        <div style={{ marginTop: '4px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span>Submitted: {new Date(latest.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          {latest.adminNotes && (
                            <span style={{ color: '#047857', fontWeight: 700 }}>
                              Admin Response: {latest.adminNotes}
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            data-testid={`view-complaint-btn-${job.bookingId}`}
                            onClick={() => setViewComplaintModal({ complaint: latest, job })}
                            style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff' }}
                          >
                            <Eye size={12} /> View Details ({jobComplaints.length})
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Rating, Photos & Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {/* Rating Snippet */}
                      {job.rating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={14}
                                fill={star <= job.rating ? '#f59e0b' : 'transparent'}
                                color={star <= job.rating ? '#f59e0b' : '#cbd5e1'}
                              />
                            ))}
                          </div>
                          <strong style={{ fontSize: '13px', color: '#b45309' }}>
                            {job.rating}.0
                          </strong>
                          {job.feedback && (
                            <span style={{ fontSize: '12px', color: 'var(--secondary-text)', fontStyle: 'italic', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              — "{job.feedback}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
                          No rating submitted
                        </span>
                      )}

                      {/* Photo Counts */}
                      {(beforeCount > 0 || afterCount > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--secondary-text)' }}>
                          <Camera size={14} />
                          {beforeCount > 0 && <span>{beforeCount} Before</span>}
                          {beforeCount > 0 && afterCount > 0 && <span>•</span>}
                          {afterCount > 0 && <span>{afterCount} After</span>}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {onRaiseComplaint && (
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          data-testid={`raise-complaint-btn-${job.bookingId}`}
                          onClick={() => onRaiseComplaint(job)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <AlertCircle size={14} /> Raise a Complaint
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-navy btn-small"
                        onClick={() => setSelectedService(job)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Eye size={14} /> View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total jobs)
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: View Complaint Details (Requirement 6) */}
      {viewComplaintModal && (
        <Modal
          isOpen={Boolean(viewComplaintModal)}
          onClose={() => setViewComplaintModal(null)}
          title={`Complaint Record — #${viewComplaintModal.complaint.complaintId}`}
          maxWidth="580px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: '#f8fafc',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '13px'
              }}
            >
              <div>
                <span style={{ color: 'var(--secondary-text)', fontSize: '11px', display: 'block' }}>Complaint Reference</span>
                <strong>#{viewComplaintModal.complaint.complaintId}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', fontSize: '11px', display: 'block' }}>Booking Identifier</span>
                <strong>#{viewComplaintModal.job.bookingId}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', fontSize: '11px', display: 'block' }}>Category</span>
                <strong>{viewComplaintModal.complaint.category}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', fontSize: '11px', display: 'block' }}>Status</span>
                <span className={`badge badge-${(viewComplaintModal.complaint.status || 'submitted').toLowerCase().replace(/\s+/g, '')}`}>
                  {viewComplaintModal.complaint.status}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', fontSize: '11px', display: 'block' }}>Submission Timestamp</span>
                <span>{new Date(viewComplaintModal.complaint.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)', fontSize: '11px', display: 'block' }}>Customer</span>
                <strong>{viewComplaintModal.job.customerId?.name || 'Customer'}</strong>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)', display: 'block', marginBottom: '6px' }}>
                Complaint Description
              </label>
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '14px',
                  color: 'var(--primary-navy)',
                  lineHeight: 1.5
                }}
              >
                {viewComplaintModal.complaint.description}
              </div>
            </div>

            {viewComplaintModal.complaint.adminNotes && (
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: '#065f46'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                  Administrative Response & Resolution
                </div>
                <div style={{ fontSize: '14px' }}>
                  {viewComplaintModal.complaint.adminNotes}
                </div>
                {viewComplaintModal.complaint.resolvedAt && (
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '6px' }}>
                    Resolved at: {new Date(viewComplaintModal.complaint.resolvedAt).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-navy"
                onClick={() => setViewComplaintModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
