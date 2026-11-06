import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';
import http from 'http';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

function postLocationHttp(token, bookingId, coords) {
  const data = JSON.stringify(coords);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/tracking/${bookingId}/location`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          Authorization: `Bearer ${token}`
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function loginApi(email, password) {
  const data = JSON.stringify({ email, password });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve(JSON.parse(body || '{}')));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export async function runGpsTrackingTests() {
  console.log('====================================================');
  console.log('SUITE 9: LIVE GPS TRACKING & MAP AUDIT IN CHROME');
  console.log('====================================================');

  const results = [];
  const recordResult = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const WorkerLocation = mongoose.model('WorkerLocation', new mongoose.Schema({}, { strict: false }), 'workerlocations');

  const worker = await User.findOne({ email: 'worker@hometech.demo' });
  const cust = await User.findOne({ email: 'customer@hometech.demo' });

  // Create an active accepted booking for GPS tracking
  const trackingBkg = await Booking.create({
    bookingId: `HT-GPS-${Math.floor(100000 + Math.random() * 900000)}`,
    customerId: cust._id,
    workerId: worker._id,
    category: 'Plumbing',
    status: 'Accepted',
    address: '22 Marine Drive, Mumbai, 400020',
    contactNumber: '9876543210',
    bookingDate: new Date(),
    bookingTime: '11:00 AM',
    totalAmount: 499
  });

  const workerLoginRes = await loginApi('worker@hometech.demo', 'HomeTech@123');
  const workerToken = workerLoginRes.token;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // ----------------------------------------------------
    // TEST 1: Worker sends live GPS coordinates
    // ----------------------------------------------------
    const testCoords = {
      latitude: 18.9220,
      longitude: 72.8347,
      accuracy: 12,
      speed: 15,
      heading: 90
    };

    const updateRes = await postLocationHttp(workerToken, trackingBkg.bookingId, testCoords);
    recordResult('1. Worker Posts GPS Coordinates via API', updateRes.status === 200, `HTTP ${updateRes.status}`);

    // Verify in MongoDB
    const savedLoc = await WorkerLocation.findOne({ bookingId: trackingBkg._id });
    const isCoordsInDb = savedLoc && savedLoc.latitude === 18.9220 && savedLoc.longitude === 72.8347;
    recordResult('2. GPS Coordinates Persisted in MongoDB', isCoordsInDb, `Lat: ${savedLoc?.latitude}, Lng: ${savedLoc?.longitude}`);

    // ----------------------------------------------------
    // TEST 2: Customer Logs In and Views Live Tracking Map
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'customer@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    // Navigate to tracking page for this booking
    await page.goto(`${BASE_URL}/tracking/${trackingBkg.bookingId}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const trackingPageText = await page.evaluate(() => document.body.innerText);
    const hasBookingId = trackingPageText.includes(trackingBkg.bookingId);
    const hasWorkerName = trackingPageText.includes(worker.name) || trackingPageText.includes('Service Professional');
    recordResult('3. Customer Live Tracking Page Rendered', hasBookingId && hasWorkerName, `Header content verified`);

    // Verify Leaflet Map Container rendered
    const hasMapContainer = await page.evaluate(() => {
      const container = document.querySelector('.leaflet-container');
      return container !== null;
    });
    recordResult('4. Leaflet Interactive Map Container Active', hasMapContainer, 'Map DOM element mounted');

    // Verify Marker on map
    const hasLeafletMarker = await page.evaluate(() => {
      const markers = document.querySelectorAll('.leaflet-marker-icon');
      return markers.length > 0;
    });
    recordResult('5. Worker GPS Position Marker Displayed on Map', hasLeafletMarker, 'Leaflet marker active');

    // ----------------------------------------------------
    // TEST 3: Unauthorized Customer Blocked
    // ----------------------------------------------------
    // Log in as different customer or query tracking API as unassigned user
    const otherCustRes = await loginApi('workerc@hometech.demo', 'HomeTech@123');
    const unauthorizedRes = await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port: 5000,
          path: `/api/tracking/${trackingBkg.bookingId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${otherCustRes.token}` }
        },
        res => resolve(res.statusCode)
      );
      req.end();
    });
    recordResult('6. Unauthorized User Denied Tracking Access (403 Forbidden)', unauthorizedRes === 403, `HTTP ${unauthorizedRes}`);

    // Invalid coordinates rejected
    const invalidCoordsRes = await postLocationHttp(workerToken, trackingBkg.bookingId, {
      latitude: 199.99, // Invalid
      longitude: 80.0
    });
    recordResult('7. Invalid Coordinate Range Rejected (HTTP 400)', invalidCoordsRes.status === 400, `HTTP ${invalidCoordsRes.status}`);

  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    recordResult('Execution without uncaught error', false, err.message);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} TESTS PASSED`);
  console.log('====================================================');
  return results;
}

if (process.argv[1] && process.argv[1].includes('test_live_gps_tracking.js')) {
  runGpsTrackingTests().then((results) => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });
}
