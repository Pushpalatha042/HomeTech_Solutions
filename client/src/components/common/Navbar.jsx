import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Wrench,
  User,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import WorkerApplicationModal from './WorkerApplicationModal';

export default function Navbar() {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);

  const isServicesActive = location.pathname.startsWith('/services');
  const isWorkerRoute = location.pathname.startsWith('/worker');
  const isCustomerRoute = location.pathname.startsWith('/customer');

  const handleSwitchToCustomer = async () => {
    setMobileMenuOpen(false);
    try {
      await switchRole('customer');
    } catch (e) {
      // ignore
    }
    navigate('/customer/dashboard');
  };

  const handleSwitchToWorker = async () => {
    setMobileMenuOpen(false);
    try {
      await switchRole('worker');
    } catch (e) {
      // ignore
    }
    navigate('/worker/dashboard');
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/');
  };

  // Determine Link 4 details based on the 7 Cases
  const renderLink4 = (isMobile = false) => {
    const style = isMobile
      ? { padding: '8px 0', fontSize: '16px', background: 'none', border: 'none', textAlign: 'left', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }
      : { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: '15px' };

    // Case 7: Logged-out visitor
    if (!user) {
      return (
        <NavLink
          to="/login"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={() => isMobile && setMobileMenuOpen(false)}
          style={isMobile ? { padding: '8px 0', fontSize: '16px' } : undefined}
        >
          Login
        </NavLink>
      );
    }

    // Case 6: Admin
    if (user.roles?.includes('admin')) {
      return (
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={() => isMobile && setMobileMenuOpen(false)}
          style={isMobile ? { padding: '8px 0', fontSize: '16px' } : undefined}
        >
          Admin Dashboard
        </NavLink>
      );
    }

    // Case 2 & 3: Approved Worker
    const isApprovedWorker = user.roles?.includes('worker') && user.workerStatus === 'approved';
    if (isApprovedWorker) {
      if (isWorkerRoute) {
        // Case 3: On Worker Dashboard -> Switch to Customer Dashboard
        return (
          <button
            type="button"
            className="nav-link"
            style={style}
            onClick={handleSwitchToCustomer}
          >
            Switch to Customer Dashboard
          </button>
        );
      } else {
        // Case 2: On Customer Dashboard or other page -> Switch to Worker Dashboard
        return (
          <button
            type="button"
            className="nav-link"
            style={style}
            onClick={handleSwitchToWorker}
          >
            Switch to Worker Dashboard
          </button>
        );
      }
    }

    // Case 4: Pending Worker
    if (user.workerStatus === 'pending') {
      return (
        <NavLink
          to="/customer/dashboard"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={() => isMobile && setMobileMenuOpen(false)}
          style={isMobile ? { padding: '8px 0', fontSize: '16px' } : undefined}
        >
          Application Status
        </NavLink>
      );
    }

    // Case 1 (Normal Customer) & Case 5 (Rejected Worker)
    return (
      <button
        type="button"
        className="nav-link"
        style={style}
        onClick={() => {
          if (isMobile) setMobileMenuOpen(false);
          setIsWorkerModalOpen(true);
        }}
      >
        Join as a Worker
      </button>
    );
  };

  // Determine Link 5 details based on whether user is logged in
  const renderLink5 = (isMobile = false) => {
    const style = isMobile
      ? { padding: '8px 0', fontSize: '16px', background: 'none', border: 'none', textAlign: 'left', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit' }
      : { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: '15px' };

    if (!user) {
      // Case 7: Register
      return (
        <NavLink
          to="/register"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={() => isMobile && setMobileMenuOpen(false)}
          style={isMobile ? { padding: '8px 0', fontSize: '16px' } : undefined}
        >
          Register
        </NavLink>
      );
    }

    // Cases 1-6: Logout
    return (
      <button
        type="button"
        className="nav-link"
        style={style}
        onClick={handleLogout}
      >
        Logout
      </button>
    );
  };

  return (
    <header className="site-header">
      <div className="container navbar">
        {/* Brand Logo */}
        <Link to="/" className="brand-logo" onClick={() => setMobileMenuOpen(false)}>
          <div className="brand-icon">
            <Wrench size={22} />
          </div>
          <span>HomeTech Solutions</span>
        </Link>

        {/* Desktop Navigation Links: EXACTLY 5 ITEMS */}
        <nav className="nav-links">
          {/* 1. Home */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Home
          </NavLink>

          {/* 2. Services */}
          <NavLink
            to="/services"
            className={`nav-link ${isServicesActive ? 'active' : ''}`}
          >
            Services
          </NavLink>

          {/* 3. Contact Us */}
          <NavLink
            to="/contact"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Contact Us
          </NavLink>

          {/* 4. Dynamic Link (Case 1-7) */}
          {renderLink4(false)}

          {/* 5. Dynamic Link (Logout or Register) */}
          {renderLink5(false)}
        </nav>

        {/* Right Navigation Actions */}
        <div className="nav-actions">
          {user && (
            <Link
              to={isWorkerRoute ? '/worker/dashboard' : '/customer/dashboard'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.1)',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                color: 'var(--white)',
                textDecoration: 'none',
                transition: 'background 0.2s ease'
              }}
              title="Dashboard Profile"
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--accent-yellow)',
                  color: 'var(--primary-navy)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px'
                }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : <User size={14} />}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {user.name ? user.name.split(' ')[0] : 'User'}
              </span>
            </Link>
          )}

          {/* Mobile menu hamburger toggle */}
          <button
            className="mobile-toggle"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--white)',
              cursor: 'pointer',
              padding: '6px'
            }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: 'var(--primary-navy)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
            style={{ padding: '8px 0', fontSize: '16px' }}
          >
            Home
          </NavLink>
          <NavLink
            to="/services"
            className={`nav-link ${isServicesActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
            style={{ padding: '8px 0', fontSize: '16px' }}
          >
            Services
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
            style={{ padding: '8px 0', fontSize: '16px' }}
          >
            Contact Us
          </NavLink>

          {renderLink4(true)}
          {renderLink5(true)}
        </div>
      )}

      {/* Worker Application Modal for Join as a Worker */}
      <WorkerApplicationModal
        isOpen={isWorkerModalOpen}
        onClose={() => setIsWorkerModalOpen(false)}
      />
    </header>
  );
}
