import { useState } from 'react';
import { Phone, Mail, MapPin, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

export default function ContactPage() {
  const { user, notify } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      notify('Please fill in all required fields.', 'danger');
      return;
    }

    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone.trim())) {
      notify('Please enter a valid 10-digit mobile number.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/contact', form);
      notify(data.message, 'success');
      setSubmitted(true);
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      notify(err.response?.data?.message || 'Could not send your message.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page-pad">
      <div className="page-heading">
        <span className="eyebrow">WE ARE HERE TO HELP</span>
        <h1>Get in Touch</h1>
        <p>Have questions about home service bookings, pricing, or technician tracking? Reach out to us.</p>
      </div>

      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Left Side: Contact Information (Prototype Page 11) */}
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
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px' }}>
              Let's talk.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: 1.6, marginBottom: '36px' }}>
              Our friendly customer support team is available 7 days a week to ensure your home services run smoothly.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    background: 'rgba(255,201,40,0.15)',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--accent-yellow)'
                  }}
                >
                  <Phone size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                    Phone Support
                  </span>
                  <strong style={{ fontSize: '16px', color: 'var(--white)' }}>
                    +91 98765 43210
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    background: 'rgba(255,201,40,0.15)',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--accent-yellow)'
                  }}
                >
                  <Mail size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                    Email Address
                  </span>
                  <strong style={{ fontSize: '16px', color: 'var(--white)' }}>
                    support@hometech.demo
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    background: 'rgba(255,201,40,0.15)',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--accent-yellow)'
                  }}
                >
                  <MapPin size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                    Headquarters
                  </span>
                  <strong style={{ fontSize: '15px', color: 'var(--white)', lineHeight: 1.4 }}>
                    123, Green Street, Vijayawada, Andhra Pradesh, India - 520001
                  </strong>
                </div>
              </div>

              {/* Customer Support Image */}
              <div style={{ marginTop: '8px' }}>
                <img
                  src="/assets/images/contact-support.jpg"
                  alt="Customer Support"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/images/cleaning.jpg';
                  }}
                  style={{
                    width: '100%',
                    height: '140px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid rgba(255, 255, 255, 0.15)'
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--accent-yellow)',
              borderTop: '1px solid rgba(255,255,255,0.15)',
              paddingTop: '20px',
              marginTop: '40px'
            }}
          >
            <ShieldCheck size={18} />
            <span>Dedicated Resolution Support Guarantee</span>
          </div>
        </div>

        {/* Right Side: Inquiry Form (Prototype Page 11) */}
        <div style={{ padding: '48px 36px' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '8px' }}>
            Send Us a Message
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--secondary-text)', marginBottom: '28px' }}>
            Fill in the details below and we will respond within 2 hours.
          </p>

          {submitted && (
            <div
              style={{
                background: 'var(--success-bg)',
                color: 'var(--success)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={20} />
              <span>Thank you! Your message has been sent successfully.</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Your Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your email address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number (10 Digits)</label>
              <input
                type="text"
                maxLength={10}
                inputMode="numeric"
                className="form-input"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
              />
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea
                rows="4"
                className="form-textarea"
                placeholder="How can we assist you with HomeTech services?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-navy btn-full"
              style={{ padding: '12px', fontSize: '15px', marginTop: '10px' }}
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
