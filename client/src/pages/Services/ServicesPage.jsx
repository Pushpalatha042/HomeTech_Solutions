import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Star, Filter, ArrowRight, ArrowUpDown } from 'lucide-react';
import api from '../../api';

export default function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';
  const initialSearch = searchParams.get('search') || '';

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [sortBy, setSortBy] = useState('price_asc');
  const [loading, setLoading] = useState(true);

  // Fetch categories
  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategories(data))
      .catch((err) => console.warn(err));
  }, []);

  // Fetch filtered services
  useEffect(() => {
    setLoading(true);
    const params = {};
    if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
    if (searchTerm.trim()) params.search = searchTerm.trim();
    if (sortBy) params.sort = sortBy;

    api.get('/services', { params })
      .then(({ data }) => setServices(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedCategory, searchTerm, sortBy]);

  const handleCategoryClick = (catName) => {
    setSelectedCategory(catName);
    setSearchParams((prev) => {
      if (catName === 'All') prev.delete('category');
      else prev.set('category', catName);
      return prev;
    });
  };

  return (
    <div className="container page-pad">
      <div className="page-heading">
        <span className="eyebrow">EXPLORE CATALOGUE</span>
        <h1>Our Services</h1>
        <p>Choose from a wide range of professional, on-demand home services delivered by experts.</p>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          marginBottom: '36px',
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
          <Search size={18} color="var(--secondary-text)" />
          <input
            type="text"
            className="form-input"
            placeholder="Search by service name or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={16} color="var(--secondary-text)" />
          <select
            className="form-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', padding: '8px 12px' }}
          >
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '16px',
          marginBottom: '32px'
        }}
      >
        <button
          className={`btn ${selectedCategory === 'All' ? 'btn-navy' : 'btn-outline'} btn-small`}
          onClick={() => handleCategoryClick('All')}
        >
          All Categories
        </button>
        {categories.map((c) => (
          <button
            key={c._id}
            className={`btn ${selectedCategory === c.name ? 'btn-navy' : 'btn-outline'} btn-small`}
            onClick={() => handleCategoryClick(c.name)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Services Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner" />
          <p style={{ marginTop: '12px', color: 'var(--secondary-text)' }}>Loading services catalogue...</p>
        </div>
      ) : services.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="/assets/images/home-maintenance.jpg"
            alt="No Services Found"
            style={{ width: '140px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '16px', opacity: 0.85 }}
          />
          <h3>No services found</h3>
          <p style={{ color: 'var(--secondary-text)', marginTop: '8px' }}>
            Try adjusting your search criteria or selecting another category.
          </p>
          <button className="btn btn-navy" style={{ marginTop: '20px' }} onClick={() => handleCategoryClick('All')}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((service) => (
            <div key={service._id} className="service-card">
              <Link to={`/services/${service._id}`}>
                <img
                  src={service.image || '/assets/images/plumbing.jpg'}
                  alt={service.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/images/home-maintenance.jpg';
                  }}
                  className="service-card-image"
                  style={{ height: '200px', objectFit: 'cover' }}
                />
              </Link>
              <div className="service-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span className="badge badge-accepted">{service.category}</span>
                  <span style={{ fontSize: '13px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}>
                    <Star size={14} fill="#f59e0b" /> {service.rating || 4.8} ({service.reviewsCount || 120})
                  </span>
                </div>

                <Link to={`/services/${service._id}`}>
                  <h3 className="service-card-title">{service.name}</h3>
                </Link>
                <p className="service-card-desc">{service.description}</p>

                {/* Features Checklist */}
                {service.features && service.features.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {service.features.slice(0, 3).map((f, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '11px',
                          background: 'var(--bg-color)',
                          color: 'var(--secondary-text)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                )}

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
      )}
    </div>
  );
}
