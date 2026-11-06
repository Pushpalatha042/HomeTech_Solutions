import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Users,
  Briefcase,
  CalendarDays,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  MapPinned,
  ShieldCheck,
  Power,
  Layers,
  Wrench,
  CreditCard,
  BarChart3,
  Edit,
  Trash2,
  AlertCircle,
  Eye,
  Check,
  FileText,
  Star,
  Printer,
  Image as ImageIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import LiveMap from '../../components/tracking/LiveMap';
import api from '../../api';

const COLORS = ['#071D49', '#FFC928', '#198754', '#0284C7', '#DC3545', '#8b5cf6'];

export default function AdminDashboard() {
  const { notify } = useAuth();
  const location = useLocation();
  const searchTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(searchTab || 'dashboard');

  useEffect(() => {
    if (searchTab) {
      setActiveTab(searchTab);
    }
  }, [searchTab]);
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab Data States
  const [usersList, setUsersList] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [applications, setApplications] = useState([]);
  const [workersList, setWorkersList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [liveWorkers, setLiveWorkers] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [workDiagnostics, setWorkDiagnostics] = useState(null);

  // Complaints Management State (Requirement 8)
  const [complaintsList, setComplaintsList] = useState([]);
  const [complaintFilter, setComplaintFilter] = useState('all'); // 'all' | 'customer' | 'worker'
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintCategoryFilter, setComplaintCategoryFilter] = useState('all');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('all');
  const [investigateComplaint, setInvestigateComplaint] = useState(null);
  const [investigateStatus, setInvestigateStatus] = useState('Submitted');
  const [investigateNotes, setInvestigateNotes] = useState('');
  const [updatingComplaint, setUpdatingComplaint] = useState(false);

  // Additional Categories Applications State (Feature 2)
  const [additionalApplications, setAdditionalApplications] = useState([]);
  const [appSectionTab, setAppSectionTab] = useState('onboarding'); // 'onboarding' | 'additional'
  const [reviewAdditionalModalApp, setReviewAdditionalModalApp] = useState(null);
  const [reviewApprovedCats, setReviewApprovedCats] = useState([]);
  const [reviewAdminNotes, setReviewAdminNotes] = useState('');
  const [reviewingAdditional, setReviewingAdditional] = useState(false);

  // Modals
  const [approveModalApp, setApproveModalApp] = useState(null);
  const [approveSelectedCats, setApproveSelectedCats] = useState([]);
  const [assignModalBooking, setAssignModalBooking] = useState(null);
  const [inspectionReportBooking, setInspectionReportBooking] = useState(null);
  const [inspectionReview, setInspectionReview] = useState(null);
  const [loadingReportReview, setLoadingReportReview] = useState(false);
  const [newServiceModalOpen, setNewServiceModalOpen] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    name: '',
    category: 'Plumbing',
    description: '',
    price: '',
    features: ''
  });

  // Fetch Overview Stats
  const fetchOverview = async () => {
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data.stats);
      setRecentBookings(data.recentBookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Fetch Tab Specific Data
  useEffect(() => {
    if (activeTab === 'users') {
      api.get('/admin/users').then(({ data }) => setUsersList(data));
    } else if (activeTab === 'applications') {
      api.get('/worker-applications').then(({ data }) => setApplications(data));
      api.get('/admin/worker-applications/additional').then(({ data }) => setAdditionalApplications(data)).catch(() => {});
    } else if (activeTab === 'workers') {
      api.get('/admin/workers').then(({ data }) => setWorkersList(data));
    } else if (activeTab === 'services') {
      api.get('/services').then(({ data }) => setServicesList(data));
      api.get('/categories').then(({ data }) => setCategoriesList(data));
    } else if (activeTab === 'bookings') {
      api.get('/bookings').then(({ data }) => setAllBookings(data));
      api.get('/admin/workers').then(({ data }) => setWorkersList(data));
    } else if (activeTab === 'payments') {
      api.get('/payments').then(({ data }) => setAllPayments(data.payments || []));
    } else if (activeTab === 'tracking') {
      api.get('/tracking/admin/live-workers').then(({ data }) => setLiveWorkers(data));
    } else if (activeTab === 'reports') {
      api.get('/admin/reports').then(({ data }) => setReportsData(data));
      api.get('/admin/diagnostics/work-distribution').then(({ data }) => setWorkDiagnostics(data.diagnostics)).catch(() => {});
    } else if (activeTab === 'complaints') {
      api.get('/admin/complaints').then(({ data }) => setComplaintsList(data));
    }
  }, [activeTab]);

  // Handle User Toggle Status
  const handleToggleUser = async (userId) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/status`);
      notify(data.message, 'success');
      setUsersList((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive: data.user.isActive } : u))
      );
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update user status.', 'danger');
    }
  };

  // Open Application Approval Modal
  const openApproveModal = (app) => {
    setApproveModalApp(app);
    setApproveSelectedCats(app.selectedCategories || []);
  };

  // Submit Application Approval
  const handleApproveApplication = async () => {
    if (!approveModalApp) return;
    try {
      const { data } = await api.put(`/worker-applications/${approveModalApp._id}/approve`, {
        approvedCategories: approveSelectedCats
      });
      notify(data.message, 'success');
      setApproveModalApp(null);
      // Refresh applications & overview
      api.get('/worker-applications').then(({ data }) => setApplications(data));
      fetchOverview();
    } catch (err) {
      notify('Failed to approve application.', 'danger');
    }
  };

  // Reject Application
  const handleRejectApplication = async (appId) => {
    const reason = window.prompt('Enter rejection reason for this application:');
    if (reason === null) return;
    try {
      const { data } = await api.put(`/worker-applications/${appId}/reject`, {
        rejectionReason: reason || 'Does not meet criteria'
      });
      notify(data.message, 'info');
      api.get('/worker-applications').then(({ data }) => setApplications(data));
      fetchOverview();
    } catch (err) {
      notify('Failed to reject application.', 'danger');
    }
  };

  // Additional Categories Application Handlers (Feature 2)
  const handleOpenReviewAdditionalModal = (app) => {
    setReviewAdditionalModalApp(app);
    setReviewApprovedCats(app.requestedCategories || []);
    setReviewAdminNotes(app.adminNotes || '');
  };

  const handleReviewAdditional = async (action) => {
    if (!reviewAdditionalModalApp) return;
    setReviewingAdditional(true);
    try {
      const payload = {
        action,
        approvedCategories: action === 'approve' ? reviewApprovedCats : [],
        rejectedCategories:
          action === 'reject'
            ? reviewAdditionalModalApp.requestedCategories || []
            : (reviewAdditionalModalApp.requestedCategories || []).filter(
                (c) => !reviewApprovedCats.includes(c)
              ),
        adminNotes: reviewAdminNotes
      };
      const { data } = await api.put(
        `/admin/worker-applications/${reviewAdditionalModalApp._id}/review-additional`,
        payload
      );
      notify(data.message, action === 'approve' ? 'success' : 'info');
      setReviewAdditionalModalApp(null);
      // Refresh additional applications & workers
      api.get('/admin/worker-applications/additional').then(({ data }) => setAdditionalApplications(data)).catch(() => {});
      api.get('/admin/workers').then(({ data }) => setWorkersList(data)).catch(() => {});
      fetchOverview();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to review additional application.', 'danger');
    } finally {
      setReviewingAdditional(false);
    }
  };

  // Handle Manual Worker Assignment
  const handleAssignWorker = async (bookingId, workerId) => {
    try {
      const { data } = await api.put(`/bookings/${bookingId}/assign`, { workerId });
      notify(data.message, 'success');
      setAssignModalBooking(null);
      api.get('/bookings').then(({ data }) => setAllBookings(data));
      fetchOverview();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to assign worker.', 'danger');
    }
  };

  // Open Service Inspection & Photo Report Modal (Part 4)
  const handleOpenInspectionReport = async (booking) => {
    setInspectionReportBooking(booking);
    setInspectionReview(null);
    setLoadingReportReview(true);
    try {
      const { data } = await api.get(`/bookings/${booking._id}/review`);
      setInspectionReview(data);
    } catch (e) {
      setInspectionReview(null);
    } finally {
      setLoadingReportReview(false);
    }
  };

  // Create New Service
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newServiceForm.name.trim(),
        category: newServiceForm.category,
        description: newServiceForm.description.trim(),
        price: Number(newServiceForm.price),
        features: newServiceForm.features.split(',').map((f) => f.trim()).filter(Boolean)
      };
      const { data } = await api.post('/services', payload);
      notify(data.message, 'success');
      setNewServiceModalOpen(false);
      setNewServiceForm({ name: '', category: 'Plumbing', description: '', price: '', features: '' });
      api.get('/services').then(({ data }) => setServicesList(data));
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to create service.', 'danger');
    }
  };

  // Complaint Management Actions (Requirement 8)
  const handleOpenInvestigateModal = (complaint) => {
    setInvestigateComplaint(complaint);
    setInvestigateStatus(complaint.status || 'Submitted');
    setInvestigateNotes(complaint.adminNotes || '');
  };

  const handleUpdateComplaintStatus = async (overrideStatus) => {
    if (!investigateComplaint) return;
    const finalStatus = overrideStatus || investigateStatus;
    setUpdatingComplaint(true);
    try {
      const { data } = await api.put(`/admin/complaints/${investigateComplaint._id}/status`, {
        status: finalStatus,
        adminNotes: investigateNotes
      });
      notify(data.message, 'success');
      setComplaintsList((prev) =>
        prev.map((c) => (c._id === investigateComplaint._id ? data.complaint : c))
      );
      setInvestigateComplaint(null);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update complaint status.', 'danger');
    } finally {
      setUpdatingComplaint(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar with Admin Navigation */}
      <DashboardSidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="dashboard-main">
        <div className="flex-between" style={{ marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary-navy)' }}>
              Administrator Console
            </h1>
            <p style={{ color: 'var(--secondary-text)', fontSize: '15px' }}>
              System-wide oversight of users, verified technicians, live tracking, and bookings.
            </p>
          </div>

          <button className="btn btn-outline btn-small" onClick={fetchOverview}>
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* Top 4 Stats (Prototype Page 12: Total Users (1,234), Total Workers (235), Total Bookings (542), Total Revenue (₹1,25,430)) */}
        <div className="stats-grid">
          <StatCard
            label="Total Users"
            value={stats?.totalUsers ?? '...'}
            icon={Users}
          />
          <StatCard
            label="Total Workers"
            value={stats?.totalWorkers ?? '...'}
            icon={Briefcase}
            note={`${stats?.pendingApplications || 0} applications pending`}
          />
          <StatCard
            label="Total Bookings"
            value={stats?.totalBookings ?? '...'}
            icon={CalendarDays}
            note={`${stats?.activeBookings || 0} active now`}
          />
          <StatCard
            label="Total Revenue"
            value={`₹${(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}`}
            icon={TrendingUp}
          />
        </div>

        {/* 1. OVERVIEW / DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <section className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                Recent Platform Bookings
              </h3>
              <button className="btn btn-outline btn-small" onClick={() => setActiveTab('bookings')}>
                View All
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Schedule</th>
                    <th>Assigned Worker</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <strong>{b.customerId?.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          {b.customerId?.phone}
                        </div>
                      </td>
                      <td>
                        <strong>{b.serviceId?.name || b.category}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>{b.category}</div>
                      </td>
                      <td>
                        {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>{b.bookingTime}</div>
                      </td>
                      <td>
                        {b.workerId ? (
                          <span style={{ fontWeight: 600, color: 'var(--primary-navy)' }}>
                            {b.workerId.name}
                          </span>
                        ) : (
                          <span style={{ color: '#b45309', fontSize: '12px', fontWeight: 600 }}>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${b.status.toLowerCase().replace(/\s+/g, '')}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <strong>₹{Number(b.totalAmount).toLocaleString('en-IN')}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 2. USERS TAB */}
        {activeTab === 'users' && (
          <section className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>
                Platform Users ({usersList.length})
              </h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search users by name, email, or phone..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setUserSearchQuery(q);
                    api.get(`/admin/users?search=${encodeURIComponent(q)}`).then(({ data }) => setUsersList(data));
                  }}
                  style={{ width: '280px', padding: '8px 12px' }}
                />
              </div>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Details</th>
                    <th>Mobile (Verified)</th>
                    <th>Roles</th>
                    <th>Worker Status</th>
                    <th>Account Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <strong>{u.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>{u.email}</div>
                      </td>
                      <td>+91 {u.phone}</td>
                      <td>
                        {u.roles.map((r) => (
                          <span key={r} className="badge badge-accepted" style={{ marginRight: '4px' }}>
                            {r}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className={`badge badge-${u.workerStatus}`}>
                          {u.workerStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-completed' : 'badge-cancelled'}`}>
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn ${u.isActive ? 'btn-danger' : 'btn-success'} btn-small`}
                          onClick={() => handleToggleUser(u._id)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. WORKER APPLICATIONS TAB */}
        {activeTab === 'applications' && (
          <section className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Worker Applications & Category Expansions
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                  Review initial onboarding requests and requests from existing workers to expand into new trade categories.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid="tab-onboarding-applications"
                  className={`btn ${appSectionTab === 'onboarding' ? 'btn-navy' : 'btn-outline'} btn-small`}
                  onClick={() => setAppSectionTab('onboarding')}
                >
                  Onboarding Applications ({applications.length})
                </button>
                <button
                  type="button"
                  data-testid="tab-additional-applications"
                  className={`btn ${appSectionTab === 'additional' ? 'btn-navy' : 'btn-outline'} btn-small`}
                  onClick={() => {
                    setAppSectionTab('additional');
                    api.get('/admin/worker-applications/additional').then(({ data }) => setAdditionalApplications(data)).catch(() => {});
                  }}
                >
                  Additional Service Applications ({additionalApplications.length})
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => {
                    api.get('/worker-applications').then(({ data }) => setApplications(data));
                    api.get('/admin/worker-applications/additional').then(({ data }) => setAdditionalApplications(data)).catch(() => {});
                  }}
                  title="Refresh Applications"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Sub-tab 1: Onboarding Applications */}
            {appSectionTab === 'onboarding' && (
              <div>
                {applications.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '30px', color: 'var(--secondary-text)' }}>
                    No worker applications found.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Applied Categories</th>
                          <th>Experience</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app) => (
                          <tr key={app._id}>
                            <td>
                              <strong>{app.fullName}</strong>
                              <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                                {app.email} • +91 {app.phone}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                "{app.professionalDescription}"
                              </div>
                            </td>
                            <td>
                              {(app.selectedCategories || []).map((cat) => (
                                <span key={cat} className="badge badge-accepted" style={{ marginRight: '4px', marginBottom: '2px' }}>
                                  {cat}
                                </span>
                              ))}
                            </td>
                            <td>{app.experience} Years</td>
                            <td style={{ fontSize: '13px' }}>{app.serviceLocation}</td>
                            <td>
                              <span className={`badge badge-${app.applicationStatus}`}>
                                {app.applicationStatus}
                              </span>
                            </td>
                            <td>
                              {app.applicationStatus === 'pending' ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn btn-success btn-small"
                                    onClick={() => openApproveModal(app)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn btn-danger btn-small"
                                    onClick={() => handleRejectApplication(app._id)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                                  Reviewed
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Additional Service Applications */}
            {appSectionTab === 'additional' && (
              <div>
                {additionalApplications.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '30px', color: 'var(--secondary-text)' }}>
                    No additional service category applications found.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Worker Details</th>
                          <th>Current Approved Categories</th>
                          <th>Requested Categories</th>
                          <th>Experience & Notes</th>
                          <th>Date Submitted</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {additionalApplications.map((app) => (
                          <tr key={app._id} data-testid={`additional-app-row-${app._id}`}>
                            <td>
                              <strong>{app.fullName}</strong>
                              <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                                {app.email} • +91 {app.phone}
                              </div>
                            </td>
                            <td>
                              {(app.currentCategories || []).length > 0 ? (
                                (app.currentCategories || []).map((cat) => (
                                  <span key={cat} className="badge badge-accepted" style={{ marginRight: '4px', marginBottom: '2px', display: 'inline-block' }}>
                                    {cat}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>None</span>
                              )}
                            </td>
                            <td>
                              {(app.requestedCategories || []).map((cat) => {
                                const isApproved = (app.approvedCategories || []).includes(cat);
                                const isRejected = (app.rejectedCategories || []).includes(cat);
                                let badgeClass = 'badge-pending';
                                if (isApproved) badgeClass = 'badge-completed';
                                else if (isRejected) badgeClass = 'badge-cancelled';
                                return (
                                  <span
                                    key={cat}
                                    className={`badge ${badgeClass}`}
                                    style={{ marginRight: '4px', marginBottom: '2px', display: 'inline-block' }}
                                  >
                                    {cat}
                                  </span>
                                );
                              })}
                            </td>
                            <td>
                              <div style={{ fontSize: '13px' }}><strong>{app.experience} Years</strong></div>
                              {app.professionalDescription && (
                                <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.professionalDescription}>
                                  {app.professionalDescription}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: '13px' }}>
                              {new Date(app.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td>
                              <span className={`badge badge-${app.applicationStatus === 'partially_approved' ? 'accepted' : app.applicationStatus}`}>
                                {app.applicationStatus.replace('_', ' ')}
                              </span>
                            </td>
                            <td>
                              {app.applicationStatus === 'pending' ? (
                                <button
                                  type="button"
                                  data-testid={`review-additional-btn-${app._id}`}
                                  className="btn btn-navy btn-small"
                                  onClick={() => handleOpenReviewAdditionalModal(app)}
                                >
                                  Review & Decide
                                </button>
                              ) : (
                                <div>
                                  <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                                    {app.adminNotes ? `Note: "${app.adminNotes}"` : 'Reviewed'}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 4. APPROVED WORKERS TAB */}
        {activeTab === 'workers' && (
          <section className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '18px' }}>
              Approved Service Professionals ({workersList.length})
            </h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th>Approved Categories</th>
                    <th>Availability</th>
                    <th>Completed Jobs</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {workersList.map((w) => (
                    <tr key={w._id}>
                      <td>
                        <strong>{w.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          +91 {w.phone} • {w.email}
                        </div>
                      </td>
                      <td>
                        {(w.approvedCategories || []).map((c) => (
                          <span key={c} className="badge badge-accepted" style={{ marginRight: '4px' }}>
                            {c}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className={`badge ${w.isAvailable ? 'badge-completed' : 'badge-pending'}`}>
                          {w.isAvailable ? 'Available' : 'Busy'}
                        </span>
                      </td>
                      <td>{w.completedJobs ?? 0} jobs</td>
                      <td>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{w.rating ?? 4.8} ★</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. SERVICES TAB */}
        {activeTab === 'services' && (
          <section className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                Services Catalogue ({servicesList.length})
              </h3>
              <button className="btn btn-navy btn-small" onClick={() => setNewServiceModalOpen(true)}>
                <Plus size={15} /> Add New Service
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Features</th>
                  </tr>
                </thead>
                <tbody>
                  {servicesList.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <strong>{s.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>{s.description}</div>
                      </td>
                      <td>
                        <span className="badge badge-accepted">{s.category}</span>
                      </td>
                      <td>
                        <strong>₹{Number(s.price).toLocaleString('en-IN')}</strong>
                      </td>
                      <td>{s.rating} ★</td>
                      <td style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                        {(s.features || []).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 6. BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <section className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '18px' }}>
              All Platform Bookings ({allBookings.length})
            </h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Service & Category</th>
                    <th>Assigned Worker</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allBookings.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <strong>{b.bookingId}</strong>
                      </td>
                      <td>
                        <strong>{b.customerId?.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          +91 {b.contactNumber || b.customerId?.phone}
                        </div>
                      </td>
                      <td>
                        <strong>{b.serviceId?.name || b.category}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                          Cat: {b.category} • ₹{b.totalAmount}
                        </div>
                      </td>
                      <td>
                        {b.workerId ? (
                          <span style={{ fontWeight: 600, color: 'var(--primary-navy)' }}>
                            {b.workerId.name}
                          </span>
                        ) : (
                          <span style={{ color: '#b45309', fontSize: '12px', fontWeight: 600 }}>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${b.status.toLowerCase().replace(/\s+/g, '')}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-navy btn-small"
                            onClick={() => handleOpenInspectionReport(b)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="View Service Quality & Photo Report"
                          >
                            <FileText size={12} /> Report
                          </button>
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => setAssignModalBooking(b)}
                          >
                            Assign Pro
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 7. LIVE TRACKING TAB (Prototype & Section 6 & 10) */}
        {activeTab === 'tracking' && (
          <section className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Live Worker Fleet Tracking
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                  Real-time geographic locations of all currently active assigned technicians on OpenStreetMap.
                </p>
              </div>
              <button
                className="btn btn-outline btn-small"
                onClick={() => api.get('/tracking/admin/live-workers').then(({ data }) => setLiveWorkers(data))}
              >
                <RefreshCw size={14} /> Refresh Locations
              </button>
            </div>

            <div style={{ height: '520px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <LiveMap allWorkers={liveWorkers} />
            </div>
          </section>
        )}

        {/* 8. REPORTS TAB (Recharts Analytics) */}
        {activeTab === 'reports' && reportsData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '18px' }}>
                Bookings by Category
              </h3>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsData.categoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#071D49" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '18px' }}>
                Monthly Revenue Growth (₹)
              </h3>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportsData.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#FFC928" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Work Distribution Diagnostics Card */}
            {workDiagnostics && (
              <div className="card" style={{ gridColumn: 'span 2', padding: '24px', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '16px' }}>
                  Work Distribution & Dispatch Diagnostics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: 'white', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Approved Workers</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-navy)' }}>{workDiagnostics.totalApprovedWorkers}</div>
                    <div style={{ fontSize: '11px', color: '#16a34a' }}>{workDiagnostics.availableWorkers} available now</div>
                  </div>
                  <div style={{ background: 'white', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Total Work Requests</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-navy)' }}>{workDiagnostics.totalWorkRequests}</div>
                    <div style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>{workDiagnostics.pendingWorkRequests} pending review</div>
                  </div>
                  <div style={{ background: 'white', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Accepted Requests</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{workDiagnostics.acceptedWorkRequests}</div>
                    <div style={{ fontSize: '11px', color: '#dc2626' }}>{workDiagnostics.rejectedWorkRequests} declined</div>
                  </div>
                  <div style={{ background: 'white', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Unmatched Bookings</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: workDiagnostics.bookingsWithoutMatchingWorkersCount > 0 ? '#dc2626' : '#16a34a' }}>
                      {workDiagnostics.bookingsWithoutMatchingWorkersCount}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--secondary-text)' }}>Bookings with 0 matching workers</div>
                  </div>
                </div>

                {/* Categories breakdown */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '8px' }}>
                    Workers by Approved Trade:
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Object.entries(workDiagnostics.categoryBreakdown || {}).map(([cat, count]) => (
                      <span key={cat} className="badge badge-accepted" style={{ fontSize: '12px' }}>
                        {cat}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 9: COMPLAINT MANAGEMENT (Requirement 8) */}
        {activeTab === 'complaints' && (
          <div className="card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Complaint Management & Dispute Resolution
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
                  Review, investigate, and resolve grievances submitted by customers and service professionals.
                </p>
              </div>

              {/* Sub-tabs: All, Customer Complaints, Worker Complaints */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid="tab-all-complaints"
                  className={`btn ${complaintFilter === 'all' ? 'btn-navy' : 'btn-outline'} btn-small`}
                  onClick={() => setComplaintFilter('all')}
                >
                  All Complaints ({complaintsList.length})
                </button>
                <button
                  type="button"
                  data-testid="tab-customer-complaints"
                  className={`btn ${complaintFilter === 'customer' ? 'btn-navy' : 'btn-outline'} btn-small`}
                  onClick={() => setComplaintFilter('customer')}
                >
                  Customer Complaints (
                  {complaintsList.filter((c) => c.complaintType === 'customer').length})
                </button>
                <button
                  type="button"
                  data-testid="tab-worker-complaints"
                  className={`btn ${complaintFilter === 'worker' ? 'btn-navy' : 'btn-outline'} btn-small`}
                  onClick={() => setComplaintFilter('worker')}
                >
                  Worker Complaints (
                  {complaintsList.filter((c) => c.complaintType === 'worker').length})
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => api.get('/admin/complaints').then(({ data }) => setComplaintsList(data))}
                  title="Refresh Complaints"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Filter & Search Controls */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '18px',
                padding: '14px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-text)', display: 'block', marginBottom: '4px' }}>
                  Search by ID / Name / Description
                </label>
                <input
                  type="text"
                  data-testid="admin-complaint-search-input"
                  className="form-input"
                  placeholder="e.g. CMP-WKR or worker name..."
                  value={complaintSearch}
                  onChange={(e) => setComplaintSearch(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-text)', display: 'block', marginBottom: '4px' }}>
                  Filter by Category
                </label>
                <select
                  data-testid="admin-complaint-category-filter"
                  className="form-select"
                  value={complaintCategoryFilter}
                  onChange={(e) => setComplaintCategoryFilter(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                >
                  <option value="all">All Categories</option>
                  <option value="Customer Misconduct">Customer Misconduct</option>
                  <option value="Unsafe Workplace">Unsafe Workplace</option>
                  <option value="Incorrect Service Information">Incorrect Service Information</option>
                  <option value="Payment Dispute">Payment Dispute</option>
                  <option value="Unreasonable Additional Work">Unreasonable Additional Work</option>
                  <option value="Customer Not Available">Customer Not Available</option>
                  <option value="Access or Location Issue">Access or Location Issue</option>
                  <option value="Poor Quality Work">Poor Quality Work</option>
                  <option value="Worker Absent / No-Show">Worker Absent / No-Show</option>
                  <option value="Unprofessional Behavior">Unprofessional Behavior</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-text)', display: 'block', marginBottom: '4px' }}>
                  Filter by Status
                </label>
                <select
                  data-testid="admin-complaint-status-filter"
                  className="form-select"
                  value={complaintStatusFilter}
                  onChange={(e) => setComplaintStatusFilter(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '13px' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Complaints Table with exact 11 columns */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Complaint ID</th>
                    <th>Complaint Type</th>
                    <th>Submitted By</th>
                    <th>Customer Name</th>
                    <th>Worker Name</th>
                    <th>Booking ID</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complaintsList
                    .filter((c) => {
                      if (complaintFilter !== 'all' && c.complaintType !== complaintFilter) return false;
                      if (complaintCategoryFilter !== 'all' && c.category !== complaintCategoryFilter) return false;
                      if (complaintStatusFilter !== 'all' && c.status !== complaintStatusFilter) return false;
                      if (complaintSearch.trim()) {
                        const q = complaintSearch.toLowerCase();
                        const cId = (c.complaintId || '').toLowerCase();
                        const desc = (c.description || '').toLowerCase();
                        const cust = (c.customerId?.name || '').toLowerCase();
                        const wkr = (c.workerId?.name || c.submittedBy?.name || '').toLowerCase();
                        const bId = (c.bookingId?.bookingId || (typeof c.bookingId === 'string' ? c.bookingId : '') || '').toLowerCase();
                        if (!cId.includes(q) && !desc.includes(q) && !cust.includes(q) && !wkr.includes(q) && !bId.includes(q)) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((comp) => (
                      <tr key={comp._id} data-testid={`complaint-row-${comp.complaintId}`}>
                        <td>
                          <strong>{comp.complaintId}</strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              comp.complaintType === 'customer' ? 'badge-completed' : 'badge-accepted'
                            }`}
                            style={{ fontSize: '11px', textTransform: 'capitalize' }}
                          >
                            {comp.complaintType}
                          </span>
                        </td>
                        <td>{comp.submittedBy?.name || 'User'}</td>
                        <td>{comp.customerId?.name || 'N/A'}</td>
                        <td>{comp.workerId?.name || comp.submittedBy?.name || 'Unassigned'}</td>
                        <td>
                          <span className="badge badge-pending">
                            {comp.bookingId?.bookingId || (typeof comp.bookingId === 'string' ? comp.bookingId : 'N/A')}
                          </span>
                        </td>
                        <td>
                          <strong>{comp.category}</strong>
                        </td>
                        <td
                          style={{
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '13px'
                          }}
                          title={comp.description}
                        >
                          {comp.description}
                        </td>
                        <td>
                          {new Date(comp.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td>
                          <span className={`badge badge-${comp.status.toLowerCase().replace(/\s+/g, '')}`}>
                            {comp.status}
                          </span>
                        </td>
                        <td>
                          <button
                            data-testid={`review-complaint-btn-${comp.complaintId}`}
                            className="btn btn-navy btn-small"
                            onClick={() => handleOpenInvestigateModal(comp)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={13} /> Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  {complaintsList.filter((c) => {
                    if (complaintFilter !== 'all' && c.complaintType !== complaintFilter) return false;
                    if (complaintCategoryFilter !== 'all' && c.category !== complaintCategoryFilter) return false;
                    if (complaintStatusFilter !== 'all' && c.status !== complaintStatusFilter) return false;
                    if (complaintSearch.trim()) {
                      const q = complaintSearch.toLowerCase();
                      const cId = (c.complaintId || '').toLowerCase();
                      const desc = (c.description || '').toLowerCase();
                      const cust = (c.customerId?.name || '').toLowerCase();
                      const wkr = (c.workerId?.name || c.submittedBy?.name || '').toLowerCase();
                      const bId = (c.bookingId?.bookingId || (typeof c.bookingId === 'string' ? c.bookingId : '') || '').toLowerCase();
                      if (!cId.includes(q) && !desc.includes(q) && !cust.includes(q) && !wkr.includes(q) && !bId.includes(q)) {
                        return false;
                      }
                    }
                    return true;
                  }).length === 0 && (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '30px', color: 'var(--secondary-text)' }}>
                        No complaints found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Approve Worker Application with Categories Selection */}
      <Modal
        isOpen={Boolean(approveModalApp)}
        onClose={() => setApproveModalApp(null)}
        title={`Approve Worker Application: ${approveModalApp?.fullName || ''}`}
        maxWidth="560px"
      >
        {approveModalApp && (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--secondary-text)', marginBottom: '16px' }}>
              Confirm or adjust the approved categories for this professional:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {(approveModalApp.selectedCategories || []).map((cat) => {
                const isChecked = approveSelectedCats.includes(cat);
                return (
                  <label
                    key={cat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      background: isChecked ? 'var(--accent-yellow-light)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setApproveSelectedCats((prev) =>
                          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                        );
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{cat}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setApproveModalApp(null)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleApproveApplication}>
                Confirm Approval & Upgrade User
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Assign Worker to Booking (Strict Category Filtering) */}
      <Modal
        isOpen={Boolean(assignModalBooking)}
        onClose={() => setAssignModalBooking(null)}
        title={`Assign Technician to Booking: ${assignModalBooking?.bookingId || ''}`}
        maxWidth="560px"
      >
        {assignModalBooking && (
          <div>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              Booking Category: <strong>{assignModalBooking.category}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', marginBottom: '20px' }}>
              {workersList
                .filter((w) => (w.approvedCategories || []).includes(assignModalBooking.category))
                .map((w) => (
                  <div
                    key={w._id}
                    className="flex-between"
                    style={{
                      padding: '12px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div>
                      <strong>{w.name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                        +91 {w.phone} • {w.isAvailable ? 'Available' : 'Busy'}
                      </div>
                    </div>
                    <button
                      className="btn btn-navy btn-small"
                      onClick={() => handleAssignWorker(assignModalBooking._id, w._id)}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              {workersList.filter((w) => (w.approvedCategories || []).includes(assignModalBooking.category)).length === 0 && (
                <p style={{ color: 'var(--danger)', fontSize: '13px' }}>
                  No approved workers found for category "{assignModalBooking.category}".
                </p>
              )}
            </div>

            <button className="btn btn-outline btn-full" onClick={() => setAssignModalBooking(null)}>
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* MODAL 3: Add New Service */}
      <Modal
        isOpen={newServiceModalOpen}
        onClose={() => setNewServiceModalOpen(false)}
        title="Add New Service"
        maxWidth="560px"
      >
        <form onSubmit={handleCreateService}>
          <div className="form-group">
            <label>Service Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Bathroom Leak Repair"
              value={newServiceForm.name}
              onChange={(e) => setNewServiceForm({ ...newServiceForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select
              className="form-select"
              value={newServiceForm.category}
              onChange={(e) => setNewServiceForm({ ...newServiceForm, category: e.target.value })}
            >
              {categoriesList.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Price (₹) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 299"
              value={newServiceForm.price}
              onChange={(e) => setNewServiceForm({ ...newServiceForm, price: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Description *</label>
            <textarea
              rows="3"
              className="form-textarea"
              placeholder="Details of the service..."
              value={newServiceForm.description}
              onChange={(e) => setNewServiceForm({ ...newServiceForm, description: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Features (comma separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Leak check, Pipe seal, Washers included"
              value={newServiceForm.features}
              onChange={(e) => setNewServiceForm({ ...newServiceForm, features: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setNewServiceModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-navy">
              Save Service
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Investigate Complaint & Update Status (Requirement 8) */}
      <Modal
        isOpen={Boolean(investigateComplaint)}
        onClose={() => setInvestigateComplaint(null)}
        title={`Investigate Complaint: ${investigateComplaint?.complaintId || ''}`}
        maxWidth="680px"
      >
        {investigateComplaint && (
          <div>
            {/* Summary Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '14px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                marginBottom: '18px',
                fontSize: '13px'
              }}
            >
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Grievance Type: </span>
                <strong style={{ textTransform: 'capitalize' }}>
                  {investigateComplaint.complaintType} Complaint
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Category: </span>
                <strong>{investigateComplaint.category}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Customer: </span>
                <strong>
                  {investigateComplaint.customerId?.name
                    ? `${investigateComplaint.customerId.name} (${investigateComplaint.customerId.phone || ''})`
                    : 'N/A (Workplace Issue)'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Worker / Submitter: </span>
                <strong>
                  {investigateComplaint.workerId?.name || investigateComplaint.submittedBy?.name || 'Unassigned'} (
                  {investigateComplaint.workerId?.phone || investigateComplaint.submittedBy?.phone || 'N/A'})
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Booking Reference: </span>
                <strong>
                  {investigateComplaint.bookingId?.bookingId || (typeof investigateComplaint.bookingId === 'string' ? investigateComplaint.bookingId : 'None (General Grievance)')}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Date Filed: </span>
                <strong>{new Date(investigateComplaint.createdAt).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                Complaint Description:
              </label>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '4px',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}
              >
                {investigateComplaint.description}
              </div>
            </div>

            {/* Supporting Images */}
            {investigateComplaint.attachments && investigateComplaint.attachments.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Supporting Photo / Attachment:
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  {investigateComplaint.attachments.map((att, i) => (
                    <img
                      key={i}
                      src={att}
                      alt="Complaint attachment"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/images/home-maintenance.jpg';
                      }}
                      style={{
                        width: '120px',
                        height: '90px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Status Update Dropdown */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>Update Complaint Status *</label>
              <select
                data-testid="complaint-status-select"
                className="form-select"
                value={investigateStatus}
                onChange={(e) => setInvestigateStatus(e.target.value)}
              >
                <option value="Submitted">Submitted (Pending Review)</option>
                <option value="Under Review">Under Review (Investigation Active)</option>
                <option value="Resolved">Resolved (Satisfactorily Closed)</option>
                <option value="Rejected">Rejected (Claim Invalid)</option>
              </select>
            </div>

            {/* Admin Resolution Notes */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Administrative Resolution Notes</label>
              <textarea
                data-testid="complaint-admin-notes-input"
                rows="3"
                className="form-textarea"
                placeholder="Document administrative findings, action taken with worker/customer, refunds, or resolution summary..."
                value={investigateNotes}
                onChange={(e) => setInvestigateNotes(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  data-testid="resolve-complaint-btn"
                  className="btn btn-success btn-small"
                  onClick={() => handleUpdateComplaintStatus('Resolved')}
                  disabled={updatingComplaint}
                >
                  <Check size={14} /> Mark as Resolved
                </button>
                <button
                  type="button"
                  data-testid="reject-complaint-btn"
                  className="btn btn-danger btn-small"
                  onClick={() => handleUpdateComplaintStatus('Rejected')}
                  disabled={updatingComplaint}
                >
                  <XCircle size={14} /> Mark as Rejected
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setInvestigateComplaint(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  data-testid="save-complaint-btn"
                  className="btn btn-navy"
                  onClick={() => handleUpdateComplaintStatus()}
                  disabled={updatingComplaint}
                >
                  {updatingComplaint ? 'Saving...' : 'Save Status & Notes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 5: Review Additional Category Application (Feature 2) */}
      <Modal
        isOpen={Boolean(reviewAdditionalModalApp)}
        onClose={() => setReviewAdditionalModalApp(null)}
        title={`Review Additional Categories: ${reviewAdditionalModalApp?.fullName || ''}`}
        maxWidth="620px"
      >
        {reviewAdditionalModalApp && (
          <div>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--secondary-text)' }}>Applicant: </span>
                <strong>{reviewAdditionalModalApp.fullName}</strong> ({reviewAdditionalModalApp.email} • +91 {reviewAdditionalModalApp.phone})
              </div>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--secondary-text)' }}>Experience: </span>
                <strong>{reviewAdditionalModalApp.experience} Years</strong>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--secondary-text)' }}>Currently Approved Categories: </span>
                {(reviewAdditionalModalApp.currentCategories || []).length > 0 ? (
                  (reviewAdditionalModalApp.currentCategories || []).map((cat) => (
                    <span key={cat} className="badge badge-accepted" style={{ marginRight: '4px', fontSize: '11px' }}>
                      {cat}
                    </span>
                  ))
                ) : (
                  <strong>None</strong>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--secondary-text)' }}>Qualifications / Experience Notes: </span>
                <p style={{ margin: '4px 0 0 0', color: 'var(--primary-navy)' }}>
                  {reviewAdditionalModalApp.professionalDescription || 'No additional notes provided.'}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-navy)', marginBottom: '8px' }}>
              Select Requested Categories to Approve:
            </p>
            <p style={{ fontSize: '12px', color: 'var(--secondary-text)', marginBottom: '12px' }}>
              Check each category you wish to approve for this worker. Unchecked categories will be marked as rejected.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '18px' }}>
              {(reviewAdditionalModalApp.requestedCategories || []).map((cat) => {
                const isChecked = reviewApprovedCats.includes(cat);
                return (
                  <label
                    key={cat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      border: `1.5px solid ${isChecked ? 'var(--primary-navy)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: isChecked ? 'rgba(15, 23, 42, 0.04)' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      data-testid={`checkbox-approve-${cat}`}
                      checked={isChecked}
                      onChange={() => {
                        setReviewApprovedCats((prev) =>
                          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                        );
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-navy)' }}>{cat}</span>
                  </label>
                );
              })}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Admin Review Notes / Justification</label>
              <textarea
                data-testid="admin-additional-notes-input"
                rows="3"
                className="form-textarea"
                placeholder="Enter feedback or review notes for the worker (e.g. Approved based on verified certificate)..."
                value={reviewAdminNotes}
                onChange={(e) => setReviewAdminNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                data-testid="admin-reject-app-btn"
                className="btn btn-danger"
                disabled={reviewingAdditional}
                onClick={() => handleReviewAdditional('reject')}
              >
                Reject All
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setReviewAdditionalModalApp(null)}
                  disabled={reviewingAdditional}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="admin-approve-cats-btn"
                  className="btn btn-success"
                  disabled={reviewingAdditional || reviewApprovedCats.length === 0}
                  onClick={() => handleReviewAdditional('approve')}
                >
                  {reviewingAdditional ? 'Saving...' : `Approve Selected (${reviewApprovedCats.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Service Inspection & Photo Report (Part 4) */}
      <Modal
        isOpen={Boolean(inspectionReportBooking)}
        onClose={() => setInspectionReportBooking(null)}
        title={`Service Quality Report: ${inspectionReportBooking?.bookingId || ''}`}
      >
        {inspectionReportBooking && (
          <div style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ backgroundColor: 'var(--primary-navy)', color: '#fff', padding: '16px 20px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-yellow)', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Quality & Verification Report
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0 0', color: '#fff' }}>
                    {inspectionReportBooking.serviceId?.name || inspectionReportBooking.category}
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge badge-${inspectionReportBooking.status.toLowerCase().replace(/\s+/g, '')}`} style={{ fontSize: '12px' }}>
                    {inspectionReportBooking.status}
                  </span>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                    ₹{inspectionReportBooking.totalAmount} • {inspectionReportBooking.paymentStatus}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <strong style={{ color: 'var(--primary-navy)', display: 'block', marginBottom: '4px' }}>Customer Information:</strong>
                <div><strong>Name:</strong> {inspectionReportBooking.customerId?.name || 'N/A'}</div>
                <div><strong>Phone:</strong> {inspectionReportBooking.contactNumber || inspectionReportBooking.customerId?.phone || 'N/A'}</div>
                <div><strong>Address:</strong> {inspectionReportBooking.address}</div>
                {inspectionReportBooking.instructions && (
                  <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#64748b' }}>
                    Note: "{inspectionReportBooking.instructions}"
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <strong style={{ color: 'var(--primary-navy)', display: 'block', marginBottom: '4px' }}>Technician Information:</strong>
                {inspectionReportBooking.workerId ? (
                  <>
                    <div><strong>Name:</strong> {inspectionReportBooking.workerId.name}</div>
                    <div><strong>Phone:</strong> {inspectionReportBooking.workerId.phone}</div>
                    <div><strong>Rating:</strong> ⭐ {inspectionReportBooking.workerId.rating || '5.0'}</div>
                    <div><strong>Categories:</strong> {(inspectionReportBooking.workerId.approvedCategories || []).join(', ')}</div>
                  </>
                ) : (
                  <div style={{ color: '#b45309', fontWeight: 600 }}>No technician assigned.</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} /> Before & After Service Evidence
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', padding: '12px', backgroundColor: '#fafafa' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '8px' }}>
                    1. Before Service (Problem Photos)
                  </span>
                  {inspectionReportBooking.problemPhotos && inspectionReportBooking.problemPhotos.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
                      {inspectionReportBooking.problemPhotos.map((p, idx) => (
                        <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={p.url}
                            alt={`Problem ${idx + 1}`}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                      No problem photographs uploaded during booking.
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', padding: '12px', backgroundColor: '#fafafa' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: '8px' }}>
                    2. After Service (Completed Work Photos)
                  </span>
                  {((inspectionReportBooking.completionPhotos && inspectionReportBooking.completionPhotos.length > 0) ||
                    (inspectionReportBooking.completedPhotos && inspectionReportBooking.completedPhotos.length > 0)) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
                      {(inspectionReportBooking.completionPhotos || inspectionReportBooking.completedPhotos || []).map((p, idx) => (
                        <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={p.url}
                            alt={`Completed ${idx + 1}`}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                      No completed work photographs submitted yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '18px', backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-navy)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Star size={15} fill="#f59e0b" color="#f59e0b" /> Customer Rating & Feedback
              </h4>
              {loadingReportReview ? (
                <div style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Loading customer feedback...</div>
              ) : inspectionReview ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={15} fill={s <= inspectionReview.rating ? '#f59e0b' : '#cbd5e1'} color={s <= inspectionReview.rating ? '#f59e0b' : '#cbd5e1'} />
                    ))}
                    <strong style={{ fontSize: '13px', marginLeft: '6px', color: 'var(--primary-navy)' }}>
                      {inspectionReview.rating} / 5 Stars
                    </strong>
                  </div>
                  {inspectionReview.comment && (
                    <p style={{ fontSize: '13px', color: 'var(--secondary-text)', fontStyle: 'italic', margin: '4px 0 0 0' }}>
                      "{inspectionReview.comment}"
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Customer has not submitted a rating for this booking yet.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} /> Print Report
              </button>
              <button
                type="button"
                className="btn btn-navy btn-small"
                onClick={() => setInspectionReportBooking(null)}
              >
                Close Report
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
