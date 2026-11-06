import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Wrench,
  Zap,
  Sparkles,
  Hammer,
  PaintRoller,
  Refrigerator,
  Wind,
  Bug,
  Home as HomeIcon,
  Search,
  ArrowRight,
  ShieldCheck,
  Clock,
  ThumbsUp,
  Star,
  CheckCircle2,
  Calendar,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  serviceCategoryImages,
  plumbingImg,
  homeMaintenanceImg,
  getServiceImage
} from '../../assets/images';

const categoryIcons = {
  Plumbing: Wrench,
  Electrical: Zap,
  Cleaning: Sparkles,
  Carpentry: Hammer,
  Painting: PaintRoller,
  'Appliance Repair': Refrigerator,
  'AC Repair': Wind,
  'Pest Control': Bug,
  'Home Maintenance': HomeIcon
};

const categoryImages = serviceCategoryImages;

const testimonials = [
  {
    id: 1,
    name: 'Rohit Deshmukh',
    location: 'Vijayawada',
    service: 'Plumbing Service',
    rating: 5,
    avatar: '/assets/images/avatar-customer.jpg',
    comment:
      'The plumber arrived in 15 minutes after accepting the request. Fixed the leaking kitchen sink and installed a new tap mixer effortlessly. Excellent tracking feature!'
  },
  {
    id: 2,
    name: 'Ananya Rao',
    location: 'Vijayawada',
    service: 'Deep Cleaning',
    rating: 5,
    avatar: '/assets/images/cleaning.jpg',
    comment:
      'Booked home cleaning for my 3BHK flat. The team arrived on time with professional equipment. The kitchen and bathrooms look spotless. Highly recommended!'
  },
  {
    id: 3,
    name: 'Vikram Malhotra',
    location: 'Vijayawada',
    service: 'AC Repair & Servicing',
    rating: 5,
    avatar: '/assets/images/avatar-worker.jpg',
    comment:
      'Fast diagnosis of my AC cooling issue and gas refill. Fair, transparent pricing with no hidden charges. Received an instant digital tax invoice too.'
  }
];

export default function HomePage() {
  const { services, categories } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/services?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/services');
    }
  };

  const featuredServices = services.slice(0, 6);

  return (
    <div className="home-page">
      {/* 1. Hero Section */}
      <section
        style={{
          backgroundColor: 'var(--primary-navy)',
          color: 'var(--white)',
          padding: '70px 0 90px 0',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(255, 201, 40, 0.15)',
                color: 'var(--accent-yellow)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '13px',
                fontWeight: 700,
                marginBottom: '18px',
                letterSpacing: '0.05em'
              }}
            >
              ★ INDIA'S TRUSTED HOME SERVICES PLATFORM
            </span>
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 800,
                lineHeight: '1.15',
                marginBottom: '18px',
                color: 'var(--white)',
                letterSpacing: '-0.02em'
              }}
            >
              We Take Care of <br />
              <span style={{ color: 'var(--accent-yellow)' }}>Your Home</span>
            </h1>
            <p
              style={{
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: '1.6',
                marginBottom: '32px',
                maxWidth: '520px'
              }}
            >
              Book trusted, verified professionals for all your home repair, maintenance, cleaning,
              and installation needs. Fast, reliable, and guaranteed satisfaction.
            </p>

            {/* Hero Search Box */}
            <form
              onSubmit={handleSearch}
              style={{
                display: 'flex',
                background: 'var(--white)',
                padding: '6px',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
                maxWidth: '540px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, paddingLeft: '14px', gap: '10px' }}>
                <Search size={20} color="var(--secondary-text)" />
                <input
                  type="text"
                  placeholder="What service do you need? (e.g. Plumbing, Cleaning)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '15px',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>
              <button type="submit" className="btn btn-yellow" style={{ padding: '12px 24px', fontSize: '15px' }}>
                Book Now
              </button>
            </form>

            {/* Quick stats pills */}
            <div style={{ display: 'flex', gap: '24px', marginTop: '36px' }}>
              <div>
                <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-white)' }}>
                  0
                </strong>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Completed Jobs</p>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div>
                <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-white)' }}>
                  0 / 5
                </strong>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Customer Rating</p>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div>
                <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-white)' }}>
                  100%
                </strong>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Verified Pros</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div style={{ position: 'relative' }}>
            <img
              src={homeMaintenanceImg}
              alt="Professional Home Maintance"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = homeMaintenanceImg;
              }}
              style={{
                width: '100%',
                maxHeight: '440px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                border: '4px solid rgba(255, 255, 255, 0.1)'
              }}
            />
            {/* Overlay badge */}
            <div
              style={{
                position: 'absolute',
                bottom: '-16px',
                left: '24px',
                background: 'var(--white)',
                color: 'var(--primary-navy)',
                padding: '14px 20px',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'var(--accent-yellow-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-navy)'
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <div>
                <strong style={{ fontSize: '14px', display: 'block' }}>Verified Background</strong>
                <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                  Every technician is vetted
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Service Categories Grid with Images */}
      <section className="container page-pad">
        <div className="page-heading">
          <span className="eyebrow">OUR CATEGORIES</span>
          <h2>Explore Professional Services</h2>
          <p>Choose from our specialized home service categories handled by qualified experts.</p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: '18px',
            marginBottom: '40px'
          }}
        >
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.name] || Wrench;
            const imgPath = categoryImages[cat.name] || plumbingImg;
            return (
              <Link
                key={cat._id}
                to={`/services?category=${encodeURIComponent(cat.name)}`}
                style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--primary-navy)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Category Thumbnail Image */}
                <div style={{ position: 'relative', height: '110px', width: '100%', overflow: 'hidden' }}>
                  <img
                    src={imgPath}
                    alt={cat.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = homeMaintenanceImg;
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-16px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--primary-navy)',
                      color: 'var(--accent-yellow)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                      border: '2px solid var(--white)'
                    }}
                  >
                    <Icon size={18} />
                  </div>
                </div>

                <div style={{ padding: '24px 12px 14px 12px' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--primary-navy)', display: 'block' }}>
                    {cat.name}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--secondary-text)', marginTop: '2px', display: 'block' }}>
                    Verified Specialists
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/services" className="btn btn-navy">
            View All Services <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* 3. Featured Services Section */}
      <section style={{ backgroundColor: 'var(--white)', padding: '70px 0' }}>
        <div className="container">
          <div className="page-heading">
            <span className="eyebrow">POPULAR BOOKINGS</span>
            <h2>Our Featured Services</h2>
            <p>Most booked home maintenance and repair solutions loved by homeowners.</p>
          </div>

          <div className="services-grid">
            {featuredServices.map((service) => (
              <div key={service._id} className="service-card">
                <img
                  src={getServiceImage(service)}
                  alt={service.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = homeMaintenanceImg;
                  }}
                  className="service-card-image"
                  style={{ height: '200px', objectFit: 'cover' }}
                />
                <div className="service-card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span className="badge badge-accepted">{service.category}</span>
                    <span style={{ fontSize: '13px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
                      <Star size={14} fill="#f59e0b" /> {service.rating || 4.8}
                    </span>
                  </div>

                  <h3 className="service-card-title">{service.name}</h3>
                  <p className="service-card-desc">{service.description}</p>

                  <div className="service-card-footer">
                    <div className="service-price">
                      <span>Starting at</span>
                      <strong>₹{Number(service.price).toLocaleString('en-IN')}</strong>
                    </div>
                    <Link to={`/booking/${service._id}`} className="btn btn-navy btn-small">
                      Book Now
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How It Works (from Prototype) with Visual Steps */}
      <section className="container page-pad" id="how-it-works">
        <div className="page-heading">
          <span className="eyebrow">SIMPLE 4-STEP PROCESS</span>
          <h2>How HomeTech Works</h2>
          <p>Booking home services has never been simpler, quicker, or more transparent.</p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
            textAlign: 'center'
          }}
        >
          <div className="card" style={{ padding: '24px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '22px',
                fontWeight: 800
              }}
            >
              <Calendar size={26} />
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-navy)', marginBottom: '8px' }}>1. Book Online</h3>
            <p style={{ fontSize: '14px', color: 'var(--secondary-text)', lineHeight: 1.5 }}>
              Choose your required service, select date & preferred time slot, and enter your address.
            </p>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '22px',
                fontWeight: 800
              }}
            >
              <UserCheck size={26} />
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-navy)', marginBottom: '8px' }}>2. We Assign</h3>
            <p style={{ fontSize: '14px', color: 'var(--secondary-text)', lineHeight: 1.5 }}>
              Our matching engine routes your job strictly to certified pros in that category.
            </p>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '22px',
                fontWeight: 800
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-navy)', marginBottom: '8px' }}>3. Get It Done</h3>
            <p style={{ fontSize: '14px', color: 'var(--secondary-text)', lineHeight: 1.5 }}>
              Track the worker's arrival live on an interactive map and get the work done flawlessly.
            </p>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--primary-navy)',
                color: 'var(--accent-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '22px',
                fontWeight: 800
              }}
            >
              <CreditCard size={26} />
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-navy)', marginBottom: '8px' }}>4. Easy Payment</h3>
            <p style={{ fontSize: '14px', color: 'var(--secondary-text)', lineHeight: 1.5 }}>
              Pay securely via test mock checkout, download instant invoices, and leave reviews.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Customer Testimonials Section with Authentic User Photos */}
      <section style={{ backgroundColor: '#EEF2F6', padding: '70px 0' }}>
        <div className="container">
          <div className="page-heading">
            <span className="eyebrow">WHAT CUSTOMERS SAY</span>
            <h2>Real Reviews from Real Homes</h2>
            <p>Read experiences from homeowners who booked trusted professionals on HomeTech.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '24px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '12px', color: '#f59e0b' }}>
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} size={16} fill="#f59e0b" />
                    ))}
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--primary-text)', lineHeight: '1.6', fontStyle: 'italic', marginBottom: '20px' }}>
                    "{t.comment}"
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <img
                    src={t.avatar}
                    alt={t.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/assets/images/avatar-customer.jpg';
                    }}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--primary-navy)'
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--primary-navy)', display: 'block' }}>
                      {t.name}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                      {t.service} • {t.location}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Why Choose Us Guarantee Banner */}
      <section style={{ backgroundColor: 'var(--primary-navy)', color: 'var(--white)', padding: '60px 0' }} id="about">
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '30px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255,201,40,0.15)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-yellow)' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '17px', color: 'var(--white)', marginBottom: '6px' }}>Verified Technicians</h4>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                Every professional undergoes identity checks and rigorous skills verification.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255,201,40,0.15)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-yellow)' }}>
              <Clock size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '17px', color: 'var(--white)', marginBottom: '6px' }}>On-Time Arrival</h4>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                Real-time GPS worker location tracking guarantees accurate arrival estimations.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255,201,40,0.15)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-yellow)' }}>
              <ThumbsUp size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '17px', color: 'var(--white)', marginBottom: '6px' }}>Transparent Pricing</h4>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                Upfront, transparent pricing with no hidden charges or post-service surprises.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
