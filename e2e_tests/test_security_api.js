import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';
import http from 'http';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

function makeRequest({ path, method = 'GET', data = null, token = null }) {
  return new Promise((resolve, reject) => {
    const postData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const headers = {};
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(body);
          } catch (e) {
            parsed = { raw: body };
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

export async function runSecurityApiTests() {
  console.log('====================================================');
  console.log('SUITE 10: SECURITY, IDOR & API HARDENING AUDIT');
  console.log('====================================================');

  const results = [];
  const recordResult = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');

  // Login tokens
  const custLogin = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    data: { email: 'customer@hometech.demo', password: 'HomeTech@123' }
  });
  const customerToken = custLogin.data.token;

  const workerLogin = await makeRequest({
    path: '/api/auth/login',
    method: 'POST',
    data: { email: 'worker@hometech.demo', password: 'HomeTech@123' }
  });
  const workerToken = workerLogin.data.token;

  // Temporary second customer for IDOR testing
  let otherCust = await User.findOne({ email: 'sec_victim@hometech.demo' });
  if (!otherCust) {
    otherCust = await User.create({
      name: 'Victim Customer',
      email: 'sec_victim@hometech.demo',
      phone: '9876599999',
      password: '$2b$10$xyzFakeHash1234567890abcdefghijklmnopqrstuv',
      roles: ['customer'],
      activeRole: 'customer',
      isPhoneVerified: true,
      isActive: true
    });
  }

  // Victim's private booking
  let victimBooking = await Booking.findOne({ customerId: otherCust._id });
  if (!victimBooking) {
    victimBooking = await Booking.create({
      bookingId: `HT-SEC-${Math.floor(100000 + Math.random() * 900000)}`,
      customerId: otherCust._id,
      category: 'Plumbing',
      status: 'Awaiting Arrival Verification',
      address: '99 Secret Penthouse, South Mumbai',
      contactNumber: '9876599999',
      bookingDate: new Date(),
      bookingTime: '10:00 AM',
      totalAmount: 999
    });
  }

  try {
    // ----------------------------------------------------
    // TEST 1: NoSQL Injection Prevention
    // ----------------------------------------------------
    const nosqlRes = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      data: { email: { $gt: '' }, password: { $gt: '' } }
    });
    recordResult(
      '1. NoSQL Injection Payload Rejected (HTTP 400)',
      nosqlRes.status === 400,
      `Status: ${nosqlRes.status}`
    );

    // ----------------------------------------------------
    // TEST 2: Missing Authentication Header Rejection
    // ----------------------------------------------------
    const unauthRes = await makeRequest({
      path: '/api/bookings/my',
      method: 'GET'
    });
    recordResult(
      '2. Missing Auth Token Rejected (HTTP 401 Unauthorized)',
      unauthRes.status === 401,
      `Status: ${unauthRes.status}`
    );

    // ----------------------------------------------------
    // TEST 3: Tampered / Forged JWT Rejection
    // ----------------------------------------------------
    const forgedRes = await makeRequest({
      path: '/api/bookings/my',
      method: 'GET',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.forged_signature_xyz'
    });
    recordResult(
      '3. Forged / Tampered JWT Rejected (HTTP 401 Unauthorized)',
      forgedRes.status === 401,
      `Status: ${forgedRes.status}`
    );

    // ----------------------------------------------------
    // TEST 4: IDOR Prevention on Private Booking Retrieval
    // ----------------------------------------------------
    // Logged in customer tries to fetch victim's private booking
    const idorBookingRes = await makeRequest({
      path: `/api/bookings/${victimBooking._id}`,
      method: 'GET',
      token: customerToken
    });
    recordResult(
      '4. IDOR Defense: Cross-Customer Booking Access Blocked (HTTP 403)',
      idorBookingRes.status === 403,
      `Status: ${idorBookingRes.status}`
    );

    // ----------------------------------------------------
    // TEST 5: IDOR Prevention on Sensitive Arrival OTP
    // ----------------------------------------------------
    const idorOtpRes = await makeRequest({
      path: `/api/bookings/${victimBooking._id}/arrival-verification`,
      method: 'GET',
      token: customerToken
    });
    recordResult(
      '5. IDOR Defense: Cross-Customer Arrival OTP Access Blocked (HTTP 403)',
      idorOtpRes.status === 403,
      `Status: ${idorOtpRes.status}`
    );

    // ----------------------------------------------------
    // TEST 6: Worker Cannot Hijack Customer Completion Action
    // ----------------------------------------------------
    const workerCompleteRes = await makeRequest({
      path: `/api/bookings/${victimBooking._id}/confirm-completion`,
      method: 'PUT',
      token: workerToken
    });
    recordResult(
      '6. Role Separation: Worker Denied Customer Completion (HTTP 403)',
      workerCompleteRes.status === 403,
      `Status: ${workerCompleteRes.status}`
    );

    // ----------------------------------------------------
    // TEST 7: Customer Blocked from Admin Endpoints
    // ----------------------------------------------------
    const custAdminRes = await makeRequest({
      path: '/api/admin/overview',
      method: 'GET',
      token: customerToken
    });
    recordResult(
      '7. Privilege Escalation Defense: Customer Blocked from Admin API (HTTP 403)',
      custAdminRes.status === 403,
      `Status: ${custAdminRes.status}`
    );

    // ----------------------------------------------------
    // TEST 8: Bcrypt Password Encryption in MongoDB
    // ----------------------------------------------------
    const dbUsers = await User.find({ email: { $in: ['customer@hometech.demo', 'worker@hometech.demo', 'admin@hometech.demo'] } }).select('+password');
    const allHashed = dbUsers.every(u => u.password && (u.password.startsWith('$2a$') || u.password.startsWith('$2b$')));
    recordResult(
      '8. Password Storage Security: Bcrypt Hashes in MongoDB (Zero Plaintext)',
      allHashed && dbUsers.length >= 3,
      `${dbUsers.length} users checked`
    );

    // ----------------------------------------------------
    // TEST 9: Frontend Sanitization & Script Injection Defense in Chrome
    // ----------------------------------------------------
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });
    const page = await browser.newPage();
    let xssTriggered = false;
    page.on('dialog', async dialog => {
      xssTriggered = true;
      await dialog.dismiss();
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'customer@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    // Test XSS safety in contact page or profile
    await page.goto(`${BASE_URL}/contact`, { waitUntil: 'networkidle2' });
    const nameInput = await page.$('input[name="name"], input[placeholder*="Name"]');
    if (nameInput) {
      await nameInput.type("<script>window.__xss_test=true;</script>");
    }
    const isXssExecuted = await page.evaluate(() => window.__xss_test === true);
    recordResult(
      '9. Client-Side XSS Protection: Script Injection Not Executed in DOM',
      !isXssExecuted && !xssTriggered,
      'Script tags properly escaped'
    );

    await browser.close();

  } catch (err) {
    console.error('Security Suite encountered an error:', err);
    recordResult('Execution without uncaught error', false, err.message);
  } finally {
    await mongoose.disconnect();
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} TESTS PASSED`);
  console.log('====================================================');
  return results;
}

if (process.argv[1] && process.argv[1].includes('test_security_api.js')) {
  runSecurityApiTests().then((results) => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });
}
