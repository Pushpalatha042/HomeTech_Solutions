import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star,
  CheckCircle2,
  ShieldCheck,
  Clock,
  ArrowRight,
  ChevronRight,
  Calendar,
  CreditCard,
  UserCheck
} from 'lucide-react';
import api from '../../api';
import { getServiceImage, homeMaintenanceImg } from '../../assets/images';

export default function ServiceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/services/${id}`)
      .then(({ data }) => setService(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container page-pad" style={{ textAlign: 'center', padding: '100px 0' }}>
        <p>Loading service details...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="container page-pad" style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2>Service Not Found</h2>
        <p style={{ marginTop: '10px', color: 'var(--secondary-text)' }}>
          The service you are looking for does not exist or has been removed.
        </p>
        <Link to="/services" className="btn btn-navy" style={{ marginTop: '20px' }}>
          Back to All Services
        </Link>
      </div>
    );
  }

  return (
    <div className="container page-pad">
      {/* Breadcrumbs */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: 'var(--secondary-text)',
          marginBottom: '28px'
        }}
      >
        <Link to="/">Home</Link>
        <ChevronRight size={14} />
        <Link to="/services">Services</Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--primary-navy)', fontWeight: 600 }}>{service.name}</span>
      </nav>

      {/* Main Details Grid */}
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '40px',
          padding: '36px',
          marginBottom: '48px'
        }}
      >
        {/* Left: Service Image */}
        <div>
          <img
            src={getServiceImage(service)}
            alt={service.name}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = homeMaintenanceImg;
            }}
            style={{
              width: '100%',
              maxHeight: '420px',
              objectFit: 'cover',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)'
            }}
          />
        </div>

        {/* Right: Service Information */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="badge badge-accepted">{service.category}</span>
            <span
              style={{
                fontSize: '14px',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600
              }}
            >
              <Star size={16} fill="#f59e0b" /> {service.rating || 4.8}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
              ({service.reviewsCount || 120} reviews)
            </span>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '10px' }}>
            {service.name}
          </h1>

          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '14px', color: 'var(--secondary-text)' }}>Starting at</span>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary-navy)', lineHeight: 1 }}>
              ₹{Number(service.price).toLocaleString('en-IN')}
            </div>
          </div>

          <p style={{ fontSize: '15px', color: 'var(--secondary-text)', lineHeight: '1.6', marginBottom: '24px' }}>
            {service.description}
          </p>

          {/* Features Included Checklist */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '12px' }}>
              Service Inclusions & Benefits:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(service.features || ['Leak Repair', 'Pipe Installation', 'Fittings Replacement', 'Safety Audit']).map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Book Now Button */}
          <div style={{ marginTop: 'auto' }}>
            <Link
              to={`/booking/${service._id}`}
              className="btn btn-navy"
              style={{ width: '100%', padding: '14px', fontSize: '16px' }}
            >
              Book This Service Now <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <section className="card" style={{ padding: '36px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '24px' }}>
          How It Works
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <Calendar size={22} />
            </div>
            <strong style={{ fontSize: '15px', display: 'block', color: 'var(--primary-navy)' }}>
              1. Book
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
              Select service & convenient time
            </span>
          </div>

          <div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <UserCheck size={22} />
            </div>
            <strong style={{ fontSize: '15px', display: 'block', color: 'var(--primary-navy)' }}>
              2. We Assign
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
              Our verified pro arrives on time
            </span>
          </div>

          <div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <strong style={{ fontSize: '15px', display: 'block', color: 'var(--primary-navy)' }}>
              3. Get It Done
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
              Service completed with warranty
            </span>
          </div>

          <div>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}
            >
              <CreditCard size={22} />
            </div>
            <strong style={{ fontSize: '15px', display: 'block', color: 'var(--primary-navy)' }}>
              4. Pay
            </strong>
            <span style={{ fontSize: '13px', color: 'var(--secondary-text)' }}>
              Pay securely and download invoice
            </span>
          </div>
        </div>
      </section>

      {/* Verified Customer Reviews with Avatars */}
      <section className="card" style={{ padding: '36px', marginTop: '32px' }}>
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-navy)' }}>
              Customer Reviews & Ratings ({service.reviewsCount || 120})
            </h3>
            <p style={{ color: 'var(--secondary-text)', fontSize: '14px' }}>
              Verified feedback from homeowners who booked this service.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>
            <Star size={20} fill="#f59e0b" /> {service.rating || 4.8} / 5.0
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '18px', background: 'var(--bg-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <img
                src="/assets/images/avatar-customer.jpg"
                alt="Reviewer"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/images/cleaning.jpg';
                }}
                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--primary-navy)', display: 'block' }}>Kavita Mehta</strong>
                <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Verified Homeowner • 2 days ago</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', color: '#f59e0b' }}>
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--primary-text)', lineHeight: '1.5' }}>
              "The technician was extremely polite and arrived right on time. Diagnosed the root problem quickly and solved it without any mess. Worth every rupee!"
            </p>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '18px', background: 'var(--bg-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <img
                src="/assets/images/avatar-worker.jpg"
                alt="Reviewer"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/images/cleaning.jpg';
                }}
                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--primary-navy)', display: 'block' }}>Sanjay Verma</strong>
                <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>Verified Homeowner • 1 week ago</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', color: '#f59e0b' }}>
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
                <Star size={14} fill="#f59e0b" />
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--primary-text)', lineHeight: '1.5' }}>
              "Live tracking made it so simple to know exactly when the technician would arrive. Great job, neat finish, and upfront transparent price."
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
