import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  AlertCircle,
  History
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DashboardSidebar({ activeTab, onSelectTab, onOpenWorkerModal }) {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
              onClick={() => {
                if (location.pathname === '/customer/dashboard') {
                  if (onSelectTab) onSelectTab('dashboard');
                } else {
                  navigate('/customer/dashboard');
                }
              }}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'ongoing' ? 'active' : ''}`}
              onClick={() => {
                if (location.pathname === '/customer/dashboard') {
                  if (onSelectTab) onSelectTab('ongoing');
                } else {
                  navigate('/customer/dashboard?tab=ongoing');
                }
              }}
            >
              <Clock size={18} />
              <span>Ongoing Jobs</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => {
                if (location.pathname === '/customer/bookings') {
                  if (onSelectTab) onSelectTab('bookings');
                } else {
                  navigate('/customer/bookings');
                }
              }}
            >
              <CalendarDays size={18} />
              <span>My Bookings</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => {
                if (location.pathname === '/customer/payments') {
                  if (onSelectTab) onSelectTab('payments');
                } else {
                  navigate('/customer/payments');
                }
              }}
            >
              <CreditCard size={18} />
              <span>Payments</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => {
                if (location.pathname === '/customer/dashboard') {
                  if (onSelectTab) onSelectTab('profile');
                } else {
                  navigate('/customer/dashboard?tab=profile');
                }
              }}
            >
              <User size={18} />
              <span>Profile</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'addresses' ? 'active' : ''}`}
              onClick={() => {
                if (location.pathname === '/customer/dashboard') {
                  if (onSelectTab) onSelectTab('addresses');
                } else {
                  navigate('/customer/dashboard?tab=addresses');
                }
              }}
            >
              <MapPin size={18} />
              <span>Addresses</span>
            </button>

            {user?.workerStatus === 'pending' && (
              <div
                className="sidebar-item"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  color: '#92400e',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'default'
                }}
              >
                <Clock size={16} color="#b45309" />
                <span>Worker App: Pending</span>
              </div>
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

        {/* Worker Navigation Menu */}
        {role === 'worker' && (
          <>
            <button
              className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                if (onSelectTab) onSelectTab('dashboard');
                navigate('/worker/dashboard');
              }}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => {
                if (onSelectTab) onSelectTab('history');
                navigate('/worker/dashboard?tab=history');
              }}
            >
              <History size={18} />
              <span>Service History</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'complaints' ? 'active' : ''}`}
              onClick={() => {
                if (onSelectTab) onSelectTab('complaints');
                navigate('/worker/dashboard?tab=complaints');
              }}
            >
              <AlertCircle size={18} />
              <span>My Complaints</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'applications' ? 'active' : ''}`}
              onClick={() => {
                if (onSelectTab) onSelectTab('applications');
                navigate('/worker/dashboard?tab=applications');
              }}
            >
              <Layers size={18} />
              <span>My Service Applications</span>
            </button>
          </>
        )}

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
