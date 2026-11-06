import { useState } from 'react';
import {
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Calendar,
  Briefcase,
  FileCheck,
  MessageSquare,
  Award
} from 'lucide-react';

export default function WorkerApplications({
  applications = [],
  approvedCategories = [],
  loading = false,
  onOpenApplyModal,
  onRefresh
}) {
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredApplications = applications.filter((app) => {
    if (filterStatus === 'all') return true;
    return app.applicationStatus === filterStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge badge-completed" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="badge badge-cancelled" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'partially_approved':
        return (
          <span className="badge badge-accepted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> Partially Approved
          </span>
        );
      default:
        return (
          <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> Pending Review
          </span>
        );
    }
  };

  return (
    <section className="card" style={{ padding: '24px', marginBottom: '28px' }}>
      {/* Top Header */}
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
            Additional Service Category Applications
          </h2>
          <p style={{ color: 'var(--secondary-text)', fontSize: '13px', marginTop: '4px' }}>
            Apply to expand your offerings and receive customer booking requests across multiple trades.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={onRefresh}
            title="Refresh Applications"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-navy btn-small"
            data-testid="apply-more-services-btn"
            onClick={onOpenApplyModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={15} />
            <span>Apply for More Services</span>
          </button>
        </div>
      </div>

      {/* Currently Approved Categories Card */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="var(--primary-navy)" />
            <strong style={{ fontSize: '14px', color: 'var(--primary-navy)' }}>
              Currently Approved Trade Categories
            </strong>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--secondary-text)', margin: '4px 0 0 0' }}>
            You are actively receiving job dispatch requests for these categories.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {approvedCategories && approvedCategories.length > 0 ? (
            approvedCategories.map((cat, idx) => (
              <span
                key={idx}
                className="badge badge-completed"
                style={{ fontSize: '13px', padding: '6px 12px', fontWeight: 600 }}
              >
                <CheckCircle2 size={13} style={{ marginRight: '4px' }} />
                {cat}
              </span>
            ))
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>None approved yet</span>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '20px'
        }}
      >
        {['all', 'pending', 'approved', 'rejected'].map((st) => (
          <button
            key={st}
            type="button"
            className={`btn btn-small ${filterStatus === st ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => setFilterStatus(st)}
            style={{ fontSize: '12px', textTransform: 'capitalize' }}
          >
            {st === 'all' ? `All Applications (${applications.length})` : st}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-text)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
          <p>Loading service applications...</p>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-color)'
          }}
        >
          <Layers size={48} color="var(--secondary-text)" style={{ margin: '0 auto 12px auto' }} />
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '6px' }}>
            No additional category applications yet
          </h4>
          <p style={{ color: 'var(--secondary-text)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            Ready to expand your services and earn more? Apply for additional trade categories such as Electrical, Carpentry, Painting, or AC Repair.
          </p>
          <button
            type="button"
            className="btn btn-navy btn-small"
            data-testid="apply-more-services-empty-btn"
            onClick={onOpenApplyModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Apply for More Services
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredApplications.map((app) => {
            const requested = app.requestedCategories && app.requestedCategories.length > 0
              ? app.requestedCategories
              : (app.selectedCategories || []);
            const approved = app.approvedCategories || [];
            const rejected = app.rejectedCategories || [];

            return (
              <div
                key={app._id}
                data-testid={`application-card-${app._id}`}
                className="application-card"
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 20px',
                  backgroundColor: 'var(--white)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '12px',
                    marginBottom: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--secondary-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} />
                      Submitted: {new Date(app.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>•</span>
                    <span style={{ fontSize: '12px', color: 'var(--secondary-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Briefcase size={13} /> Experience: {app.experience || 1} year(s)
                    </span>
                  </div>

                  <div>{getStatusBadge(app.applicationStatus)}</div>
                </div>

                {/* Requested Categories */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-text)', display: 'block', marginBottom: '6px' }}>
                    Requested Categories:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {requested.map((cat, i) => {
                      const isApproved = approved.includes(cat);
                      const isRejected = rejected.includes(cat);
                      let badgeClass = 'badge-pending';
                      if (isApproved) badgeClass = 'badge-completed';
                      else if (isRejected) badgeClass = 'badge-cancelled';

                      return (
                        <span
                          key={i}
                          className={`badge ${badgeClass}`}
                          style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 600 }}
                        >
                          {isApproved && <CheckCircle2 size={12} style={{ marginRight: '4px' }} />}
                          {isRejected && <XCircle size={12} style={{ marginRight: '4px' }} />}
                          {cat}
                          {isApproved && ' (Approved)'}
                          {isRejected && ' (Rejected)'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Qualification details if present */}
                {app.professionalDescription && (
                  <p style={{ fontSize: '13px', color: 'var(--primary-text)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    <strong>Qualifications & Experience: </strong>
                    {app.professionalDescription}
                  </p>
                )}

                {/* Admin notes banner */}
                {(app.adminNotes || app.rejectionReason) ? (
                  <div
                    style={{
                      backgroundColor: app.applicationStatus === 'rejected' ? '#fef2f2' : '#eff6ff',
                      borderLeft: `4px solid ${app.applicationStatus === 'rejected' ? '#ef4444' : '#3b82f6'}`,
                      padding: '12px 16px',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      marginTop: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <MessageSquare size={14} color={app.applicationStatus === 'rejected' ? '#b91c1c' : '#1d4ed8'} />
                      <strong style={{ fontSize: '13px', color: app.applicationStatus === 'rejected' ? '#991b1b' : '#1e40af' }}>
                        Administrator Review Note
                      </strong>
                      {app.reviewedAt && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          • {new Date(app.reviewedAt).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: app.applicationStatus === 'rejected' ? '#7f1d1d' : '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
                      {app.adminNotes || app.rejectionReason}
                    </p>
                  </div>
                ) : app.applicationStatus === 'pending' ? (
                  <p style={{ fontSize: '12px', color: '#b45309', margin: 0 }}>
                    • Your application is currently under review by our administration team. You will be notified once a decision is made.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
