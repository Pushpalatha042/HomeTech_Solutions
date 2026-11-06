import { useState } from 'react';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';

export default function WorkerComplaints({
  complaints = [],
  loading = false,
  onOpenComplaintModal,
  onRefresh
}) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComplaints = complaints.filter((comp) => {
    const matchesStatus = filterStatus === 'all' || comp.status === filterStatus;
    const matchesSearch =
      !searchQuery.trim() ||
      (comp.complaintId && comp.complaintId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (comp.category && comp.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (comp.description && comp.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (comp.bookingId?.bookingId && comp.bookingId.bookingId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="badge badge-completed" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> Resolved
          </span>
        );
      case 'Rejected':
        return (
          <span className="badge badge-cancelled" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'Under Review':
        return (
          <span className="badge badge-accepted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> Under Review
          </span>
        );
      default:
        return (
          <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> Submitted
          </span>
        );
    }
  };

  return (
    <section className="card" style={{ padding: '24px', marginBottom: '28px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-navy)', margin: 0 }}>
            My Complaints & Grievance History
          </h2>
          <p style={{ color: 'var(--secondary-text)', fontSize: '13px', marginTop: '4px' }}>
            Report problems, customer misconduct, payment disputes, or safety concerns. Track administrator investigation responses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={onRefresh}
            title="Refresh Complaints"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-danger btn-small"
            data-testid="raise-complaint-btn"
            onClick={onOpenComplaintModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <AlertCircle size={15} />
            <span>Raise a Complaint</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px'
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['all', 'Submitted', 'Under Review', 'Resolved', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-small ${filterStatus === st ? 'btn-navy' : 'btn-outline'}`}
              onClick={() => setFilterStatus(st)}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {st === 'all' ? `All (${complaints.length})` : st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--secondary-text)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by ID or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
          />
        </div>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-text)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
          <p>Loading complaints...</p>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-color)'
          }}
        >
          <ShieldAlert size={48} color="var(--secondary-text)" style={{ margin: '0 auto 12px auto' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '6px' }}>
            No complaints submitted yet
          </h4>
          <p style={{ color: 'var(--secondary-text)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            If you experience unsafe working conditions, customer misconduct, incorrect job information, or payment disputes, raise a complaint directly to administrators.
          </p>
          <button
            type="button"
            className="btn btn-navy btn-small"
            onClick={onOpenComplaintModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Raise a Complaint
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredComplaints.map((comp) => (
            <div
              key={comp._id}
              data-testid={`complaint-card-${comp.complaintId}`}
              className="complaint-card"
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                backgroundColor: 'var(--white)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              {/* Top Row: Ref ID, Category, Status, Date */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '12px',
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '15px', color: 'var(--primary-navy)' }}>
                    {comp.complaintId}
                  </strong>
                  <span className="badge badge-accepted" style={{ fontSize: '12px' }}>
                    {comp.category}
                  </span>
                  {comp.bookingId && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--secondary-text)',
                        backgroundColor: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}
                    >
                      Booking: <strong>{comp.bookingId.bookingId || comp.bookingId}</strong>
                      {comp.customerId?.name && ` (${comp.customerId.name})`}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--secondary-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} />
                    {new Date(comp.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  {getStatusBadge(comp.status)}
                </div>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--primary-text)',
                  lineHeight: '1.6',
                  margin: '0 0 12px 0',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {comp.description}
              </p>

              {/* Attachments if any */}
              {comp.attachments && comp.attachments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-text)' }}>
                    Attachments:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {comp.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: 'var(--primary-navy)',
                          textDecoration: 'underline'
                        }}
                      >
                        <FileText size={13} /> Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Administrator Response Banner */}
              {comp.adminNotes ? (
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    borderLeft: '4px solid #3b82f6',
                    padding: '12px 16px',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                    marginTop: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <MessageSquare size={14} color="#1d4ed8" />
                    <strong style={{ fontSize: '13px', color: '#1e40af' }}>
                      Administrator Response
                    </strong>
                    {comp.resolvedAt && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        • {new Date(comp.resolvedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: '#1e3a8a', margin: 0, lineHeight: '1.5' }}>
                    {comp.adminNotes}
                  </p>
                </div>
              ) : comp.status === 'Submitted' ? (
                <p style={{ fontSize: '12px', color: '#b45309', margin: 0 }}>
                  • Awaiting administrator review and investigation.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
