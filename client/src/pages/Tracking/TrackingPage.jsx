import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Phone,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Radio,
  ArrowLeft,
  ShieldCheck,
  User,
  Wrench,
  Navigation
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import LiveMap from '../../components/tracking/LiveMap';
import api from '../../api';

export default function TrackingPage() {
  const { bookingId } = useParams();
  const socket = useSocket();

  const [trackingData, setTrackingData] = useState(null);
  const [workerLoc, setWorkerLoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastPing, setLastPing] = useState(null);

  // Fetch initial tracking details immediately
  useEffect(() => {
    setLoading(true);
    console.log('[TRACKING] Tracking API called');
    api.get(`/tracking/${bookingId}`)
      .then(({ data }) => {
        setTrackingData(data);
        const rawLoc = data.location || data.currentLocation;
        if (rawLoc && rawLoc.latitude != null && rawLoc.longitude != null) {
          const loc = {
            name: data.worker?.name || 'Service Pro',
            latitude: Number(rawLoc.latitude),
            longitude: Number(rawLoc.longitude),
            accuracy: rawLoc.accuracy || 0,
            speed: rawLoc.speed || 0,
            lastUpdated: rawLoc.lastUpdated ? new Date(rawLoc.lastUpdated) : new Date()
          };
          setWorkerLoc(loc);
          setLastPing(loc.lastUpdated);
          console.log('[TRACKING] Latest location received', loc);
        } else {
          setWorkerLoc(null);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load tracking information.');
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  // Socket.IO real-time location updates & room subscription
  useEffect(() => {
    if (!socket || !bookingId) return;

    console.log('[TRACKING] Socket connected');
    // Join tracking room
    socket.emit('join-tracking', { bookingId, role: 'customer' });

    // Handle live location broadcast
    const handleLocationUpdate = (payload) => {
      if (payload && payload.latitude != null && payload.longitude != null) {
        console.log('[TRACKING] Location update received', payload);
        const updateTime = payload.lastUpdated ? new Date(payload.lastUpdated) : new Date();
        setWorkerLoc((prev) => ({
          name: trackingData?.worker?.name || payload.workerName || prev?.name || 'Service Pro',
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          accuracy: payload.accuracy || 0,
          speed: payload.speed || 0,
          lastUpdated: updateTime
        }));
        setLastPing(updateTime);
      }
    };

    // Handle booking status updates (e.g. In Progress, Completed)
    const handleStatusUpdate = (payload) => {
      if (payload && payload.status) {
        setTrackingData((prev) => (prev ? { ...prev, status: payload.status } : prev));
      }
    };

    socket.on('worker_location_updated', handleLocationUpdate);
    socket.on('location-updated', handleLocationUpdate);
    socket.on('booking-status-updated', handleStatusUpdate);

    return () => {
      socket.emit('leave-tracking', { bookingId });
      socket.off('worker_location_updated', handleLocationUpdate);
      socket.off('location-updated', handleLocationUpdate);
      socket.off('booking-status-updated', handleStatusUpdate);
    };
  }, [socket, bookingId, trackingData]);

  if (loading) {
    return (
      <div className="container page-pad" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="spinner" />
        <p style={{ marginTop: '12px' }}>Connecting to live service tracking...</p>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="container page-pad" style={{ textAlign: 'center', padding: '80px 0' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ margin: '0 auto 16px auto' }} />
        <h2>Tracking Unavailable</h2>
        <p style={{ color: 'var(--secondary-text)', marginTop: '8px' }}>
          {error || 'Worker is currently off-duty or tracking has not started yet.'}
        </p>
        <Link to="/customer/dashboard" className="btn btn-navy" style={{ marginTop: '20px' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const worker = trackingData.worker;

  return (
    <div className="tracking-page" style={{ minHeight: 'calc(100vh - var(--navbar-height))', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Information Bar */}
      <div
        style={{
          backgroundColor: 'var(--primary-navy)',
          color: 'var(--white)',
          padding: '16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div className="container flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
          {/* Left: Worker Profile Image, Name, Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link to="/customer/dashboard" className="btn btn-outline btn-small" style={{ color: 'var(--white)' }}>
              <ArrowLeft size={16} /> Back
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={worker?.profileImage || '/assets/images/avatar-worker.jpg'}
                alt={worker?.name || 'Worker'}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/images/avatar-worker.jpg';
                }}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--accent-yellow)'
                }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                    {worker ? worker.name : 'Service Professional'}
                  </h3>
                  <span className={`badge badge-${trackingData.status.toLowerCase().replace(/\s+/g, '')}`}>
                    {trackingData.status}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
                  {trackingData.category} Specialist • Verified Pro
                </span>
              </div>
            </div>
          </div>

          {/* Right: Booking ID, Service Category, Arrival, Call Button */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                Service Category
              </span>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {trackingData.serviceName || trackingData.category}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                Booking ID
              </span>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-yellow)' }}>
                {trackingData.bookingId}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                Estimated Arrival
              </span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                {trackingData.etaMinutes || 15} mins
              </div>
            </div>

            {worker?.phone && (
              <a
                href={`tel:${worker.phone}`}
                className="btn btn-yellow btn-small"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Phone size={14} /> Call Pro
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main Map Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Floating live tracking banner */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--white)',
            padding: '10px 22px',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid var(--border-color)',
            maxWidth: '90%'
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: workerLoc ? 'var(--success)' : '#f59e0b',
              boxShadow: `0 0 8px ${workerLoc ? 'var(--success)' : '#f59e0b'}`,
              animation: 'pulse 1.5s infinite'
            }}
          />
          <strong style={{ fontSize: '13px', color: 'var(--primary-navy)' }}>
            {workerLoc ? 'Live GPS Location Active' : 'Waiting for GPS Signal...'}
          </strong>
          <span style={{ fontSize: '12px', color: 'var(--secondary-text)' }}>
            {lastPing
              ? `Last updated: ${new Date(lastPing).toLocaleTimeString()}`
              : 'Service professional location will appear once received.'}
          </span>
        </div>

        {/* Leaflet OpenStreetMap */}
        <div style={{ flex: 1, minHeight: '520px' }}>
          <LiveMap
            workerLocation={workerLoc}
            customerLocation={{
              address: trackingData.address
            }}
          />
        </div>
      </div>
    </div>
  );
}
