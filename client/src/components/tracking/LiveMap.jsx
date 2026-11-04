import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Custom SVG Icons
const workerIcon = L.divIcon({
  className: 'custom-worker-marker',
  html: `<div style="background-color: #071D49; color: #FFC928; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.35); border: 2.5px solid #FFFFFF;">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -22]
});

const customerIcon = L.divIcon({
  className: 'custom-customer-marker',
  html: `<div style="background-color: #DC3545; color: #FFFFFF; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.35); border: 2.5px solid #FFFFFF;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20]
});

export default function LiveMap({
  center = [16.5062, 80.6480],
  zoom = 14,
  workerLocation,
  customerLocation,
  allWorkers = [],
  onWorkerClick
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const workerMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const multiMarkersRef = useRef([]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter = (workerLocation?.latitude && workerLocation?.longitude)
        ? [Number(workerLocation.latitude), Number(workerLocation.longitude)]
        : center;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView(initialCenter, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size to guarantee tiles render properly even after flexbox layout settles
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Single Tracking updates (Customer Tracking Page & Customer Dashboard Mini-Map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (workerLocation && workerLocation.latitude != null && workerLocation.longitude != null) {
      const wLat = Number(workerLocation.latitude);
      const wLng = Number(workerLocation.longitude);
      if (isNaN(wLat) || isNaN(wLng)) return;

      const wPos = [wLat, wLng];
      const speedKmh = Math.round(workerLocation.speed || 0);
      const updatedTime = workerLocation.lastUpdated
        ? new Date(workerLocation.lastUpdated).toLocaleTimeString()
        : 'Just now';

      if (!workerMarkerRef.current) {
        workerMarkerRef.current = L.marker(wPos, { icon: workerIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: inherit; font-size: 13px;">
              <strong style="color:#071D49; font-size: 14px;">${workerLocation.name || 'Service Professional'}</strong><br/>
              <span style="color:#198754; font-weight:600;">● Active on Duty</span><br/>
              <b>Moving speed:</b> ${speedKmh} km/h<br/>
              <small style="color:#64748b;">Updated: ${updatedTime}</small>
            </div>`
          );
        // Center the map on the worker when the first valid GPS update arrives
        map.setView(wPos, 15);
      } else {
        workerMarkerRef.current.setLatLng(wPos);
        workerMarkerRef.current.setPopupContent(
          `<div style="font-family: inherit; font-size: 13px;">
            <strong style="color:#071D49; font-size: 14px;">${workerLocation.name || 'Service Professional'}</strong><br/>
            <span style="color:#198754; font-weight:600;">● Active on Duty</span><br/>
            <b>Moving speed:</b> ${speedKmh} km/h<br/>
            <small style="color:#64748b;">Updated: ${updatedTime}</small>
          </div>`
        );
      }
      console.log('[TRACKING] Leaflet marker updated', wPos);

      // Check if customer destination coordinates are valid and within reasonable distance
      const hasCustomerCoords =
        customerLocation &&
        customerLocation.latitude != null &&
        customerLocation.longitude != null &&
        !isNaN(Number(customerLocation.latitude)) &&
        !isNaN(Number(customerLocation.longitude));

      let cPos = null;
      if (hasCustomerCoords) {
        cPos = [Number(customerLocation.latitude), Number(customerLocation.longitude)];
      } else {
        // Place customer destination slightly offset in vicinity (e.g. 500m)
        cPos = [wLat + 0.005, wLng + 0.005];
      }

      if (!customerMarkerRef.current) {
        customerMarkerRef.current = L.marker(cPos, { icon: customerIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: inherit; font-size: 13px;">
              <strong style="color:#DC3545; font-size: 14px;">Service Destination</strong><br/>
              <span>${customerLocation?.address || 'Customer Location'}</span>
            </div>`
          );
      } else {
        customerMarkerRef.current.setLatLng(cPos);
      }

      // Draw route path line between worker and destination
      if (!polylineRef.current) {
        polylineRef.current = L.polyline([wPos, cPos], {
          color: '#071D49',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.85
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs([wPos, cPos]);
      }

      // Smoothly pan & fit bounds
      try {
        const bounds = L.latLngBounds([wPos, cPos]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch (err) {
        map.setView(wPos, 15);
      }

      map.invalidateSize();
    }
  }, [workerLocation, customerLocation]);

  // Handle Multi-Worker mode (Admin Tracking Page)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !allWorkers || allWorkers.length === 0) return;

    // Clear old markers
    multiMarkersRef.current.forEach((m) => m.remove());
    multiMarkersRef.current = [];

    const latLngs = [];

    allWorkers.forEach((w) => {
      const loc = w.location;
      if (loc && loc.latitude != null && loc.longitude != null) {
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const pos = [lat, lng];
        latLngs.push(pos);

        const marker = L.marker(pos, { icon: workerIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: inherit; font-size: 13px;">
              <strong style="color:#071D49; font-size:14px;">${w.worker?.name || 'Worker'}</strong><br/>
              <b>Trade:</b> ${w.category || 'Service'}<br/>
              <b>Booking:</b> ${w.bookingId}<br/>
              <b>Status:</b> ${w.status}<br/>
              <small style="color:#64748b;">Last Updated: ${new Date(loc.lastUpdated).toLocaleTimeString()}</small>
            </div>`
          );

        if (onWorkerClick) {
          marker.on('click', () => onWorkerClick(w));
        }

        multiMarkersRef.current.push(marker);
      }
    });

    if (latLngs.length > 0) {
      try {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch (e) {
        map.setView(latLngs[0], 14);
      }
    }
    map.invalidateSize();
  }, [allWorkers, onWorkerClick]);

  const hasValidWorkerLoc =
    workerLocation &&
    workerLocation.latitude != null &&
    workerLocation.longitude != null &&
    !isNaN(Number(workerLocation.latitude)) &&
    !isNaN(Number(workerLocation.longitude));

  const isStale =
    hasValidWorkerLoc &&
    workerLocation.lastUpdated &&
    Date.now() - new Date(workerLocation.lastUpdated).getTime() > 5 * 60 * 1000;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '350px' }}>
      <div
        ref={mapContainerRef}
        className="map-wrapper"
        style={{ width: '100%', height: '100%', minHeight: '350px' }}
      />

      {!hasValidWorkerLoc && allWorkers.length === 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(7, 29, 73, 0.92)',
            color: '#FFFFFF',
            padding: '10px 22px',
            borderRadius: 'var(--radius-full)',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textAlign: 'center',
            maxWidth: '90%'
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#FFC928',
              boxShadow: '0 0 8px #FFC928',
              animation: 'pulse 1.5s infinite'
            }}
          />
          Waiting for worker location. The map will update automatically when GPS data is received.
        </div>
      )}

      {isStale && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 1000,
            backgroundColor: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          Last updated at {new Date(workerLocation.lastUpdated).toLocaleTimeString()} (may not be current)
        </div>
      )}
    </div>
  );
}
