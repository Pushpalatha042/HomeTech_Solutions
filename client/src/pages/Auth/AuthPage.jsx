import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Smartphone,
  Mail,
  Lock,
  User,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

export default function AuthPage({ defaultTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { login, notify } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  // Login State
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginShowPass, setLoginShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register State
  const [regForm, setRegForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    otp: ''
  });
  const [regShowPass, setRegShowPass] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [regLoading, setRegLoading] = useState(false);

  // Dynamic Password Validation Checks
  const pass = regForm.password;
  const passwordChecks = useMemo(
    () => ({
      length: pass.length >= 8,
      upper: /[A-Z]/.test(pass),
      lower: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)
    }),
    [pass]
  );
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Phone Validation
  const isPhoneValid = /^[6-9]\d{9}$/.test(regForm.phone.trim());

  // Handle Login Submit
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const { data } = await api.post('/auth/login', loginForm);
      login(data);
      if (data.user.roles.includes('admin')) {
        navigate('/admin/dashboard');
      } else if (data.user.roles.includes('worker') && data.user.activeRole === 'worker') {
        navigate('/worker/dashboard');
      } else {
        navigate(from === '/login' || from === '/register' ? '/customer/dashboard' : from);
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Invalid email or password.', 'danger');
    } finally {
      setLoginLoading(false);
    }
  };

  // Quick Demo Account Auto-Fill
  const fillDemoAccount = (role) => {
    if (role === 'admin') {
      setLoginForm({ email: 'admin@hometech.demo', password: 'HomeTech@123' });
    } else if (role === 'worker') {
      setLoginForm({ email: 'worker@hometech.demo', password: 'HomeTech@123' });
    } else {
      setLoginForm({ email: 'customer@hometech.demo', password: 'HomeTech@123' });
    }
  };

  // Send OTP
  const handleSendOTP = async () => {
    if (!isPhoneValid) {
      notify('Please enter a valid 10-digit Indian mobile number starting with 6-9.', 'danger');
      return;
    }
    setOtpLoading(true);
    try {
      const { data } = await api.post('/auth/send-otp', {
        phone: regForm.phone.trim(),
        purpose: 'registration'
      });
      setOtpSent(true);
      if (data.devOtp) setDevOtpHint(data.devOtp);
      notify(data.message, 'success');

      // Start 45s resend cooldown
      setCooldown(45);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to send OTP.', 'danger');
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!regForm.otp || regForm.otp.length !== 6) {
      notify('Please enter the 6-digit OTP received on your mobile.', 'danger');
      return;
    }
    try {
      const { data } = await api.post('/auth/verify-otp', {
        phone: regForm.phone.trim(),
        otp: regForm.otp.trim()
      });
      setOtpVerified(true);
      notify(data.message, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Incorrect OTP.', 'danger');
    }
  };

  // Handle Register Submit
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!isPhoneValid) {
      notify('Please enter a valid 10-digit mobile number.', 'danger');
      return;
    }
    if (!isPasswordValid) {
      notify('Please satisfy all password complexity requirements.', 'danger');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      notify('Confirm password does not match.', 'danger');
      return;
    }
    if (!otpVerified) {
      notify('Mobile OTP verification is mandatory before registration.', 'danger');
      return;
    }

    setRegLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: regForm.name.trim(),
        phone: regForm.phone.trim(),
        email: regForm.email.trim(),
        password: regForm.password,
        confirmPassword: regForm.confirmPassword,
        otp: regForm.otp.trim()
      });
      login(data);
      navigate('/customer/dashboard');
    } catch (err) {
      notify(err.response?.data?.message || 'Registration failed.', 'danger');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="container page-pad" style={{ maxWidth: '980px' }}>
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          overflow: 'hidden',
          padding: 0,
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Left Side: Prototype Graphic Illustration & Value Prop */}
        <div
          style={{
            backgroundColor: 'var(--primary-navy)',
            color: 'var(--white)',
            padding: '48px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(255,201,40,0.15)',
                color: 'var(--accent-yellow)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '12px',
                fontWeight: 700,
                marginBottom: '16px'
              }}
            >
              HOMETECH SOLUTIONS
            </span>
            <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '14px', lineHeight: 1.2 }}>
              Welcome Back!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: 1.6 }}>
              Login to book trusted technicians, track service professionals live on maps, and manage
              all your home maintenance in one place.
            </p>
          </div>

          <div style={{ margin: '30px 0' }}>
            <img
              src="/assets/prototype/image1.jpeg"
              alt="HomeTech Professional"
              style={{
                width: '100%',
                maxHeight: '220px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-md)',
                border: '2px solid rgba(255,255,255,0.15)'
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <ShieldCheck size={18} color="var(--accent-yellow)" />
              <span>Verified Home Service Professionals Network</span>
            </div>
          </div>
        </div>

        {/* Right Side: Tabbed Form */}
        <div style={{ padding: '40px 36px' }}>
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '2px solid var(--border-light)',
              marginBottom: '28px'
            }}
          >
            <button
              onClick={() => setActiveTab('login')}
              style={{
                flex: 1,
                padding: '12px',
                background: 'none',
                border: 'none',
                borderBottom: `3px solid ${activeTab === 'login' ? 'var(--primary-navy)' : 'transparent'}`,
                fontWeight: 700,
                fontSize: '16px',
                color: activeTab === 'login' ? 'var(--primary-navy)' : 'var(--secondary-text)',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab('register')}
              style={{
                flex: 1,
                padding: '12px',
                background: 'none',
                border: 'none',
                borderBottom: `3px solid ${activeTab === 'register' ? 'var(--primary-navy)' : 'transparent'}`,
                fontWeight: 700,
                fontSize: '16px',
                color: activeTab === 'register' ? 'var(--primary-navy)' : 'var(--secondary-text)',
                cursor: 'pointer'
              }}
            >
              Register
            </button>
          </div>

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Enter your email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="flex-between" style={{ marginBottom: '4px' }}>
                  <label>Password</label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      notify('Please contact admin or use OTP reset workflow.', 'info');
                    }}
                    style={{ fontSize: '13px', color: 'var(--secondary-navy)', fontWeight: 600 }}
                  >
                    Forgot Password?
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={loginShowPass ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setLoginShowPass(!loginShowPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--secondary-text)',
                      cursor: 'pointer'
                    }}
                  >
                    {loginShowPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-navy btn-full"
                style={{ padding: '12px', fontSize: '15px', marginTop: '10px' }}
                disabled={loginLoading}
              >
                {loginLoading ? 'Logging in...' : 'Login'}
              </button>

              {/* Demo 1-Click Credentials Helper */}
              <div
                style={{
                  marginTop: '28px',
                  background: 'var(--bg-color)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary-text)', marginBottom: '8px' }}>
                  QUICK 1-CLICK DEMO LOGIN (PASSWORD: HomeTech@123)
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => fillDemoAccount('customer')}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => fillDemoAccount('worker')}
                  >
                    Worker (Plumber)
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => fillDemoAccount('admin')}
                  >
                    Administrator
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Chandra"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mobile Number (10 Digits) *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--secondary-text)',
                        fontSize: '14px',
                        fontWeight: 600
                      }}
                    >
                      +91
                    </span>
                    <input
                      type="text"
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="form-input"
                      placeholder="9876543210"
                      value={regForm.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setRegForm({ ...regForm, phone: val });
                      }}
                      style={{ paddingLeft: '48px' }}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-yellow btn-small"
                    onClick={handleSendOTP}
                    disabled={otpLoading || cooldown > 0 || !isPhoneValid || otpVerified}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {otpLoading
                      ? 'Sending...'
                      : cooldown > 0
                      ? `${cooldown}s`
                      : otpSent
                      ? 'Resend OTP'
                      : 'Send OTP'}
                  </button>
                </div>
                {devOtpHint && (
                  <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600, marginTop: '4px' }}>
                    [Dev OTP]: {devOtpHint}
                  </span>
                )}
              </div>

              {/* OTP Verification Box */}
              {otpSent && !otpVerified && (
                <div
                  style={{
                    background: 'var(--accent-yellow-light)',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    border: '1px solid var(--accent-yellow)'
                  }}
                >
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-navy)' }}>
                    Enter 6-Digit OTP *
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      className="form-input"
                      placeholder="e.g. 123456"
                      value={regForm.otp}
                      onChange={(e) =>
                        setRegForm({ ...regForm, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })
                      }
                      style={{ letterSpacing: '4px', fontWeight: 700, textAlign: 'center' }}
                    />
                    <button type="button" className="btn btn-navy btn-small" onClick={handleVerifyOTP}>
                      Verify
                    </button>
                  </div>
                </div>
              )}

              {otpVerified && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--success)',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '14px'
                  }}
                >
                  <CheckCircle2 size={16} /> Mobile Number Verified (+91 {regForm.phone})
                </div>
              )}

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="your.email@example.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={regShowPass ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Create a strong password"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setRegShowPass(!regShowPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--secondary-text)',
                      cursor: 'pointer'
                    }}
                  >
                    {regShowPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Strong Password Live Checklist */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                    marginTop: '8px',
                    fontSize: '12px'
                  }}
                >
                  <span style={{ color: passwordChecks.length ? 'var(--success)' : 'var(--secondary-text)' }}>
                    {passwordChecks.length ? '✓' : '○'} Min 8 characters
                  </span>
                  <span style={{ color: passwordChecks.upper ? 'var(--success)' : 'var(--secondary-text)' }}>
                    {passwordChecks.upper ? '✓' : '○'} Uppercase letter (A-Z)
                  </span>
                  <span style={{ color: passwordChecks.lower ? 'var(--success)' : 'var(--secondary-text)' }}>
                    {passwordChecks.lower ? '✓' : '○'} Lowercase letter (a-z)
                  </span>
                  <span style={{ color: passwordChecks.number ? 'var(--success)' : 'var(--secondary-text)' }}>
                    {passwordChecks.number ? '✓' : '○'} Number (0-9)
                  </span>
                  <span style={{ color: passwordChecks.special ? 'var(--success)' : 'var(--secondary-text)', gridColumn: 'span 2' }}>
                    {passwordChecks.special ? '✓' : '○'} Special character (@, #, $, %, etc.)
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm Password *</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repeat your password"
                  value={regForm.confirmPassword}
                  onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                  required
                />
                {regForm.confirmPassword && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: regForm.password === regForm.confirmPassword ? 'var(--success)' : 'var(--danger)',
                      marginTop: '4px'
                    }}
                  >
                    {regForm.password === regForm.confirmPassword
                      ? '✓ Passwords match'
                      : '✗ Passwords do not match'}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-navy btn-full"
                style={{ padding: '12px', fontSize: '15px', marginTop: '14px' }}
                disabled={regLoading || !otpVerified || !isPasswordValid}
              >
                {regLoading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
