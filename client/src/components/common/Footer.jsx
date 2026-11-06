import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, MapPin, Phone, Mail, ShieldCheck, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import WorkerApplicationModal from './WorkerApplicationModal';

export default function Footer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);

  const isWorkerApproved = user?.roles?.includes('worker') && user?.workerStatus === 'approved';

  const handleJoinAsWorker = () => {
    if (!user) {
      navigate('/login', {
        state: {
          from: '/customer/dashboard',
          message: 'Please log in to submit your worker application.'
        }
      });
    } else {
      setIsWorkerModalOpen(true);
    }
  };

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  backgroundColor: 'var(--accent-yellow)',
                  color: 'var(--primary-navy)',
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Wrench size={20} />
              </div>
              <h3 style={{ margin: 0 }}>HomeTech Solutions</h3>
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '18px' }}>
              Your trusted partner for all home service needs. From plumbing and electrical work to deep
              cleaning and appliance repairs, we connect you with vetted, skilled professionals.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--accent-yellow)' }}>
              <ShieldCheck size={18} />
              <span>100% Verified Professionals & Safe Services</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/services">All Services</Link></li>
              <li><Link to="/contact">Contact Support</Link></li>

              {/* Join as a Worker: shown for logged-out visitors and customers; hidden for approved workers */}
              {!isWorkerApproved && (
                <li>
                  <button
                    type="button"
                    onClick={handleJoinAsWorker}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'rgba(255,255,255,0.75)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-yellow)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                  >
                    <Briefcase size={14} /> Join as a Worker
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Popular Categories */}
          <div className="footer-col">
            <h4>Services</h4>
            <ul className="footer-links">
              <li><Link to="/services?category=Plumbing">Plumbing</Link></li>
              <li><Link to="/services?category=Electrical">Electrical</Link></li>
              <li><Link to="/services?category=Cleaning">Home Cleaning</Link></li>
              <li><Link to="/services?category=Carpentry">Carpentry</Link></li>
              <li><Link to="/services?category=Painting">Painting</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="footer-col">
            <h4>Contact Info</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <MapPin size={18} style={{ color: 'var(--accent-yellow)', flexShrink: 0 }} />
                <span>123, Green Street, Vijayawada, Andhra Pradesh, India</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Phone size={18} style={{ color: 'var(--accent-yellow)', flexShrink: 0 }} />
                <span>+91 98765 43210</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Mail size={18} style={{ color: 'var(--accent-yellow)', flexShrink: 0 }} />
                <span>support@hometech.demo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} HomeTech Solutions. All rights reserved.</p>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            Developed with MERN Stack • Local MongoDB Persistence
          </p>
        </div>
      </div>

      {/* Worker Application Modal for Join as a Worker */}
      <WorkerApplicationModal
        isOpen={isWorkerModalOpen}
        onClose={() => setIsWorkerModalOpen(false)}
      />
    </footer>
  );
}
