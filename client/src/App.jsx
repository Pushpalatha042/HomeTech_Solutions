import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import Toast from './components/common/Toast';
import ScrollToTop from './components/common/ScrollToTop';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useAuth } from './context/AuthContext';

// Pages
import HomePage from './pages/Home/HomePage';
import ServicesPage from './pages/Services/ServicesPage';
import ServiceDetailsPage from './pages/ServiceDetails/ServiceDetailsPage';
import AuthPage from './pages/Auth/AuthPage';
import CustomerDashboard from './pages/CustomerDashboard/CustomerDashboard';
import BookingPage from './pages/Booking/BookingPage';
import TrackingPage from './pages/Tracking/TrackingPage';
import WorkerDashboard from './pages/WorkerDashboard/WorkerDashboard';
import BookingHistoryPage from './pages/BookingHistory/BookingHistoryPage';
import PaymentsPage from './pages/Payments/PaymentsPage';
import ContactPage from './pages/Contact/ContactPage';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';

// Route Protection Guards
function RequireAuth({ children, role }) {
  const { user, loadingUser } = useAuth();
  const location = useLocation();

  if (loadingUser) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role === 'admin' && !user.roles?.includes('admin')) {
    return <Navigate to="/" replace />;
  }

  if (role === 'worker') {
    if (!user.roles?.includes('worker') || user.workerStatus !== 'approved') {
      return <Navigate to="/customer/dashboard" state={{ deniedWorkerAccess: true }} replace />;
    }
  }

  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />

      <ErrorBoundary>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:id" element={<ServiceDetailsPage />} />
          <Route path="/login" element={<AuthPage defaultTab="login" />} />
          <Route path="/register" element={<AuthPage defaultTab="register" />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Customer Experience Pages */}
          <Route
            path="/customer/dashboard"
            element={
              <RequireAuth role="customer">
                <CustomerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/booking/:serviceId"
            element={
              <RequireAuth role="customer">
                <BookingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/book"
            element={
              <RequireAuth role="customer">
                <BookingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tracking/:bookingId"
            element={
              <RequireAuth>
                <TrackingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customer/bookings"
            element={
              <RequireAuth role="customer">
                <BookingHistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customer/payments"
            element={
              <RequireAuth role="customer">
                <PaymentsPage />
              </RequireAuth>
            }
          />

          {/* Worker Dashboard (Page 8 - Only for approved workers) */}
          <Route
            path="/worker/dashboard"
            element={
              <RequireAuth role="worker">
                <WorkerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/worker/history"
            element={
              <RequireAuth role="worker">
                <WorkerDashboard initialTab="history" />
              </RequireAuth>
            }
          />
          <Route
            path="/worker/service-history"
            element={
              <RequireAuth role="worker">
                <WorkerDashboard initialTab="history" />
              </RequireAuth>
            }
          />

          {/* Admin Dashboard (Page 12 - Only for admin) */}
          <Route
            path="/admin/dashboard"
            element={
              <RequireAuth role="admin">
                <AdminDashboard />
              </RequireAuth>
            }
          />

          {/* Backward Compatibility Redirects */}
          <Route path="/profile" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/bookings" element={<Navigate to="/customer/bookings" replace />} />
          <Route path="/my-bookings" element={<Navigate to="/customer/bookings" replace />} />
          <Route path="/history" element={<Navigate to="/customer/bookings" replace />} />
          <Route path="/payments" element={<Navigate to="/customer/payments" replace />} />
          <Route path="/worker" element={<Navigate to="/worker/dashboard" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />

          {/* 404 Fallback */}
          <Route
            path="*"
            element={
              <div className="container page-pad" style={{ textAlign: 'center', padding: '100px 0' }}>
                <h2>Page Not Found</h2>
                <p style={{ marginTop: '10px', color: 'var(--secondary-text)' }}>
                  The page you are looking for does not exist.
                </p>
                <a href="/" className="btn btn-navy" style={{ marginTop: '20px', display: 'inline-block' }}>
                  Return to Home
                </a>
              </div>
            }
          />
        </Routes>
      </ErrorBoundary>

      <Footer />
      <Toast />
    </div>
  );
}
