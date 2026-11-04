import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  User,
  MapPin,
  HelpCircle,
  LogOut,
  Briefcase,
  RefreshCw,
  Users,
  Wrench,
  Layers,
  MapPinned,
  BarChart3,
  Settings,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DashboardSidebar({ activeTab, onSelectTab, onOpenWorkerModal }) {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();

  const handleRoleSwitch = async (targetRole) => {
    const success = await switchRole(targetRole);
    if (success) {
      if (targetRole === 'customer') navigate('/customer/dashboard');
      else if (targetRole === 'worker') navigate('/worker/dashboard');
      else if (targetRole === 'admin') navigate('/admin/dashboard');
    }
  };

  const isWorkerApproved = user?.roles?.includes('worker') && user?.workerStatus === 'approved';
  const role = user?.activeRole || 'customer';

  return (
    <aside className="dashboard-sidebar">
      {/* Sidebar Header with User Info */}
      <div className="sidebar-header">
        <div className="sidebar-user-card">
          <div className="sidebar-avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <h4
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--primary-navy)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
            >
              {user?.name || 'User'}
            </h4>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--secondary-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    role === 'admin'
                      ? '#ef4444'
                      : role === 'worker'
                      ? 'var(--accent-yellow)'
                      : 'var(--success)'
                }}
              />
              {role.toUpperCase()} VIEW
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Items based on active role */}
      <nav className="sidebar-nav">
        {role === 'customer' && (
          <>
            <button
              className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab ? onSelectTab('dashboard') : navigate('/customer/dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => onSelectTab ? onSelectTab('bookings') : navigate('/customer/bookings')}
            >
              <CalendarDays size={18} />
              <span>My Bookings</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => onSelectTab ? onSelectTab('payments') : navigate('/customer/payments')}
            >
              <CreditCard size={18} />
              <span>Payments</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('profile')}
            >
              <User size={18} />
              <span>Profile</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'addresses' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('addresses')}
            >
              <MapPin size={18} />
              <span>Addresses</span>
            </button>

            {/* Worker Application status or button */}
            {!isWorkerApproved && (
              <button
                className="sidebar-item"
                style={{
                  backgroundColor:
                    user?.workerStatus === 'pending'
                      ? 'var(--warning-bg)'
                      : 'var(--accent-yellow-light)',
                  color: 'var(--primary-navy)',
                  fontWeight: 700
                }}
                onClick={onOpenWorkerModal}
              >
                {user?.workerStatus === 'pending' ? (
                  <>
                    <Clock size={18} color="#b45309" />
                    <span>Worker App: Pending</span>
                  </>
                ) : user?.workerStatus === 'rejected' ? (
                  <>
                    <Briefcase size={18} />
                    <span>Re-apply as Worker</span>
                  </>
                ) : (
                  <>
                    <Briefcase size={18} />
                    <span>Join as Worker</span>
                  </>
                )}
              </button>
            )}

            <button
              className={`sidebar-item ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => navigate('/contact')}
            >
              <HelpCircle size={18} />
              <span>Help & Support</span>
            </button>
          </>
        )}

        {/* Requirement 2: Worker sidebar has no menu items (Dashboard, Requests, Jobs, Earnings, Availability, Tracking, Profile removed) */}
        {role === 'worker' && null}

        {role === 'admin' && (
          <>
            <button
              className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('users')}
            >
              <Users size={18} />
              <span>Users</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'applications' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('applications')}
            >
              <Briefcase size={18} />
              <span>Worker Applications</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'workers' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('workers')}
            >
              <CheckCircle2 size={18} />
              <span>Workers</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('services')}
            >
              <Wrench size={18} />
              <span>Services</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'categories' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('categories')}
            >
              <Layers size={18} />
              <span>Categories</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('bookings')}
            >
              <CalendarDays size={18} />
              <span>Bookings</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('payments')}
            >
              <CreditCard size={18} />
              <span>Payments</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'tracking' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('tracking')}
            >
              <MapPinned size={18} />
              <span>Live Tracking</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('reports')}
            >
              <BarChart3 size={18} />
              <span>Reports</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'complaints' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('complaints')}
            >
              <AlertCircle size={18} />
              <span>Complaints</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('settings')}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </>
        )}
      </nav>

      {/* Footer Switcher & Logout (Requirement 2: Left sidebar for workers contains ONLY Logout at bottom) */}
      <div className="sidebar-footer">
        {/* Switch Dashboard Button if eligible and not worker view */}
        {isWorkerApproved && role !== 'worker' && (
          <button
            className="sidebar-item"
            style={{
              backgroundColor: 'var(--accent-yellow-light)',
              color: 'var(--primary-navy)',
              marginBottom: '8px'
            }}
            onClick={() => handleRoleSwitch(role === 'worker' ? 'customer' : 'worker')}
          >
            <RefreshCw size={16} />
            <span>Switch to {role === 'worker' ? 'Customer' : 'Worker'}</span>
          </button>
        )}

        <button
          className="sidebar-item"
          style={{ color: 'var(--danger)' }}
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
