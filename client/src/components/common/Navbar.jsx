import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Wrench,
  User,
  LogOut,
  Menu,
  X,
  LogIn
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isServicesActive = location.pathname.startsWith('/services');
  const isWorkerRoute = location.pathname.startsWith('/worker');
  const isProfileActive = location.pathname.startsWith('/customer') || location.pathname === '/profile';
  const isApprovedWorker = user?.roles?.includes('worker') && user?.workerStatus === 'approved';
  const isAdmin = user?.roles?.includes('admin');

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

        {/* Desktop Navigation Links */}
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

          {/* State-specific Navigation Options */}
          {!user ? (
            /* Logged-out Visitor: Login Button */
            <Link
              to="/login"
              className="btn btn-yellow btn-small"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                padding: '6px 18px',
                color: 'var(--primary-navy)',
                textDecoration: 'none'
              }}
            >
              <LogIn size={15} /> Login
            </Link>
          ) : (
            /* Authenticated User Options */
            <>
              {/* Approved Worker: Dashboard Switcher */}
              {isApprovedWorker && (
                isWorkerRoute ? (
                  <button
                    type="button"
                    className="nav-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: '15px' }}
                    onClick={handleSwitchToCustomer}
                  >
                    Switch to Customer Dashboard
                  </button>
                ) : (
                  <button
                    type="button"
                    className="nav-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: '15px' }}
                    onClick={handleSwitchToWorker}
                  >
                    Switch to Worker Dashboard
                  </button>
                )
              )}

              {/* Admin: Admin Dashboard Link */}
              {isAdmin && (
                <NavLink
                  to="/admin/dashboard"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Admin Dashboard
                </NavLink>
              )}

              {/* Profile Option */}
              <NavLink
                to="/customer/dashboard"
                className={`nav-link ${isProfileActive ? 'active' : ''}`}
              >
                Profile
              </NavLink>

              {/* Logout Option immediately beside Profile */}
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-outline btn-small"
                style={{
                  color: 'var(--white)',
                  borderColor: 'rgba(255,255,255,0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Logout"
              >
                <LogOut size={14} /> Logout
              </button>
            </>
          )}
        </nav>

        {/* Right Navigation Actions */}
        <div className="nav-actions">
          {user && (
            <Link
              to="/customer/dashboard"
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
              title="View Customer Profile"
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
                {user.name ? user.name.split(' ')[0] : 'Profile'}
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
          className="mobile-drawer"
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

          {!user ? (
            /* Logged-out Mobile: Prominent Login Button */
            <Link
              to="/login"
              className="btn btn-yellow btn-small"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 0',
                marginTop: '8px',
                fontWeight: 700
              }}
            >
              <LogIn size={16} /> Login
            </Link>
          ) : (
            /* Logged-in Mobile: Dynamic Options + Profile + Logout */
            <>
              {isApprovedWorker && (
                isWorkerRoute ? (
                  <button
                    type="button"
                    className="nav-link"
                    style={{
                      padding: '8px 0',
                      fontSize: '16px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'rgba(255,255,255,0.85)',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onClick={handleSwitchToCustomer}
                  >
                    Switch to Customer Dashboard
                  </button>
                ) : (
                  <button
                    type="button"
                    className="nav-link"
                    style={{
                      padding: '8px 0',
                      fontSize: '16px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'rgba(255,255,255,0.85)',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onClick={handleSwitchToWorker}
                  >
                    Switch to Worker Dashboard
                  </button>
                )
              )}

              {isAdmin && (
                <NavLink
                  to="/admin/dashboard"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ padding: '8px 0', fontSize: '16px' }}
                >
                  Admin Dashboard
                </NavLink>
              )}

              <NavLink
                to="/customer/dashboard"
                className={`nav-link ${isProfileActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '8px 0', fontSize: '16px' }}
              >
                Profile
              </NavLink>

              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={handleLogout}
                style={{
                  color: 'var(--white)',
                  borderColor: 'rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '8px',
                  padding: '9px 0'
                }}
              >
                <LogOut size={16} /> Logout
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
