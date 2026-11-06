import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Upload,
  X,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { getServiceImage, homeMaintenanceImg } from '../../assets/images';

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM'
];

export default function BookingPage() {
  const { serviceId } = useParams();
  const { user, services, notify } = useAuth();
  const navigate = useNavigate();

  const [selectedServiceId, setSelectedServiceId] = useState(serviceId || '');
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('10:00 AM');
  const [address, setAddress] = useState(user?.address || '123, Green Street, Vijayawada');
  const [contactNumber, setContactNumber] = useState(user?.phone || '9876543210');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [problemPhotos, setProblemPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (serviceId) setSelectedServiceId(serviceId);
  }, [serviceId]);

  const currentService = services.find((s) => s._id === selectedServiceId) || services[0] || null;

  const minDate = new Date().toISOString().split('T')[0];

  const handlePhotoSelect = (e) => {
    setPhotoError('');
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (problemPhotos.length + files.length > 5) {
      setPhotoError('You can upload a maximum of 5 photographs.');
      return;
    }

    const validFiles = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setPhotoError('Only JPG, JPEG, PNG, and WEBP formats are supported.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setPhotoError(`File "${file.name}" exceeds the 5 MB limit.`);
        return;
      }
      validFiles.push({
        file,
        name: file.name,
        sizeMb: (file.size / (1024 * 1024)).toFixed(1),
        previewUrl: URL.createObjectURL(file)
      });
    }

    setProblemPhotos((prev) => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const handleRemovePhoto = (index) => {
    setProblemPhotos((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentService) {
      notify('Please select a service to book.', 'danger');
      return;
    }
    if (!address.trim()) {
      notify('Service address is required.', 'danger');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(contactNumber.trim())) {
      notify('Please enter a valid 10-digit mobile number.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPhotoData = [];
      if (problemPhotos.length > 0) {
        const formData = new FormData();
        problemPhotos.forEach((item) => formData.append('photos', item.file));

        const uploadRes = await api.post('/bookings/upload-problem-photos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
            }
          }
        });
        uploadedPhotoData = uploadRes.data?.photos || [];
      }

      const payload = {
        serviceId: currentService._id,
        bookingDate,
        bookingTime,
        address: address.trim(),
        contactNumber: contactNumber.trim(),
        instructions: instructions.trim(),
        problemPhotos: uploadedPhotoData
      };

      const { data } = await api.post('/bookings', payload);
      notify(data.message, 'success');
      navigate('/customer/dashboard');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to place booking.', 'danger');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="container page-pad" style={{ maxWidth: '1000px' }}>
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.3fr',
          overflow: 'hidden',
          padding: 0,
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Left Side: Booking Graphic & Summary */}
        <div
          style={{
            backgroundColor: 'var(--primary-navy)',
            color: 'var(--white)',
            padding: '40px 32px',
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
                marginBottom: '14px'
              }}
            >
              FAST & SECURE
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px' }}>
              Book a Service
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: 1.5 }}>
              Schedule top-rated service professionals for home visits at your convenient time.
            </p>
          </div>

          {/* Service Image matching Prototype */}
          <div style={{ margin: '14px 0' }}>
            <img
              src={getServiceImage(currentService)}
              alt={currentService?.name || 'Service Booking'}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = homeMaintenanceImg;
              }}
              style={{
                width: '100%',
                height: '160px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-md)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                boxShadow: 'var(--shadow-sm)'
              }}
            />
          </div>

          {/* Service Price Summary Card */}
          {currentService && (
            <div
              style={{
                background: 'rgba(255,255,255,0.08)',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                margin: '24px 0',
                border: '1px solid rgba(255,255,255,0.12)'
              }}
            >
              <h4 style={{ color: 'var(--accent-yellow)', fontSize: '16px', marginBottom: '8px' }}>
                {currentService.name}
              </h4>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '14px' }}>
                Category: {currentService.category}
              </p>
              <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                <span style={{ fontSize: '14px' }}>Estimated Total:</span>
                <strong style={{ fontSize: '22px', color: 'var(--accent-yellow)' }}>
                  ₹{Number(currentService.price).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="var(--accent-yellow)" />
              <span>Certified & Background Verified Technicians</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="var(--accent-yellow)" />
              <span>Live Real-Time GPS Tracking Upon Assignment</span>
            </div>
          </div>
        </div>

        {/* Right Side: Booking Form (Prototype Page 6) */}
        <div style={{ padding: '36px 32px' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '4px' }}>
            Fill Booking Details
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--secondary-text)', marginBottom: '24px' }}>
            Complete the form to schedule your appointment.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Select Service */}
            <div className="form-group">
              <label>Select Service *</label>
              <select
                className="form-select"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                required
              >
                {services.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.category}) — ₹{s.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time Slot in 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Select Date *</label>
                <input
                  type="date"
                  className="form-input"
                  min={minDate}
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Select Time *</label>
                <select
                  className="form-select"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  required
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Service Address */}
            <div className="form-group">
              <label>Service Address *</label>
              <textarea
                rows="2"
                className="form-textarea"
                placeholder="Enter complete house / flat address and landmark..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            {/* Contact Number */}
            <div className="form-group">
              <label>Contact Number (10 Digits) *</label>
              <input
                type="text"
                maxLength={10}
                inputMode="numeric"
                className="form-input"
                placeholder="Enter 10-digit mobile number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>

            {/* Additional Instructions */}
            <div className="form-group">
              <label>Add Instructions (Optional)</label>
              <textarea
                rows="2"
                className="form-textarea"
                placeholder="e.g. Ring the bell twice, bring replacement valves, etc."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {/* Upload Photos of the Problem (Part 3) */}
            <div className="form-group" style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontWeight: 700, color: 'var(--primary-navy)' }}>
                  Upload Photos of the Problem (Optional)
                </label>
                <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
                  {problemPhotos.length} / 5 photos
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--secondary-text)', marginBottom: '10px', lineHeight: 1.4 }}>
                Upload photographs of the issue so the service professional can understand the problem before arriving.
              </p>

              {/* Photo Input Box */}
              {problemPhotos.length < 5 && (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '18px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <Upload size={22} color="var(--primary-navy)" style={{ marginBottom: '6px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-navy)' }}>
                    Click to browse problem photos
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--secondary-text)', marginTop: '2px' }}>
                    JPG, JPEG, PNG, WEBP (Max 5 MB per image)
                  </span>
                </label>
              )}

              {photoError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{photoError}</span>
                </div>
              )}

              {/* Selected Photo Previews */}
              {problemPhotos.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
                    gap: '10px',
                    marginTop: '12px'
                  }}
                >
                  {problemPhotos.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        aspectRatio: '1',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <img
                        src={item.previewUrl}
                        alt={`Problem preview ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Remove photo"
                      >
                        <X size={14} />
                      </button>
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                          color: '#ffffff',
                          fontSize: '10px',
                          padding: '2px 4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.sizeMb} MB
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Uploading photos...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--primary-navy)', transition: 'width 0.2s' }} />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-navy btn-full"
              style={{ padding: '13px', fontSize: '15px', marginTop: '12px' }}
              disabled={submitting}
            >
              {submitting ? 'Placing Booking...' : 'Continue & Confirm Booking'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
